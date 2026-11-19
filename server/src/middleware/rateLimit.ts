import { rateLimit } from "express-rate-limit";
import { env, isTest } from "../config/env.js";

const make = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => isTest && !env.TEST_RATE_LIMIT,
    message: { success: false, data: null, message },
  });

/** Broad API protection. */
export const apiLimiter = make(60 * 1000, 300, "Too many requests, slow down");
/** Brute-force protection for login / register / refresh. */
export const authLimiter = make(15 * 60 * 1000, 20, "Too many attempts, try again later");
/** Spam protection for final submissions (per IP). */
export const submitLimiter = make(10 * 60 * 1000, env.SUBMIT_LIMIT, "Too many submissions from this network, try again later");
/** Autosave fires often; generous but bounded. */
export const draftLimiter = make(60 * 1000, 60, "Saving too frequently");
