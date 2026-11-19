import type { Request } from "express";
import type { Meta } from "./response.js";

export const MAX_LIMIT = 100;

/** `?page=&limit=` with safe defaults; limit capped so a client can't ask for the whole table. */
/** A query-string value as an integer (arrays/objects from `?a[]=` count as absent). */
const queryInt = (v: unknown) => (typeof v === "string" ? Number.parseInt(v, 10) : Number.NaN);

export const getPagination = (req: Request, defaultLimit = 20) => {
  const page = Math.max(1, queryInt(req.query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, queryInt(req.query.limit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
};

export const buildMeta = (page: number, limit: number, total: number): Meta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
};
