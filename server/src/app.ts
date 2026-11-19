import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { corsOrigins, env, isTest } from "./config/env.js";
import { pingDB } from "./config/db.js";
import { AppError, errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { sendError } from "./utils/response.js";
import apiRouter from "./routes.js";

export const createApp = () => {
  const app = express();
  if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);

  // Default helmet CSP: scripts only from our origin (the theme bootstrap is a file,
  // not inline), styles/fonts may come over https (Google Fonts), images self + data:.
  app.use(helmet());
  // "*" can't be combined with credentials (the refresh cookie), so it is only a dev convenience.
  app.use(cors({ origin: corsOrigins.includes("*") ? true : corsOrigins, credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  if (!isTest) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`));
      next();
    });
  }

  // Liveness: the process is up. Readiness: it can serve traffic (DB reachable).
  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" }, message: "Server is running" });
  });
  app.get("/ready", async (_req, res) => {
    try {
      await pingDB();
      res.json({ success: true, data: { status: "ready" }, message: "Ready" });
    } catch {
      sendError(res, 503, "Database unavailable");
    }
  });

  app.use("/api/v1", apiLimiter, apiRouter);
  // Unmatched API routes get the standard envelope, not an HTML page.
  app.use("/api", (req: Request, _res: Response, next: NextFunction) =>
    next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`)),
  );

  // Production: the built React app is served from the same origin (no CORS, one URL).
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler); // MUST be last
  return app;
};
