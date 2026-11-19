import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import type { TextAnswer, TextStats } from '../../types/api';

const PAGE = 20; // offsets stay multiples of PAGE, so they map to whole pages

// Text answers: 3 shown while collapsed. Expanded, or filling spare column height
// in the masonry (the .fill card), every loaded answer shows.
export default function TextResult({ q, surveyId, version }: { q: TextStats; surveyId: string; version: string }) {
  const [items, setItems] = useState<TextAnswer[]>(q.recent);
  const [total, setTotal] = useState(q.answeredCount);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Collapsed cards show 3 answers (CSS); expanded, or filling a masonry column, show all loaded.
  const [expanded, setExpanded] = useState(false);
  const reqRef = useRef(0);

  const fetchPage = useCallback(
    async (offset: number, term: string) => {
      const n = ++reqRef.current;
      setLoading(true);
      setFailed(false);
      const params = {
        page: Math.floor(offset / PAGE) + 1,
        limit: PAGE,
        version: version || undefined,
        search: term || undefined,
      };
      try {
        const { data: page, meta } = await api.getPaged<TextAnswer[]>(`/surveys/${surveyId}/analytics/text/${q.id}`, { params });
        if (n !== reqRef.current) return;
        setTotal(meta.total);
        setItems((cur) => (offset === 0 ? page : [...cur, ...page]));
      } catch {
        if (n === reqRef.current) setFailed(true);
      } finally {
        if (n === reqRef.current) setLoading(false);
      }
    },
    [surveyId, q.id, version],
  );

  useEffect(() => {
    if (!search) {
      setItems(q.recent);
      setTotal(q.answeredCount);
      return undefined;
    }
    const t = setTimeout(() => void fetchPage(0, search), 300);
    return () => clearTimeout(t);
  }, [search, fetchPage, q.recent, q.answeredCount]);

  return (
    <div className="in-[.fill]:flex in-[.fill]:min-h-0 in-[.fill]:flex-1 in-[.fill]:flex-col">
      {q.answeredCount > 3 && (
        <input
          className="mb-3 flex-none"
          type="search"
          placeholder="Search answers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={`Search answers to ${q.label}`}
        />
      )}
      {failed && <p className="field-error mb-3">Couldn&apos;t load answers. Try again</p>}
      {items.length === 0 ? (
        <p className="note">{search ? 'No matching answers' : 'No answers yet'}</p>
      ) : (
        <ul
          className={`thin-scroll m-0 mb-3 flex max-h-90 list-none flex-col overflow-y-auto p-0 in-[.fill]:max-h-none in-[.fill]:min-h-0 in-[.fill]:flex-1 ${
            expanded || search ? '' : '[&>li:nth-child(n+4)]:hidden'
          }`}
        >
          {items.map((it, i) => (
            <li key={it.id ?? i} className="border-b border-line py-3 first:pt-0 in-[.fill]:block!">
              <p className="m-0 mb-1 text-sm/5 break-words whitespace-pre-wrap">{it.value}</p>
              <span className="font-mono text-xs text-muted">{fmtRelative(it.submittedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {!expanded && !search && total > 3 && (
        <button className="btn btn-sm self-start" onClick={() => setExpanded(true)}>
          Show all {total} answers
        </button>
      )}
      {(expanded || search) && items.length < total && (
        <button
          className="btn btn-sm"
          disabled={loading}
          onClick={() => fetchPage(items === q.recent ? 0 : items.length, search)}
        >
          {loading ? 'Loading…' : `Load ${Math.min(20, total - items.length)} more of ${total - items.length}`}
        </button>
      )}
    </div>
  );
}
