import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { SurveySchema } from "@survey/shared";
import { users } from "./user.schema.js";

export const SURVEY_STATUSES = ["draft", "published", "closed"] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

/**
 * The mutable "container": title, slug, status and the working draft the
 * builder edits. Publishing snapshots the draft into an immutable row in
 * survey_versions (same file: the two are always used together).
 */
export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Public URL key. Never regenerated on rename, so shared links stay stable.
    slug: text("slug").notNull().unique("surveys_slug_key"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    draftSchema: jsonb("draft_schema")
      .$type<SurveySchema>()
      .notNull()
      .default(sql`'{"questions": []}'::jsonb`),
    status: text("status").$type<SurveyStatus>().notNull().default("draft"),
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => surveyVersions.id, { onDelete: "set null" }),
    // Soft delete: the row (and its responses) stay, every read filters deleted = false,
    // and the slug stays reserved so an old public link can never point at a new survey.
    deleted: boolean("deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("surveys_owner_idx").on(t.ownerId, t.updatedAt.desc()),
    // Every owner list filters deleted and sorts by updatedAt.
    index("surveys_owner_deleted_idx").on(t.ownerId, t.deleted, t.updatedAt.desc()),
    check("surveys_status_check", sql`${t.status} IN ('draft', 'published', 'closed')`),
  ],
);

/**
 * Immutable published snapshots. Responses point at the exact version they
 * were collected against, so editing a live survey never rewrites history.
 */
export const surveyVersions = pgTable(
  "survey_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id")
      .notNull()
      .references((): AnyPgColumn => surveys.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    schema: jsonb("schema").$type<SurveySchema>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("survey_versions_survey_id_version_key").on(t.surveyId, t.version)],
);

export type Survey = typeof surveys.$inferSelect;
export type SurveyVersion = typeof surveyVersions.$inferSelect;
