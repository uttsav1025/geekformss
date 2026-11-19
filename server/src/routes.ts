import { Router } from "express";
import authRouter from "./modules/auth/Auth.routes.js";
import surveyRouter from "./modules/survey/Survey.routes.js";
import publicRouter from "./modules/public/Public.routes.js";

// A module is invisible until it is mounted here.
const apiRouter = Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/surveys", surveyRouter);
apiRouter.use("/public", publicRouter);

export default apiRouter;
