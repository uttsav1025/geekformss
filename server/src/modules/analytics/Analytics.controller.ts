import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler.js";
import { getPagination, buildMeta } from "../../utils/pagination.js";
import { sendPage, sendSuccess } from "../../utils/response.js";
import { parseOrThrow } from "../../utils/validate.js";
import { idParamSchema } from "../survey/Survey.schema.zod.js";
import * as surveyService from "../survey/Survey.service.js";
import { textAnswersQuerySchema, textParamsSchema, versionQuerySchema } from "./Analytics.schema.zod.js";
import * as analyticsService from "./Analytics.service.js";

/** Owner check shared by every analytics route; someone else's survey is a 404. */
const loadOwnedSurvey = async (req: Request, id: string) => {
  const survey = await surveyService.getSurvey(id, req.user!.id);
  if (!survey) throw new AppError(404, "Survey not found");
  return survey;
};

export const summary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const { version } = parseOrThrow(versionQuerySchema, req.query);
    const survey = await loadOwnedSurvey(req, id);
    const scope = await analyticsService.resolveScope(survey.id, version);
    sendSuccess(res, await analyticsService.buildAnalytics(survey, scope), "Analytics fetched");
  } catch (error) {
    next(error);
  }
};

export const textAnswers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, questionId } = parseOrThrow(textParamsSchema, req.params);
    const { version, search } = parseOrThrow(textAnswersQuerySchema, req.query);
    const pagination = getPagination(req);
    const survey = await loadOwnedSurvey(req, id);
    const scope = await analyticsService.resolveScope(survey.id, version);
    const { total, items } = await analyticsService.listTextAnswers(scope, { questionId, search, ...pagination });
    sendPage(res, items, buildMeta(pagination.page, pagination.limit, total), "Answers fetched");
  } catch (error) {
    next(error);
  }
};

export const csv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const { version } = parseOrThrow(versionQuerySchema, req.query);
    const survey = await loadOwnedSurvey(req, id);
    const scope = await analyticsService.resolveScope(survey.id, version);
    // A file download, deliberately outside the JSON envelope.
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${survey.slug}-responses.csv"`);
    res.send(await analyticsService.exportCsv(scope));
  } catch (error) {
    next(error);
  }
};
