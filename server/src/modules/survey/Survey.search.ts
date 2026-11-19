/**
 * Survey table search: free-text terms plus facet filters, server-side.
 *
 * Two reads share one set of conditions so they can never disagree:
 *  - searchSurveys: the filtered, sorted, paginated page of surveys
 *  - searchFacets:  contextual counts for every filter option, i.e. how many
 *    surveys would remain if that option were chosen, other facets as they are
 *    (all computed in a single aggregate query over the searched pool)
 */
import { type SQL, and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { type SurveyStatus, SURVEY_STATUSES, surveyVersions, surveys } from "../../db/schema/survey.schema.js";
import { responses } from "../../db/schema/response.schema.js";
import { buildMeta } from "../../utils/pagination.js";
import type { ResponseFilter, SearchSurveysQuery } from "./Survey.schema.zod.js";
import { baseSelect, likeEscape, orderFor, present } from "./Survey.service.js";

export interface SearchSurveysParams extends SearchSurveysQuery {
  ownerId: string;
  page: number;
  limit: number;
  offset: number;
}

const MAX_TERMS = 8;

// Expressions evaluated per survey row (same definitions as the list projection).
const completeCount = sql<number>`(SELECT count(*) FROM ${responses} r WHERE r.survey_id = ${surveys.id} AND r.status = 'complete')`;
const hasUnpublished = sql<boolean>`(${surveyVersions.id} IS NOT NULL AND (
  ${surveys.draftSchema} IS DISTINCT FROM ${surveyVersions.schema}
  OR ${surveys.title} IS DISTINCT FROM ${surveyVersions.title}
  OR ${surveys.description} IS DISTINCT FROM ${surveyVersions.description}))`;
// Words a person might type for a status ("live" finds published surveys).
const statusWords = sql`(CASE ${surveys.status} WHEN 'published' THEN 'live published' ELSE ${surveys.status}::text END)`;

/** Owner + not deleted + optional fixed scope + every search term. */
function poolConditions({ ownerId, scope, q }: Pick<SearchSurveysParams, "ownerId" | "scope" | "q">): SQL[] {
  const conds: SQL[] = [eq(surveys.ownerId, ownerId), eq(surveys.deleted, false)];
  if (scope) conds.push(eq(surveys.status, scope));
  const terms = (q ?? "").split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
  for (const t of terms) {
    const term = `%${likeEscape(t)}%`;
    conds.push(
      or(sql`${surveys.title} ILIKE ${term}`, sql`${surveys.slug} ILIKE ${term}`, sql`${statusWords} ILIKE ${term}`) as SQL,
    );
  }
  return conds;
}

const responsesCond = (filter: ResponseFilter, rc: SQL | SQL.Aliased = completeCount): SQL | undefined =>
  filter === "with" ? sql`${rc} > 0` : filter === "none" ? sql`${rc} = 0` : undefined;

/** One page of surveys matching the search and every filter. */
export const searchSurveys = async (p: SearchSurveysParams) => {
  const conds = poolConditions(p);
  if (p.status?.length) conds.push(inArray(surveys.status, p.status));
  const rc = responsesCond(p.responses);
  if (rc) conds.push(rc);
  if (p.unpublished) conds.push(hasUnpublished);
  const where = and(...conds);

  const [countRows, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(surveys)
      .leftJoin(surveyVersions, eq(surveyVersions.id, surveys.currentVersionId))
      .where(where),
    baseSelect()
      .where(where)
      .orderBy(...orderFor(p.sort))
      .limit(p.limit)
      .offset(p.offset),
  ]);
  return {
    data: (rows as Parameters<typeof present>[0][]).map(present),
    meta: buildMeta(p.page, p.limit, countRows[0]?.total ?? 0),
  };
};

export interface SurveyFacets {
  /** Surveys in scope before any search or filter (tells "none yet" from "no match"). */
  baseTotal: number;
  status: Record<SurveyStatus, number>;
  statusAll: number;
  responses: Record<ResponseFilter, number>;
  unpublished: number;
  anyUnpublished: boolean;
}

/** Contextual counts for every filter option over the searched pool. */
export const searchFacets = async (p: Omit<SearchSurveysParams, "page" | "limit" | "offset" | "sort">): Promise<SurveyFacets> => {
  const pool = db
    .select({
      status: surveys.status,
      rc: sql<number>`${completeCount}`.as("rc"),
      unpub: sql<boolean>`${hasUnpublished}`.as("unpub"),
    })
    .from(surveys)
    .leftJoin(surveyVersions, eq(surveyVersions.id, surveys.currentVersionId))
    .where(and(...poolConditions(p)))
    .as("pool");

  const TRUE = sql`true`;
  const S = p.status?.length
    ? sql`${pool.status} IN (${sql.join(
        p.status.map((s) => sql`${s}`),
        sql`, `,
      )})`
    : TRUE;
  const R = responsesCond(p.responses, sql`${pool.rc}`) ?? TRUE;
  const U = p.unpublished ? sql`${pool.unpub}` : TRUE;
  const n = (cond: SQL) => sql<number>`count(*) FILTER (WHERE ${cond})`.mapWith(Number);

  const [facetRow] = await db
    .select({
      published: n(sql`${pool.status} = 'published' AND ${R} AND ${U}`),
      draft: n(sql`${pool.status} = 'draft' AND ${R} AND ${U}`),
      closed: n(sql`${pool.status} = 'closed' AND ${R} AND ${U}`),
      statusAll: n(sql`${R} AND ${U}`),
      any: n(sql`${S} AND ${U}`),
      with: n(sql`${S} AND ${U} AND ${pool.rc} > 0`),
      none: n(sql`${S} AND ${U} AND ${pool.rc} = 0`),
      unpublished: n(sql`${S} AND ${R} AND ${pool.unpub}`),
      anyUnpublished: sql<boolean>`coalesce(bool_or(${pool.unpub}), false)`,
    })
    .from(pool);

  const [baseRow] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(surveys)
    .where(and(...poolConditions({ ownerId: p.ownerId, scope: p.scope })));

  const f = facetRow;
  const status = Object.fromEntries(SURVEY_STATUSES.map((s) => [s, f[s]])) as Record<SurveyStatus, number>;
  return {
    baseTotal: baseRow?.total ?? 0,
    status,
    statusAll: f.statusAll,
    responses: { any: f.any, with: f.with, none: f.none },
    unpublished: f.unpublished,
    anyUnpublished: Boolean(f.anyUnpublished),
  };
};
