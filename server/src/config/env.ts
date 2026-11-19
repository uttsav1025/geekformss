import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// The ONLY reader of process.env. Everything else imports `env`.
// Loads server/.env then the repo-root .env (first match wins per variable).
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: [path.resolve(here, "../../.env"), path.resolve(here, "../../../.env")], quiet: true });

// `FOO=` in .env or `${FOO:-}` in compose must mean "unset", not "".
const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const int = (fallback: number, min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).default(fallback));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: int(4000, 1, 65535),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PG_POOL_MAX: int(10, 1, 100),

  // No defaults for secrets: a fallback literal would mean every deployment that
  // forgets them signs tokens with a public secret. 32+ chars ≈ 256 bits of base64.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  REFRESH_SECRET: z.string().min(32, "REFRESH_SECRET must be at least 32 characters"),
  // Short-lived access token in the Authorization header; long-lived refresh token in an httpOnly cookie.
  ACCESS_TOKEN_TTL_MINUTES: int(15, 1, 120),
  REFRESH_TOKEN_TTL_DAYS: int(7, 1, 90),
  // bcrypt cost. 12 ≈ 250 ms per hash on a modern core; lower only in tests.
  HASH_SALT_ROUND: int(12, 4, 15),

  // Comma-separated allow-list. "*" is accepted for local hacking only: browsers
  // refuse "*" together with credentials, so production must list real origins.
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Hops in front of the app (Render/Fly/nginx = 1) so rate limits see real client IPs.
  TRUST_PROXY: int(0, 0, 10),

  // Final survey submissions allowed per IP per 10 minutes (spam protection).
  SUBMIT_LIMIT: int(10, 1, 10000),
  // Partial (autosaved, never submitted) responses untouched this long are deleted
  // and never counted as "in progress".
  PARTIAL_TTL_DAYS: int(30, 1, 365),
  // Tests disable rate limiting unless this is set (to test the limiter itself).
  TEST_RATE_LIMIT: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()).transform((v) => v === "true"),

  // Demo seed account. Never applied in production without explicit values.
  DEMO_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
  DEMO_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
