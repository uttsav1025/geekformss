import { Router } from "express";
import { authenticate } from "../../middleware/Auth.middleware.js";
import * as surveyController from "./Survey.controller.js";

const surveyRouter = Router();
surveyRouter.use(authenticate); // every survey-admin route is owner-scoped

// Literal paths BEFORE /:id so "stats" is never read as an id.
surveyRouter.get("/stats", surveyController.stats);
surveyRouter.get("/search", surveyController.search);
surveyRouter.get("/search/facets", surveyController.searchFacets);
surveyRouter.get("/", surveyController.list);
surveyRouter.post("/", surveyController.create);
surveyRouter.get("/:id/versions", surveyController.listVersions);
surveyRouter.get("/:id", surveyController.getById);
surveyRouter.patch("/:id", surveyController.update);
surveyRouter.post("/:id/publish", surveyController.publish);
surveyRouter.patch("/:id/status", surveyController.setStatus);
surveyRouter.delete("/:id", surveyController.remove);

export default surveyRouter;
