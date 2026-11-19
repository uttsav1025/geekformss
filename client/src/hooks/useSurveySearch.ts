import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { Filters } from '../lib/filters';
import type { Meta, Survey, SurveyFacets, SurveyStatus } from '../types/api';

const DEBOUNCE_MS = 250;
const PAGE_SIZE = 25;

export interface SurveySearch {
  items: Survey[];
  meta: Meta | null;
  facets: SurveyFacets | null;
  /** True while a request is in flight (the previous results stay on screen). */
  loading: boolean;
  error: string;
  loadMore: () => void;
  reload: () => void;
}

/**
 * Server-side search for the survey table: GET /surveys/search for the page of
 * results and /surveys/search/facets for the pill counts, fetched in parallel.
 * Typing is debounced; filter clicks apply at once. Responses that arrive
 * after a newer query are dropped, so results never flash back.
 */
export function useSurveySearch(q: string, filters: Filters, scope?: SurveyStatus): SurveySearch {
  const [items, setItems] = useState<Survey[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [facets, setFacets] = useState<SurveyFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [reloadKey, setReloadKey] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), q.trim() ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [q]);

  // Repeated ?status= params, as the server expects.
  const buildParams = useCallback(
    (page?: number) => {
      const p = new URLSearchParams();
      if (debouncedQ) p.set('q', debouncedQ);
      if (scope) p.set('scope', scope);
      for (const s of filters.status) p.append('status', s);
      if (filters.responses !== 'any') p.set('responses', filters.responses);
      if (filters.unpublished) p.set('unpublished', 'true');
      if (page) {
        p.set('page', String(page));
        p.set('limit', String(PAGE_SIZE));
      }
      return p;
    },
    [debouncedQ, scope, filters],
  );

  useEffect(() => {
    const n = ++seq.current;
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      api.getPaged<Survey[]>('/surveys/search', { params: buildParams(1), signal: controller.signal }),
      api.get<SurveyFacets>('/surveys/search/facets', { params: buildParams(), signal: controller.signal }),
    ])
      .then(([page, counts]) => {
        if (n !== seq.current) return;
        setItems(page.data);
        setMeta(page.meta);
        setFacets(counts);
        setError('');
      })
      .catch((e: unknown) => {
        if (n === seq.current && !controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (n === seq.current) setLoading(false);
      });
    return () => controller.abort();
  }, [buildParams, reloadKey]);

  const loadMore = useCallback(() => {
    if (!meta?.hasNextPage) return;
    const n = seq.current;
    setLoading(true);
    api
      .getPaged<Survey[]>('/surveys/search', { params: buildParams(meta.page + 1) })
      .then((page) => {
        if (n !== seq.current) return;
        // De-duplicate in case a row moved pages between requests.
        setItems((cur) => [...cur, ...page.data.filter((s) => !cur.some((c) => c.id === s.id))]);
        setMeta(page.meta);
      })
      .catch((e: unknown) => {
        if (n === seq.current) setError(errorMessage(e));
      })
      .finally(() => {
        if (n === seq.current) setLoading(false);
      });
  }, [meta, buildParams]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { items, meta, facets, loading, error, loadMore, reload };
}
