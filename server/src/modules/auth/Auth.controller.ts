import type { CookieOptions, NextFunction, Request, Response } from "express";
import { isProd } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { parseOrThrow } from "../../utils/validate.js";
import { loginSchema, refreshBodySchema, registerSchema } from "./Auth.schema.zod.js";
import * as authService from "./Auth.service.js";

export const REFRESH_COOKIE = "gf_refresh";

// clearCookie only matches a cookie with the same flags, so share them.
// Path-scoped to the auth routes: the refresh token is never sent anywhere else.
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict",
  path: "/api/v1/auth",
};

const setRefreshCookie = (res: Response, session: authService.Session) => {
  res.cookie(REFRESH_COOKIE, session.refreshToken, { ...refreshCookieOptions, expires: session.refreshExpiresAt });
};

// The refresh token stays in the cookie; the body carries only the access token.
const presentSession = (session: authService.Session) => ({ accessToken: session.accessToken, user: session.user });

const readRefreshToken = (req: Request): string | undefined => {
  const body = parseOrThrow(refreshBodySchema, req.body);
  return (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? body?.refreshToken;
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseOrThrow(registerSchema, req.body);
    const user = await authService.registerUser(input);
    const session = await authService.startSession(user);
    setRefreshCookie(res, session);
    sendSuccess(res, presentSession(session), "Account created", 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseOrThrow(loginSchema, req.body);
    const user = await authService.verifyCredentials(input);
    const session = await authService.startSession(user);
    setRefreshCookie(res, session);
    sendSuccess(res, presentSession(session), "Logged in");
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = readRefreshToken(req);
    if (!token) throw new AppError(401, "No refresh token");
    const session = await authService.rotateSession(token);
    setRefreshCookie(res, session);
    sendSuccess(res, presentSession(session), "Session refreshed");
  } catch (error) {
    // Any failure leaves the browser without a usable cookie.
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.endSession(readRefreshToken(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    sendSuccess(res, null, "Logged out");
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUserById(req.user!.id);
    if (!user) throw new AppError(401, "Account no longer exists");
    sendSuccess(res, user, "Current user");
  } catch (error) {
    next(error);
  }
};
