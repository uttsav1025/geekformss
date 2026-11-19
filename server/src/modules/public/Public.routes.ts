import { Router } from "express";
import { draftLimiter, submitLimiter } from "../../middleware/rateLimit.js";
import * as publicController from "./Public.controller.js";

// No authentication: respondents are anonymous. Abuse control is rate limits + honeypot.
const publicRouter = Router();

publicRouter.get("/surveys/:slug", publicController.getForm);
publicRouter.put("/surveys/:slug/draft", draftLimiter, publicController.saveDraft);
publicRouter.post("/surveys/:slug/responses", submitLimiter, publicController.submit);

export default publicRouter;
