/**
 * Survey table filter state and option lists. Matching and the contextual
 * counts happen on the server (GET /surveys/search and /search/facets).
 */
import type { SurveyStatus } from '../types/api';

export type ResponsesFilter = 'any' | 'with' | 'none';

export interface Filters {
  status: SurveyStatus[];
  responses: ResponsesFilter;
  unpublished: boolean;
}

export const EMPTY_FILTERS: Filters = { status: [], responses: 'any', unpublished: false };

export const STATUS_OPTIONS: { value: SurveyStatus; label: string }[] = [
  { value: 'published', label: 'Live' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];
export const RESPONSE_OPTIONS: { value: ResponsesFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'with', label: 'Has responses' },
  { value: 'none', label: 'No responses yet' },
];

export const toggleStatus = (f: Filters, st: SurveyStatus): Filters => ({
  ...f,
  status: f.status.includes(st) ? f.status.filter((x) => x !== st) : [...f.status, st],
});
