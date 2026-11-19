import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Link2, Pencil, Radio, Search, Trash2, X } from 'lucide-react';
import { fmtRelative, publicUrl } from '../../lib/format';
import { EMPTY_FILTERS, type Filters } from '../../lib/filters';
import { useSurveySearch } from '../../hooks/useSurveySearch';
import type { Survey, SurveyStatus } from '../../types/api';
import StatusBadge from '../common/StatusBadge';
import CopyButton from '../common/CopyButton';
import FilterPills from './FilterPills';

const nf = new Intl.NumberFormat();

const TH = 'border-b border-line px-4 py-3 text-left text-[13px]/5 font-medium text-muted first:pl-6 last:pr-4';
// Desktop padding/borders only from sm up, so phone rows (block cells) never fight them.
const TD_BASE = 'align-middle sm:border-b sm:border-line sm:px-4 sm:py-3 sm:first:pl-6 sm:last:pr-4 sm:group-last:border-b-0';
const TD = `${TD_BASE} max-sm:block`;
const NUM = 'text-right tabular-nums';
const HIDE_MD = 'max-md:hidden';
// Cells hidden below md must not also get max-sm:block (it would win and show them).
const TD_HIDDEN_MD = `${TD_BASE} ${HIDE_MD}`;

/**
 * Survey list with one filtering model everywhere: search + filter pills,
 * both answered by the server (GET /surveys/search and /search/facets).
 * - `layout="merged"` (Home): header row, pills and table in one card.
 * - `layout="split"` (All surveys): search + pills in a header card, the
 *   table in its own card below.
 * `onlyStatus` pins the list to one status; its pill group is then hidden.
 */
interface SurveyTableProps {
  title: string;
  onlyStatus?: SurveyStatus;
  layout?: 'merged' | 'split';
  /** Resolves true when the survey was deleted; the table then re-runs its search. */
  onDelete: (survey: Survey) => Promise<boolean>;
  footer?: ReactNode;
  /** Make this the page's focal card: accent border and a tinted header. */
  featured?: boolean;
}

