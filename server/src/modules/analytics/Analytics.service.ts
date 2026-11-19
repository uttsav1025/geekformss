import { type SQL, and, eq, sql } from "drizzle-orm";
import type { Answers, SurveySchema } from "@survey/shared";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { surveyVersions, surveys } from "../../db/schema/survey.schema.js";
import { responses } from "../../db/schema/response.schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { likeEscape } from "../survey/Survey.service.js";

/** Which responses an analytics request covers. versionId null = every version. */
export interface Scope {
  surveyId: string;
  versionId: string | null;
  version: number | "all" | null;
  schema: SurveySchema;
}

const NO_VERSION = "00000000-0000-0000-0000-000000000000";
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 *   undefined -> the current published version
 *   number    -> that specific version
 *   "all"     -> every version, labelled with the latest schema (question ids are
 *                stable across versions, so answers line up)
 */
export const resolveScope = async (surveyId: string, version: number | "all" | undefined): Promise<Scope> => {
  const [v] =
    version === undefined || version === "all"
      ? await db
          .select({ id: surveyVersions.id, version: surveyVersions.version, schema: surveyVersions.schema })
          .from(surveys)
          .innerJoin(surveyVersions, eq(surveyVersions.id, surveys.currentVersionId))
          .where(eq(surveys.id, surveyId))
      : await db
          .select({ id: surveyVersions.id, version: surveyVersions.version, schema: surveyVersions.schema })
          .from(surveyVersions)
          .where(and(eq(surveyVersions.surveyId, surveyId), eq(surveyVersions.version, version)));
  if (!v && typeof version === "number") throw new AppError(404, `Version ${version} not found`);
  return {
    surveyId,
    versionId: version === "all" ? null : (v?.id ?? NO_VERSION),
    version: version === "all" ? "all" : (v?.version ?? null),
    schema: v?.schema ?? { questions: [] },
  };
};

const inScope = (s: Scope): SQL =>
  sql`r.survey_id = ${s.surveyId} AND (${s.versionId}::uuid IS NULL OR r.version_id = ${s.versionId}::uuid) AND r.status = 'complete'`;

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Whole dashboard in a fixed number of queries regardless of question count:
 * totals, 30-day timeline, answered-per-question, one pass for every choice /
 * rating distribution (scalars wrapped as 1-element arrays), latest text answers.
 */
export const buildAnalytics = async (survey: { id: string; title: string; slug: string; status: string }, scope: Scope) => {
  const questions = scope.schema.questions ?? [];
  const choiceIds = questions.filter((q) => q.type !== "text").map((q) => q.id);
  const textIds = questions.filter((q) => q.type === "text").map((q) => q.id);
  const where = inScope(scope);

  const [totals, timeline, answered, choices, texts] = await Promise.all([
    db.execute<{ complete: number; partial: number; last_response_at: Date | null }>(sql`
      SELECT count(*) FILTER (WHERE r.status = 'complete')::int AS complete,
             count(*) FILTER (WHERE r.status = 'partial' AND r.updated_at > now() - make_interval(days => ${env.PARTIAL_TTL_DAYS}))::int AS partial,
             max(r.submitted_at) AS last_response_at
      FROM ${responses} r
      WHERE r.survey_id = ${scope.surveyId} AND (${scope.versionId}::uuid IS NULL OR r.version_id = ${scope.versionId}::uuid)`),
    db.execute<{ day: string; count: number }>(sql`
      SELECT to_char(date_trunc('day', r.submitted_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM ${responses} r WHERE ${where} AND r.submitted_at > now() - interval '30 days'
      GROUP BY 1 ORDER BY 1`),
    db.execute<{ qid: string; n: number }>(sql`
      SELECT kv.key AS qid, count(*)::int AS n
      FROM ${responses} r CROSS JOIN LATERAL jsonb_each(r.answers) kv
      WHERE ${where} GROUP BY 1`),
    db.execute<{ qid: string; value: string; n: number }>(sql`
      SELECT kv.key AS qid, opt.value AS value, count(*)::int AS n
      FROM ${responses} r
      CROSS JOIN LATERAL jsonb_each(r.answers) kv
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(kv.value) = 'array' THEN kv.value ELSE jsonb_build_array(kv.value) END
      ) opt
      WHERE ${where} AND kv.key = ANY(${sql.param(choiceIds)}::text[])
      GROUP BY 1, 2`),
    db.execute<{ qid: string; value: string; submitted_at: Date }>(sql`
      SELECT qid, value, submitted_at FROM (
        SELECT kv.key AS qid, kv.value #>> '{}' AS value, r.submitted_at,
               row_number() OVER (PARTITION BY kv.key ORDER BY r.submitted_at DESC) AS rn
        FROM ${responses} r CROSS JOIN LATERAL jsonb_each(r.answers) kv
        WHERE ${where} AND kv.key = ANY(${sql.param(textIds)}::text[])
      ) t WHERE rn <= 8 ORDER BY qid, submitted_at DESC`),
  ]);

  const answeredBy = Object.fromEntries(answered.rows.map((r) => [r.qid, r.n]));
  const counts: Record<string, Record<string, number>> = {};
  for (const r of choices.rows) (counts[r.qid] ??= {})[r.value] = r.n;
  const samples: Record<string, { value: string; submittedAt: Date }[]> = {};
  for (const r of texts.rows) (samples[r.qid] ??= []).push({ value: r.value, submittedAt: r.submitted_at });

  const { complete, partial, last_response_at } = totals.rows[0];

  const perQuestion = questions.map((q, index) => {
    const n = answeredBy[q.id] ?? 0;
    const base = {
      id: q.id,
      index: index + 1,
      type: q.type,
      label: q.label,
      required: q.required,
      conditional: Boolean(q.condition),
      answeredCount: n,
      skippedCount: Math.max(complete - n, 0),
    };
    const qc = counts[q.id] ?? {};
    const pct = (c: number) => (n ? round((c / n) * 100, 1) : 0);

    if (q.type === "single" || q.type === "multi") {
      const options = (q.options ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        count: qc[o.id] ?? 0,
        percent: pct(qc[o.id] ?? 0),
      }));
      // Answers to options deleted in a later version (only visible in "all versions").
      const known = new Set((q.options ?? []).map((o) => o.id));
      const removed = Object.entries(qc)
        .filter(([id]) => !known.has(id))
        .reduce((sum, [, c]) => sum + c, 0);
      if (removed) options.push({ id: "__removed__", label: "(removed option)", count: removed, percent: pct(removed) });
      return { ...base, options };
    }
    if (q.type === "rating") {
      // Zero-filled, so the client renders without its own defaults.
      const distribution = [1, 2, 3, 4, 5].map((value) => ({ value, count: qc[String(value)] ?? 0 }));
      const total = distribution.reduce((s, d) => s + d.count, 0);
      const sum = distribution.reduce((s, d) => s + d.value * d.count, 0);
      return { ...base, average: total ? round(sum / total, 2) : null, distribution };
    }
    return { ...base, recent: samples[q.id] ?? [] };
  });

  return {
    survey: { id: survey.id, title: survey.title, slug: survey.slug, status: survey.status },
    version: scope.version,
    totals: {
      responses: complete,
      partial,
      completionRate: complete + partial ? round((complete / (complete + partial)) * 100, 1) : null,
      lastResponseAt: last_response_at,
    },
    timeline: timeline.rows,
    questions: perQuestion,
  };
};

