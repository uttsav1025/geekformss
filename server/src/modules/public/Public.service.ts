import { and, eq } from "drizzle-orm";
import { type Answers, type SurveySchema, isAnswered, validateAnswers } from "@survey/shared";
import { db } from "../../config/db.js";
import { surveyVersions, surveys } from "../../db/schema/survey.schema.js";
import { responses } from "../../db/schema/response.schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { randomToken, sha256 } from "../../utils/tokenHelpers.js";

interface LiveVersion {
  versionId: string;
  version: number;
  title: string;
  description: string;
  schema: SurveySchema;
}
interface OpenSurvey extends LiveVersion {
  id: string;
  slug: string;
}
interface PartialRow extends LiveVersion {
  responseId: string;
  answers: Answers;
}

const answerErrors = (errors: Record<string, string>) => Object.entries(errors).map(([field, message]) => ({ field, message }));

// ── Reads ────────────────────────────────────────────────────────────────────

/** The live survey for a public link. Unknown, deleted and never-published look identical (404). */
export const loadOpenSurvey = async (slug: string): Promise<OpenSurvey> => {
  const [row] = await db
    .select({
      id: surveys.id,
      slug: surveys.slug,
      status: surveys.status,
      versionId: surveyVersions.id,
      version: surveyVersions.version,
      title: surveyVersions.title,
      description: surveyVersions.description,
      schema: surveyVersions.schema,
    })
    .from(surveys)
    .innerJoin(surveyVersions, eq(surveyVersions.id, surveys.currentVersionId))
    .where(and(eq(surveys.slug, slug), eq(surveys.deleted, false)));
  if (!row) throw new AppError(404, "Survey not found");
  if (row.status === "closed") throw new AppError(410, "This survey is no longer accepting responses");
  if (row.status !== "published") throw new AppError(404, "Survey not found");
  const { status: _status, ...open } = row;
  return open;
};

/** An in-progress partial for this survey by resume token, with the version it was started on. */
export const findPartial = async (surveyId: string, token: string | null | undefined): Promise<PartialRow | null> => {
  if (!token) return null;
  const [row] = await db
    .select({
      responseId: responses.id,
      answers: responses.answers,
      versionId: surveyVersions.id,
      version: surveyVersions.version,
      title: surveyVersions.title,
      description: surveyVersions.description,
      schema: surveyVersions.schema,
    })
    .from(responses)
    .innerJoin(surveyVersions, eq(surveyVersions.id, responses.versionId))
    .where(and(eq(responses.resumeTokenHash, sha256(token)), eq(responses.surveyId, surveyId), eq(responses.status, "partial")));
  return row ?? null;
};

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Autosave. The first save creates the partial row and returns an opaque
 * resume token (only its SHA-256 is stored). Empty answer sets create nothing,
 * so simply opening the form never writes a row.
 */
export const saveDraft = async (survey: OpenSurvey, raw: Answers, resumeToken?: string | null) => {
  const partial = await findPartial(survey.id, resumeToken);
  const schema = partial?.schema ?? survey.schema;
  const result = validateAnswers(schema, raw, { partial: true });
  if (!result.valid) throw new AppError(422, "Some answers are invalid", answerErrors(result.errors));

  const savedAt = new Date();
  if (partial) {
    await db.update(responses).set({ answers: result.answers, updatedAt: savedAt }).where(eq(responses.id, partial.responseId));
    return { created: false, resumeToken: resumeToken!, savedAt };
  }
  if (!Object.values(result.answers).some(isAnswered)) return { created: false, resumeToken: null, savedAt: null };

  const token = randomToken();
  await db.insert(responses).values({
    surveyId: survey.id,
    versionId: survey.versionId,
    answers: result.answers,
    status: "partial",
    resumeTokenHash: sha256(token),
  });
  return { created: true, resumeToken: token, savedAt };
};

/**
 * Final submission, validated strictly against the version the respondent saw.
 * The partial row (if any) becomes the complete one, so each person counts once;
 * the guarded update (status = 'partial') makes a double submit insert a second
 * row rather than silently overwrite.
 */
export const submit = async (survey: OpenSurvey, raw: Answers, resumeToken?: string | null) => {
  const partial = await findPartial(survey.id, resumeToken);
  const schema = partial?.schema ?? survey.schema;
  const result = validateAnswers(schema, raw);
  if (!result.valid) throw new AppError(422, "Please fix the highlighted answers", answerErrors(result.errors));

  const now = new Date();
  if (partial) {
    const [row] = await db
      .update(responses)
      .set({ answers: result.answers, status: "complete", submittedAt: now, updatedAt: now, resumeTokenHash: null })
      .where(and(eq(responses.id, partial.responseId), eq(responses.status, "partial")))
      .returning({ id: responses.id });
    if (row) return row;
  }
  const [row] = await db
    .insert(responses)
    .values({ surveyId: survey.id, versionId: survey.versionId, answers: result.answers, status: "complete", submittedAt: now })
    .returning({ id: responses.id });
  return row;
};
