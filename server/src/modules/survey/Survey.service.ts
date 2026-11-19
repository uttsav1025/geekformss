import { type SQL, and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { type SurveySchema, validateSurveySchema } from "@survey/shared";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { type SurveyStatus, surveyVersions, surveys } from "../../db/schema/survey.schema.js";
import { responses } from "../../db/schema/response.schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { buildMeta } from "../../utils/pagination.js";
import { surveySlug } from "../../utils/slug.js";
import type { CreateSurveyInput, ListSurveysQuery, SurveySort, UpdateSurveyInput } from "./Survey.schema.zod.js";

/** Escape LIKE wildcards so a search for "50%" matches literally. */
export const likeEscape = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

// ── Shared projection ────────────────────────────────────────────────────────
// Counts come from correlated subqueries (one round trip per page, no N+1).
// "In progress" only counts partials inside the TTL window, so stale drafts
// never inflate it even before the purge runs.

const completeCount =
  sql<number>`(SELECT count(*) FROM ${responses} r WHERE r.survey_id = ${surveys.id} AND r.status = 'complete')`.mapWith(Number);
const partialCount = sql<number>`(SELECT count(*) FROM ${responses} r WHERE r.survey_id = ${surveys.id} AND r.status = 'partial'
  AND r.updated_at > now() - make_interval(days => ${env.PARTIAL_TTL_DAYS}))`.mapWith(Number);
const lastResponseAt = sql<Date | null>`(SELECT max(r.submitted_at) FROM ${responses} r WHERE r.survey_id = ${surveys.id})`;
const hasUnpublishedChanges = sql<boolean>`(${surveyVersions.id} IS NULL
  OR ${surveys.draftSchema} IS DISTINCT FROM ${surveyVersions.schema}
  OR ${surveys.title} IS DISTINCT FROM ${surveyVersions.title}
  OR ${surveys.description} IS DISTINCT FROM ${surveyVersions.description})`;

const surveyColumns = {
  id: surveys.id,
  slug: surveys.slug,
  title: surveys.title,
  description: surveys.description,
  status: surveys.status,
  schema: surveys.draftSchema,
  currentVersion: surveyVersions.version,
  currentPublishedAt: surveyVersions.publishedAt,
  hasUnpublishedChanges,
  responseCount: completeCount,
  partialCount,
  lastResponseAt,
  createdAt: surveys.createdAt,
  updatedAt: surveys.updatedAt,
};

type SurveyRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: SurveyStatus;
  schema: SurveySchema;
  currentVersion: number | null;
  currentPublishedAt: Date | null;
  hasUnpublishedChanges: boolean;
  responseCount: number;
  partialCount: number;
  lastResponseAt: Date | string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** DB row → API shape. */
export const present = (row: SurveyRow) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  status: row.status,
  schema: row.schema,
  currentVersion: row.currentVersion ? { version: row.currentVersion, publishedAt: row.currentPublishedAt } : null,
  hasUnpublishedChanges: row.hasUnpublishedChanges,
  responseCount: row.responseCount,
  partialCount: row.partialCount,
  lastResponseAt: row.lastResponseAt ? new Date(row.lastResponseAt) : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
export type PresentedSurvey = ReturnType<typeof present>;

const ownedLive = (id: string, ownerId: string) =>
  and(eq(surveys.id, id), eq(surveys.ownerId, ownerId), eq(surveys.deleted, false));

export const baseSelect = () =>
  db.select(surveyColumns).from(surveys).leftJoin(surveyVersions, eq(surveyVersions.id, surveys.currentVersionId));

// Always end with an id tie-breaker so pages never repeat or skip rows.
export const orderFor = (sort: SurveySort) => {
  switch (sort) {
    case "created":
      return [desc(surveys.createdAt), desc(surveys.id)];
    case "title":
      return [asc(surveys.title), asc(surveys.id)];
    case "responses":
      return [desc(completeCount), desc(surveys.updatedAt), desc(surveys.id)];
    default:
      return [desc(surveys.updatedAt), desc(surveys.id)];
  }
};

// ── Reads ────────────────────────────────────────────────────────────────────

export interface ListSurveysParams extends ListSurveysQuery {
  ownerId: string;
  page: number;
  limit: number;
  offset: number;
}

export const listSurveys = async ({ ownerId, page, limit, offset, search, status, sort }: ListSurveysParams) => {
  const conditions: SQL[] = [eq(surveys.ownerId, ownerId), eq(surveys.deleted, false)];
  if (search) {
    const term = `%${likeEscape(search)}%`;
    conditions.push(or(sql`${surveys.title} ILIKE ${term}`, sql`${surveys.slug} ILIKE ${term}`) as SQL);
  }
  if (status?.length) conditions.push(inArray(surveys.status, status));
  const where = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(surveys).where(where),
    baseSelect()
      .where(where)
      .orderBy(...orderFor(sort))
      .limit(limit)
      .offset(offset),
  ]);
  return { data: (rows as SurveyRow[]).map(present), meta: buildMeta(page, limit, Number(countResult[0]?.total ?? 0)) };
};

export const getSurvey = async (id: string, ownerId: string) => {
  const [row] = await baseSelect().where(ownedLive(id, ownerId));
  return row ? present(row) : null; // null → controller decides 404
};