export interface TextAnswerParams {
  questionId: string;
  limit: number;
  offset: number;
  page: number;
  search?: string;
}

/** Paginated text answers for one question, optional case-insensitive search. */
export const listTextAnswers = async (scope: Scope, { questionId, limit, offset, search }: TextAnswerParams) => {
  const term = search ? `%${likeEscape(search)}%` : null;
  const { rows } = await db.execute<{ id: string; value: string; submitted_at: Date; total: number }>(sql`
    SELECT r.id, r.answers ->> ${questionId} AS value, r.submitted_at, count(*) OVER ()::int AS total
    FROM ${responses} r
    WHERE ${inScope(scope)} AND r.answers ? ${questionId}
      AND (${term}::text IS NULL OR r.answers ->> ${questionId} ILIKE ${term})
    ORDER BY r.submitted_at DESC, r.id DESC
    LIMIT ${limit} OFFSET ${offset}`);
  return {
    total: rows[0]?.total ?? 0,
    items: rows.map((r) => ({ id: r.id, value: r.value, submittedAt: r.submitted_at })),
  };
};

const csvCell = (v: unknown) => {
  if (v === undefined || v === null) return "";
  let s = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportCsv = async (scope: Scope) => {
  const questions = scope.schema.questions ?? [];
  const { rows } = await db.execute<{ id: string; submitted_at: Date; version: number; answers: Answers }>(sql`
    SELECT r.id, r.submitted_at, v.version, r.answers
    FROM ${responses} r JOIN ${surveyVersions} v ON v.id = r.version_id
    WHERE ${inScope(scope)} ORDER BY r.submitted_at, r.id`);

  const optionLabel = new Map<string, string>();
  for (const q of questions) for (const o of q.options ?? []) optionLabel.set(`${q.id}:${o.id}`, o.label);
  const render = (qid: string, type: string, value: unknown): unknown => {
    if (value === undefined) return "";
    if (Array.isArray(value)) return (value as string[]).map((id) => optionLabel.get(`${qid}:${id}`) ?? id).join("; ");
    if (type === "single" && typeof value === "string") return optionLabel.get(`${qid}:${value}`) ?? value;
    return value;
  };
  const lines = [["response_id", "submitted_at", "version", ...questions.map((q) => q.label)].map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [r.id, new Date(r.submitted_at).toISOString(), r.version, ...questions.map((q) => render(q.id, q.type, r.answers[q.id]))]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
};
