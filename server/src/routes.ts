import { Router } from "express";
import authRouter from "./modules/auth/Auth.routes.js";
import surveyRouter from "./modules/survey/Survey.routes.js";

// A module is invisible until it is mounted here.
const apiRouter = Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/surveys", surveyRouter);

export default apiRouter;