export const listVersions = async (surveyId: string) => {
  const rows = await db
    .select({
      version: surveyVersions.version,
      title: surveyVersions.title,
      publishedAt: surveyVersions.publishedAt,
      questionCount: sql<number>`jsonb_array_length(${surveyVersions.schema}->'questions')`.mapWith(Number),
      responseCount:
        sql<number>`(SELECT count(*) FROM ${responses} r WHERE r.version_id = ${surveyVersions.id} AND r.status = 'complete')`.mapWith(
          Number,
        ),
    })
    .from(surveyVersions)
    .where(eq(surveyVersions.surveyId, surveyId))
    .orderBy(desc(surveyVersions.version));
  return rows;
};

/**
 * Account-level activity for the dashboard: completed responses per UTC day for
 * the last 30 days across the owner's live surveys, plus the previous 30-day total.
 */
export const ownerStats = async (ownerId: string) => {
  const [days, previous] = await Promise.all([
    db.execute<{ day: string; count: number }>(sql`
      SELECT to_char(date_trunc('day', r.submitted_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM ${responses} r JOIN ${surveys} s ON s.id = r.survey_id
      WHERE s.owner_id = ${ownerId} AND s.deleted = false AND r.status = 'complete'
        AND r.submitted_at > now() - interval '30 days'
      GROUP BY 1 ORDER BY 1`),
    db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count
      FROM ${responses} r JOIN ${surveys} s ON s.id = r.survey_id
      WHERE s.owner_id = ${ownerId} AND s.deleted = false AND r.status = 'complete'
        AND r.submitted_at <= now() - interval '30 days' AND r.submitted_at > now() - interval '60 days'`),
  ]);
  return { days: days.rows, previousTotal: previous.rows[0]?.count ?? 0 };
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const createSurvey = async (ownerId: string, input: CreateSurveyInput) => {
  // The random slug suffix makes collisions vanishingly rare; the unique
  // constraint is the authority, so retry a few times on 23505.
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db
        .insert(surveys)
        .values({
          ownerId,
          slug: surveySlug(input.title),
          title: input.title,
          description: input.description,
          draftSchema: input.schema as unknown as SurveySchema,
        })
        .returning({ id: surveys.id });
      return (await getSurvey(row.id, ownerId))!;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505" || attempt === 4) throw error;
    }
  }
};

export const updateDraft = async (id: string, ownerId: string, input: UpdateSurveyInput) => {
  const [row] = await db
    .update(surveys)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.schema !== undefined && { draftSchema: input.schema as unknown as SurveySchema }),
      updatedAt: new Date(), // not automatic
    })
    .where(ownedLive(id, ownerId))
    .returning({ id: surveys.id });
  return row ? getSurvey(row.id, ownerId) : null;
};

/**
 * Publish = snapshot the draft into a new immutable version. The survey row is
 * locked so two concurrent publishes can't both mint "version 3".
 */
export const publishSurvey = async (id: string, ownerId: string) => {
  const found = await db.transaction(async (tx) => {
    const [survey] = await tx.select().from(surveys).where(ownedLive(id, ownerId)).for("update");
    if (!survey) return false;

    const schema = survey.draftSchema;
    if (!schema.questions?.length) throw new AppError(422, "Add at least one question before publishing");
    const { valid, errors } = validateSurveySchema(schema);
    if (!valid) {
      throw new AppError(
        422,
        errors[0].message,
        errors.map((e) => ({ field: e.questionId ?? e.path ?? "schema", message: e.message })),
      );
    }

    if (survey.currentVersionId) {
      const [current] = await tx.select().from(surveyVersions).where(eq(surveyVersions.id, survey.currentVersionId));
      const unchanged =
        current &&
        JSON.stringify(current.schema) === JSON.stringify(schema) &&
        current.title === survey.title &&
        current.description === survey.description;
      if (unchanged) {
        // Nothing new to snapshot; just (re)open the survey.
        await tx.update(surveys).set({ status: "published", updatedAt: new Date() }).where(eq(surveys.id, survey.id));
        return true;
      }
    }

    const [version] = await tx
      .insert(surveyVersions)
      .values({
        surveyId: survey.id,
        version: sql`(SELECT COALESCE(MAX(version), 0) + 1 FROM ${surveyVersions} WHERE survey_id = ${survey.id})`,
        title: survey.title,
        description: survey.description,
        schema,
      })
      .returning({ id: surveyVersions.id });
    await tx
      .update(surveys)
      .set({ currentVersionId: version.id, status: "published", updatedAt: new Date() })
      .where(eq(surveys.id, survey.id));
    return true;
  });
  return found ? getSurvey(id, ownerId) : null;
};

export const setStatus = async (id: string, ownerId: string, status: "published" | "closed") => {
  const survey = await getSurvey(id, ownerId);
  if (!survey) return null;
  if (status === "published" && !survey.currentVersion) throw new AppError(422, "Publish the survey first");
  await db.update(surveys).set({ status, updatedAt: new Date() }).where(ownedLive(id, ownerId));
  return getSurvey(id, ownerId);
};

/**
 * Soft delete. Responses and versions stay (recoverable, auditable); the public
 * link stops resolving immediately because every public read filters deleted.
 */
export const softDeleteSurvey = async (id: string, ownerId: string) => {
  const now = new Date();
  const [row] = await db
    .update(surveys)
    .set({ deleted: true, deletedAt: now, updatedAt: now })
    .where(ownedLive(id, ownerId))
    .returning({ id: surveys.id });
  return Boolean(row);
};
