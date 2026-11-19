import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import { parseOrThrow } from "../../utils/validate.js";
import { answersBodySchema, resumeQuerySchema, slugParamSchema } from "./Public.schema.zod.js";
import * as publicService from "./Public.service.js";

const presentForm = (src: { version: number; title: string; description: string; schema: unknown }, slug: string) => ({
  slug,
  title: src.title,
  description: src.description,
  version: src.version,
  schema: src.schema,
});

/** The live form. With a valid resume token: the version that partial started on, plus saved answers. */
export const getForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = parseOrThrow(slugParamSchema, req.params);
    const { resume } = parseOrThrow(resumeQuerySchema, req.query);
    const survey = await publicService.loadOpenSurvey(slug);
    const partial = await publicService.findPartial(survey.id, resume);
    sendSuccess(
      res,
      {
        survey: presentForm(partial ?? survey, survey.slug),
        resume: partial ? { token: resume, answers: partial.answers } : null,
      },
      "Survey fetched",
    );
  } catch (error) {
    next(error);
  }
};

export const saveDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = parseOrThrow(slugParamSchema, req.params);
    const body = parseOrThrow(answersBodySchema, req.body);
    const survey = await publicService.loadOpenSurvey(slug);
    if (body.website) {
      sendSuccess(res, { resumeToken: null, savedAt: new Date() }, "Saved"); // honeypot: pretend
      return;
    }
    const result = await publicService.saveDraft(survey, body.answers, body.resumeToken);
    sendSuccess(res, { resumeToken: result.resumeToken, savedAt: result.savedAt }, "Saved", result.created ? 201 : 200);
  } catch (error) {
    next(error);
  }
};

export const submit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = parseOrThrow(slugParamSchema, req.params);
    const body = parseOrThrow(answersBodySchema, req.body);
    const survey = await publicService.loadOpenSurvey(slug);
    if (body.website) {
      // Bots get a believable success so they don't learn to skip the honeypot.
      sendSuccess(res, { id: crypto.randomUUID() }, "Response recorded", 201);
      return;
    }
    sendSuccess(res, await publicService.submit(survey, body.answers, body.resumeToken), "Response recorded", 201);
  } catch (error) {
    next(error);
  }
};
