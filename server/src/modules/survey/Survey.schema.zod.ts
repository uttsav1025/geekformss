import { z } from "zod";
import { LIMITS } from "@survey/shared";
import { SURVEY_STATUSES } from "../../db/schema/survey.schema.js";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
// Repeatable query param: ?status=draft&status=closed
const toArray = (v: unknown) => (v === undefined || v === "" || v === null ? undefined : Array.isArray(v) ? v : [v]);

export const idParamSchema = z.object({ id: z.uuid("Invalid survey id") });

// Sort is an allow-list — the client never names a column.
export const SURVEY_SORTS = ["updated", "created", "title", "responses"] as const;
export type SurveySort = (typeof SURVEY_SORTS)[number];

export const listSurveysQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(toArray, z.array(z.enum(SURVEY_STATUSES)).optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(SURVEY_SORTS).default("updated")),
});

// Table search: free text + facet filters. Same query for the results page
// and for the facet counts, so the pills always describe the visible list.
const toBool = (v: unknown) => (v === "true" || v === "1" ? true : v === "false" || v === "0" || v === "" ? false : v);
export const RESPONSE_FILTERS = ["any", "with", "none"] as const;
export type ResponseFilter = (typeof RESPONSE_FILTERS)[number];

export const searchSurveysQuerySchema = z.object({
  /** Whitespace-separated terms; every term must match title, link or status word. */
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  /** Fixed scope (e.g. Home shows only live surveys); applies to counts too. */
  scope: z.preprocess(emptyToUndefined, z.enum(SURVEY_STATUSES).optional()),
  status: z.preprocess(toArray, z.array(z.enum(SURVEY_STATUSES)).max(SURVEY_STATUSES.length).optional()),
  responses: z.preprocess(emptyToUndefined, z.enum(RESPONSE_FILTERS).default("any")),
  unpublished: z.preprocess(toBool, z.boolean().default(false)),
  sort: z.preprocess(emptyToUndefined, z.enum(SURVEY_SORTS).default("updated")),
});

// Drafts are saved leniently (the admin may be mid-edit with an empty label);
// only the overall shape is enforced here. Full semantic validation runs on publish.
const draftSchemaShape = z.looseObject({
  questions: z.array(z.record(z.string(), z.unknown())).max(LIMITS.maxQuestions),
});

export const createSurveySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(LIMITS.maxTitle),
  description: z.string().max(LIMITS.maxSurveyDescription).default(""),
  schema: draftSchemaShape.default({ questions: [] }),
});

// PATCH semantics: undefined = don't change.
export const updateSurveySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(LIMITS.maxTitle).optional(),
    description: z.string().max(LIMITS.maxSurveyDescription).optional(),
    schema: draftSchemaShape.optional(),
  })
  .refine((d) => d.title !== undefined || d.description !== undefined || d.schema !== undefined, {
    message: "Nothing to update",
  });

export const setStatusSchema = z.object({ status: z.enum(["published", "closed"]) });

export type ListSurveysQuery = z.infer<typeof listSurveysQuerySchema>;
export type SearchSurveysQuery = z.infer<typeof searchSurveysQuerySchema>;
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;
