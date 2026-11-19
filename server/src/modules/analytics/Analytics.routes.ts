import { Router } from "express";
import { authenticate } from "../../middleware/Auth.middleware.js";
import * as analyticsController from "./Analytics.controller.js";

// Mounted under /surveys alongside the survey router: results are sub-resources of a survey.
const analyticsRouter = Router();
analyticsRouter.use(authenticate);

analyticsRouter.get("/:id/analytics", analyticsController.summary);
analyticsRouter.get("/:id/analytics/text/:questionId", analyticsController.textAnswers);
analyticsRouter.get("/:id/responses.csv", analyticsController.csv);

export default analyticsRouter;
