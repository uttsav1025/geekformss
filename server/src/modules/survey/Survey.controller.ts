import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler.js";
import { getPagination } from "../../utils/pagination.js";
import { sendPage, sendSuccess } from "../../utils/response.js";
import { parseOrThrow } from "../../utils/validate.js";
import {
  createSurveySchema,
  idParamSchema,
  listSurveysQuerySchema,
  searchSurveysQuerySchema,
  setStatusSchema,
  updateSurveySchema,
} from "./Survey.schema.zod.js";
import * as surveyService from "./Survey.service.js";
import * as surveySearch from "./Survey.search.js";

const ownerId = (req: Request) => req.user!.id;
const notFound = () => new AppError(404, "Survey not found"); // also for someone else's survey

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = getPagination(req);
    const query = parseOrThrow(listSurveysQuerySchema, req.query);
    const result = await surveyService.listSurveys({ ownerId: ownerId(req), ...pagination, ...query });
    sendPage(res, result.data, result.meta, "Surveys fetched");
  } catch (error) {
    next(error);
  }
};

/** GET /surveys/search — the table's search: one page of matches. */
export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = getPagination(req, 25);
    const query = parseOrThrow(searchSurveysQuerySchema, req.query);
    const result = await surveySearch.searchSurveys({ ownerId: ownerId(req), ...pagination, ...query });
    sendPage(res, result.data, result.meta, "Search results");
  } catch (error) {
    next(error);
  }
};

/** GET /surveys/search/facets — contextual counts for the filter pills, same query. */
export const searchFacets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sort: _sort, ...query } = parseOrThrow(searchSurveysQuerySchema, req.query);
    sendSuccess(res, await surveySearch.searchFacets({ ownerId: ownerId(req), ...query }), "Search facets");
  } catch (error) {
    next(error);
  }
};

export const stats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await surveyService.ownerStats(ownerId(req)), "Activity fetched");
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseOrThrow(createSurveySchema, req.body);
    sendSuccess(res, await surveyService.createSurvey(ownerId(req), input), "Survey created", 201);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const survey = await surveyService.getSurvey(id, ownerId(req));
    if (!survey) throw notFound();
    sendSuccess(res, survey, "Survey fetched");
  } catch (error) {
    next(error);
  }
};

export const listVersions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    if (!(await surveyService.getSurvey(id, ownerId(req)))) throw notFound();
    sendSuccess(res, await surveyService.listVersions(id), "Versions fetched");
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const input = parseOrThrow(updateSurveySchema, req.body);
    const survey = await surveyService.updateDraft(id, ownerId(req), input);
    if (!survey) throw notFound();
    sendSuccess(res, survey, "Draft saved");
  } catch (error) {
    next(error);
  }
};

export const publish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const survey = await surveyService.publishSurvey(id, ownerId(req));
    if (!survey) throw notFound();
    sendSuccess(res, survey, `Version ${survey.currentVersion?.version} is live`);
  } catch (error) {
    next(error);
  }
};

export const setStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const { status } = parseOrThrow(setStatusSchema, req.body);
    const survey = await surveyService.setStatus(id, ownerId(req), status);
    if (!survey) throw notFound();
    sendSuccess(res, survey, status === "closed" ? "Survey closed" : "Survey reopened");
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    if (!(await surveyService.softDeleteSurvey(id, ownerId(req)))) throw notFound();
    sendSuccess(res, null, "Survey deleted");
  } catch (error) {
    next(error);
  }
};
