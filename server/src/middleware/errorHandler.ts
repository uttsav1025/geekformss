import type { NextFunction, Request, Response } from "express";
import { isProd } from "../config/env.js";
import { type FieldError, sendError } from "../utils/response.js";

export class AppError extends Error {
  constructor(
    public statusCode = 500,
    message = "Internal Server Error",
    public errors?: FieldError[],
  ) {
    super(message);
    this.name = "AppError";
  }
}

type PgError = Error & { code?: string; constraint?: string; type?: string; status?: number };

/** Global error handler. MUST be registered last. */
export const errorHandler = (err: PgError, _req: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: FieldError[] | undefined;

  if (err instanceof AppError) {
    ({ statusCode, message, errors } = err);
  } else if (err.code === "23505") {
    // Unique violation that slipped past an app-level check (concurrent insert).
    statusCode = 409;
    message = "A record with the provided information already exists";
  } else if (err.code === "22P02") {
    // Malformed uuid in a path: treat as "no such thing" rather than leaking parser details.
    statusCode = 404;
    message = "Not found";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Malformed JSON body";
  } else if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body too large";
  } else if (!isProd) {
    message = err.message; // never leak internals in production
  }

  if (statusCode >= 500) console.error("Unhandled error:", err);
  sendError(res, statusCode, message, errors);
};
