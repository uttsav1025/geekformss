import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/** Access token payload: just the user id. Name/email come from GET /auth/me. */
export interface AccessPayload {
  id: string;
}

/** Refresh token payload: user id, this token's row id (jti) and its rotation family. */
export interface RefreshPayload {
  id: string;
  jti: string;
  fam: string;
}

export const ACCESS_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MINUTES * 60;
export const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export const generateAccessToken = (payload: AccessPayload) =>
  jwt.sign({ id: payload.id }, env.JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS, algorithm: "HS256" });

export const generateRefreshToken = (payload: RefreshPayload) =>
  jwt.sign({ id: payload.id, jti: payload.jti, fam: payload.fam }, env.REFRESH_SECRET, {
    expiresIn: Math.floor(REFRESH_TTL_MS / 1000),
    algorithm: "HS256",
  });

// jwt.verify proves the signature, not the shape.
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export const verifyAccessToken = (token: string): AccessPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (!isObject(decoded) || typeof decoded.id !== "string") throw new jwt.JsonWebTokenError("Malformed token payload");
  return { id: decoded.id };
};

export const verifyRefreshToken = (token: string): RefreshPayload => {
  const decoded = jwt.verify(token, env.REFRESH_SECRET, { algorithms: ["HS256"] });
  if (
    !isObject(decoded) ||
    typeof decoded.id !== "string" ||
    typeof decoded.jti !== "string" ||
    typeof decoded.fam !== "string"
  ) {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }
  return { id: decoded.id, jti: decoded.jti, fam: decoded.fam };
};

/** Opaque random token (survey resume links); only its hash is stored. */
export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