export default function SurveyTable({
  title,
  onlyStatus,
  layout = 'merged',
  onDelete,
  footer,
  featured = false,
}: SurveyTableProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableId = `${title.replace(/\W+/g, '-').toLowerCase()}-table`;
  const titleId = `${tableId}-title`;
  const split = layout === 'split';

  // "/" focuses search from anywhere on the page (unless already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if ((el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) || el?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { items: visible, meta, facets, loading, error, loadMore, reload } = useSurveySearch(query, filters, onlyStatus);
  const baseTotal = facets?.baseTotal ?? 0;
  const total = meta?.total ?? 0;
  const filtersActive = filters.status.length > 0 || filters.responses !== 'any' || filters.unpublished;
  const narrowed = Boolean(query.trim()) || filtersActive;
  const remove = async (s: Survey) => {
    if (await onDelete(s)) reload();
  };
  const clearAll = () => {
    setQuery('');
    setFilters(EMPTY_FILTERS);
  };

  const search = (
    <div className={`relative min-w-0 flex-1 ${split ? '' : 'max-sm:order-1 max-sm:basis-full'}`} role="search">
      <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute top-2.5 left-3 text-muted" aria-hidden="true" />
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQuery('');
            e.currentTarget.blur();
          }
        }}
        className="h-9 min-h-9 pr-10 pl-9 text-sm"
        placeholder="Search by title or link"
        aria-label={`Search ${title.toLowerCase()}`}
        aria-controls={tableId}
      />
      {query ? (
        <button
          type="button"
          className="icon-btn absolute top-1/2 right-1.5 size-6 -translate-y-1/2"
          onClick={() => {
            setQuery('');
            searchRef.current?.focus();
          }}
          aria-label="Clear search"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      ) : (
        <kbd className="keycap absolute top-1/2 right-2 -translate-y-1/2 max-sm:hidden" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  );
  const count = (
    <span className={`meta whitespace-nowrap ${split ? 'max-sm:order-1' : ''}`} aria-live="polite">
      {!facets ? '' : narrowed ? `${total} of ${baseTotal}` : `${baseTotal} total`}
    </span>
  );

  const body = (
    <>
      {visible.length > 0 && (
        <table className="w-full border-collapse max-sm:block">
          <thead className="max-sm:hidden">
            <tr>
              <th scope="col" className={TH}>
                Survey
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={`${TH} ${NUM}`}>
                Responses
              </th>
              <th scope="col" className={`${TH} ${NUM} ${HIDE_MD}`}>
                In progress
              </th>
              <th scope="col" className={`${TH} ${HIDE_MD}`}>
                Last response
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {visible.map((s) => (
              <tr
                key={s.id}
                className="group transition-colors duration-150 ease-gf hover:bg-raised max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:items-center max-sm:gap-x-3 max-sm:border-b max-sm:border-line max-sm:px-4 max-sm:py-3 max-sm:last:border-b-0"
              >
                <td className={TD}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link to={`/admin/surveys/${s.id}/edit`} className="text-[15px] font-medium text-fg">
                      {s.title}
                    </Link>
                    <span className="note">
                      {s.schema.questions.length} questions
                      {s.currentVersion && ` · v${s.currentVersion.version}`}
                      {s.currentVersion && s.hasUnpublishedChanges && <span className="text-warn"> · unpublished edits</span>}
                    </span>
                  </div>
                </td>
                <td className={`${TD} max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-1`}>
                  <StatusBadge status={s.status} />
                </td>
                <td className={`${TD} ${NUM} text-[15px] font-medium max-sm:col-start-2 max-sm:row-start-1`}>
                  {nf.format(s.responseCount)}
                </td>
                <td className={`${TD_HIDDEN_MD} ${NUM} font-mono text-[13px] text-muted`}>{s.partialCount}</td>
                <td className={`${TD_HIDDEN_MD} font-mono text-[13px] text-muted`}>
                  {s.lastResponseAt ? fmtRelative(s.lastResponseAt) : '—'}
                </td>
                <td
                  className={`${TD} w-[1%] whitespace-nowrap max-sm:col-span-full max-sm:row-start-3 max-sm:mt-2 max-sm:-ml-2 max-sm:w-auto`}
                >
                  <div className="flex justify-end gap-1 max-sm:justify-start">
                    <Link className="icon-btn" to={`/admin/surveys/${s.id}/edit`} aria-label={`Edit ${s.title}`} title="Edit">
                      <Pencil size={16} strokeWidth={1.5} />
                    </Link>
                    <Link
                      className="icon-btn"
                      to={`/admin/surveys/${s.id}/analytics`}
                      aria-label={`Results for ${s.title}`}
                      title="Results"
                    >
                      <BarChart3 size={16} strokeWidth={1.5} />
                    </Link>
                    {s.status === 'published' ? (
                      <CopyButton
                        text={publicUrl(s.slug)}
                        icon={<Link2 size={16} strokeWidth={1.5} />}
                        label={`Copy link to ${s.title}`}
                      />
                    ) : (
                      <span className="icon-btn invisible max-sm:hidden" aria-hidden="true" />
                    )}
                    <button
                      className="icon-btn icon-btn-danger"
                      onClick={() => void remove(s)}
                      aria-label={`Delete ${s.title}`}
                      title="Delete"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && (
        <p className="field-error m-0 px-6 py-3 max-sm:px-4" role="alert">
          {error}
        </p>
      )}

      {!facets && loading && (
        <div className="py-8">
          <div className="spinner" />
        </div>
      )}

      {facets && visible.length === 0 && (
        <div className="flex flex-col items-center gap-1 px-6 py-8 text-center [&_p]:m-0 [&_p]:text-fg-2">
          {baseTotal === 0 ? (
            <p>
              {onlyStatus
                ? 'No live surveys yet. Publish one to start collecting answers'
                : 'No surveys yet. Use New survey in the top bar to start one'}
            </p>
          ) : (
            <>
              <p>
                {query.trim() && !filtersActive && <>No surveys match “{query.trim()}”</>}
                {query.trim() && filtersActive && <>No surveys match “{query.trim()}” with these filters</>}
                {!query.trim() && 'No surveys match these filters'}
              </p>
              <button type="button" className="link-btn text-[13px]" onClick={clearAll}>
                Clear search and filters
              </button>
            </>
          )}
        </div>
      )}

      {meta?.hasNextPage && (
        <div className="flex justify-center border-t border-line px-6 py-3">
          <button type="button" className="btn btn-sm" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading…' : `Show more (${total - visible.length} left)`}
          </button>
        </div>
      )}

      {footer && <div className="border-t border-line px-6 py-3 max-sm:px-4">{footer}</div>}
    </>
  );

  const pills = facets && <FilterPills counts={facets} value={filters} onChange={setFilters} hideStatus={Boolean(onlyStatus)} />;

  if (layout === 'split') {
    return (
      <div className="flex flex-col gap-3">
        <section className="card" aria-labelledby={titleId}>
          <div className="flex items-center gap-3 border-b border-line py-3 pr-4 pl-6 max-sm:px-4">
            {/* The top-bar nav already names this page; keep the heading for screen readers only */}
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {search}
            {count}
          </div>
          {pills}
        </section>
        <section className="card" aria-labelledby={titleId} id={tableId}>
          {body}
        </section>
      </div>
    );
  }

  return (
    <section className={`card ${featured ? 'overflow-hidden border-accent-line' : ''}`} aria-labelledby={titleId}>
      <div
        className={`flex items-center gap-3 border-b py-3 pr-4 pl-6 max-sm:flex-wrap max-sm:px-4 ${
          featured ? 'border-accent-line bg-accent-soft' : 'border-line'
        }`}
      >
        {featured ? (
          // Live icon + "Live" as the visible title; screen readers hear the full title.
          <h2
            id={titleId}
            className="mr-1 flex flex-none items-center gap-2 text-[17px]/6 font-medium text-fg max-sm:mr-auto"
            aria-label={title}
          >
            <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-ink" aria-hidden="true">
              <Radio size={20} strokeWidth={1.75} />
            </span>
            <span aria-hidden="true">Live</span>
          </h2>
        ) : (
          <h2 id={titleId} className="mr-2 text-[15px]/[22px] font-medium whitespace-nowrap max-sm:flex-1">
            {title}
          </h2>
        )}
        {search}
        {count}
      </div>
      <div className="border-b border-line">{pills}</div>
      <div id={tableId}>{body}</div>
    </section>
  );
}
