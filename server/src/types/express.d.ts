import type { AccessPayload } from "../utils/tokenHelpers.js";

// Typed req.user instead of (req as any).user.
declare global {
  namespace Express {
    interface Request {
      user?: AccessPayload;
    }
  }
}

export {};
