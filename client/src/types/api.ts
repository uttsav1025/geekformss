/**
 * Shapes the /api/v1 endpoints return (the `data` part of the envelope).
 * Dates arrive as ISO strings over JSON.
 */
import type { Answers, QuestionType, SurveySchema } from '@survey/shared';

export type SurveyStatus = 'draft' | 'published' | 'closed';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** GET /surveys/search/facets: contextual counts for every filter option. */
export interface SurveyFacets {
  /** Surveys in scope before any search or filter. */
  baseTotal: number;
  status: Record<SurveyStatus, number>;
  statusAll: number;
  responses: Record<'any' | 'with' | 'none', number>;
  unpublished: number;
  anyUnpublished: boolean;
}

export interface Paged<T> {
  data: T;
  meta: Meta;
}

export interface Survey {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: SurveyStatus;
  schema: SurveySchema;
  currentVersion: { version: number; publishedAt: string } | null;
  hasUnpublishedChanges: boolean;
  responseCount: number;
  partialCount: number;
  lastResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyVersion {
  version: number;
  title: string;
  publishedAt: string;
  questionCount: number;
  responseCount: number;
}

export interface DayCount {
  day: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface OwnerStats {
  days: DayCount[];
  previousTotal: number;
}

// ── Analytics ────────────────────────────────────────────────────────────────

interface QuestionStatsBase {
  id: string;
  index: number;
  label: string;
  required: boolean;
  conditional: boolean;
  answeredCount: number;
  skippedCount: number;
}

export interface OptionStat {
  id: string;
  label: string;
  count: number;
  percent: number;
}

export interface ChoiceStats extends QuestionStatsBase {
  type: 'single' | 'multi';
  options: OptionStat[];
}

export interface RatingStats extends QuestionStatsBase {
  type: 'rating';
  average: number | null;
  distribution: { value: number; count: number }[];
}

export interface TextAnswer {
  id?: string;
  value: string;
  submittedAt: string;
}

export interface TextStats extends QuestionStatsBase {
  type: 'text';
  recent: TextAnswer[];
}

export type QuestionStats = ChoiceStats | RatingStats | TextStats;

export interface Analytics {
  survey: { id: string; title: string; slug: string; status: SurveyStatus };
  /** null: never published. 'all': every version combined. */
  version: number | 'all' | null;
  totals: {
    responses: number;
    partial: number;
    completionRate: number | null;
    lastResponseAt: string | null;
  };
  timeline: DayCount[];
  questions: QuestionStats[];
}

// ── Public form ──────────────────────────────────────────────────────────────

export interface PublicForm {
  slug: string;
  title: string;
  description: string;
  version: number;
  schema: SurveySchema;
}

export interface PublicFormResponse {
  survey: PublicForm;
  resume: { token: string; answers: Answers } | null;
}

export interface DraftSaved {
  resumeToken: string | null;
  savedAt: string | null;
}

export type { Answers, QuestionType };
