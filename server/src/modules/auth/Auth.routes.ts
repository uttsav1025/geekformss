import { Router } from "express";
import { authenticate } from "../../middleware/Auth.middleware.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import * as authController from "./Auth.controller.js";

const authRouter = Router();

// ── Public ───────────────────────────────────────────────────────────────────
authRouter.post("/register", authLimiter, authController.register);
authRouter.post("/login", authLimiter, authController.login);
authRouter.post("/refresh", authLimiter, authController.refresh);
authRouter.post("/logout", authController.logout);

// ── Signed in ────────────────────────────────────────────────────────────────
authRouter.get("/me", authenticate, authController.me);

export default authRouter;
