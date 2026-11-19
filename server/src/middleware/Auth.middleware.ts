import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/tokenHelpers.js";
import { sendError } from "../utils/response.js";

/** Require `Authorization: Bearer <access token>`; sets the typed `req.user`. */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    sendError(res, 401, "Authentication required");
    return;
  }
  try {
    req.user = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch {
    // Same message for expired and forged: the client's response is identical (refresh, then retry).
    sendError(res, 401, "Invalid or expired token");
  }
};
