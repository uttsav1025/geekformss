import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Answers } from "@survey/shared";
import { surveys, surveyVersions } from "./survey.schema.js";

export const RESPONSE_STATUSES = ["partial", "complete"] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/**
 * Answers stored separately from the survey, as a JSONB object keyed by
 * question id. Autosaved partials share the table with a status flag; only
 * `complete` rows count in analytics.
 */
export const responses = pgTable(
  "responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => surveyVersions.id, { onDelete: "cascade" }),
    answers: jsonb("answers")
      .$type<Answers>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").$type<ResponseStatus>().notNull().default("partial"),
    // SHA-256 of the opaque resume token; the token itself is never stored.
    resumeTokenHash: text("resume_token_hash").unique("responses_resume_token_hash_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    index("responses_version_status_idx").on(t.versionId, t.status),
    index("responses_survey_status_idx").on(t.surveyId, t.status, t.submittedAt.desc()),
    // Stale-partial purge and "in progress" counts both filter partials by updated_at.
    index("responses_partial_updated_idx")
      .on(t.updatedAt)
      .where(sql`status = 'partial'`),
    check("responses_status_check", sql`${t.status} IN ('partial', 'complete')`),
  ],
);

export type ResponseRow = typeof responses.$inferSelect;
