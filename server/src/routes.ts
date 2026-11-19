import { Router } from "express";
import authRouter from "./modules/auth/Auth.routes.js";

// A module is invisible until it is mounted here.
const apiRouter = Router();
apiRouter.use("/auth", authRouter);

export default apiRouter;
