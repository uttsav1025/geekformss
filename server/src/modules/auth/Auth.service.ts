import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type Executor } from "../../config/db.js";
import { env } from "../../config/env.js";
import { users } from "../../db/schema/user.schema.js";
import { refreshTokens } from "../../db/schema/refreshToken.schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { REFRESH_TTL_MS, generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/tokenHelpers.js";
import type { LoginInput, RegisterInput } from "./Auth.schema.zod.js";

/** Every select/returning on users goes through this: the password hash never leaves the service. */
export const safeUserColumns = { id: users.id, name: users.name, email: users.email };
export type SafeUser = { id: string; name: string; email: string };

export interface Session {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

// Two tabs refreshing at the same moment both present the same token; the
// second one inside this window is treated as a race, not as theft.
const ROTATION_GRACE_MS = 10_000;

// Hash compared against when the email is unknown, so login time doesn't reveal
// whether an account exists. Built once, lazily, at the configured cost.
let timingGuardHash: string | undefined;
const timingGuard = () => (timingGuardHash ??= bcrypt.hashSync("timing-guard-password", env.HASH_SALT_ROUND));

// ── Sessions ─────────────────────────────────────────────────────────────────

const issueRefreshRow = async (executor: Executor, userId: string, familyId?: string) => {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const [row] = await executor
    .insert(refreshTokens)
    .values({ userId, familyId: familyId ?? sql`gen_random_uuid()`, expiresAt })
    .returning();
  return row;
};

const buildSession = (user: SafeUser, row: { id: string; familyId: string; expiresAt: Date }): Session => ({
  user,
  accessToken: generateAccessToken({ id: user.id }),
  refreshToken: generateRefreshToken({ id: user.id, jti: row.id, fam: row.familyId }),
  refreshExpiresAt: row.expiresAt,
});

/** Start a new session (new rotation family). */
export const startSession = async (user: SafeUser) => buildSession(user, await issueRefreshRow(db, user.id));

/**
 * Rotate a refresh token: revoke the presented one and issue its successor.
 * Presenting an already-rotated token outside the grace window means it was
 * copied — the whole family is revoked (committed before we reject).
 */
export const rotateSession = async (token: string): Promise<Session> => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(refreshTokens).where(eq(refreshTokens.id, payload.jti)).for("update");
    if (!row || row.userId !== payload.id || row.familyId !== payload.fam) return { kind: "invalid" as const };
    const now = new Date();

    if (row.revokedAt) {
      // Grace only covers a race with our own rotation: the token must have been
      // rotated (not revoked by logout) and its successor must still be live.
      // Otherwise a logged-out session could be revived for a few seconds.
      const [successor] = row.replacedBy
        ? await tx.select({ revokedAt: refreshTokens.revokedAt }).from(refreshTokens).where(eq(refreshTokens.id, row.replacedBy))
        : [];
      const withinGrace = successor && !successor.revokedAt && now.getTime() - row.revokedAt.getTime() < ROTATION_GRACE_MS;
      if (!withinGrace) {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: now })
          .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
        return { kind: "reused" as const };
      }
    }
    if (row.expiresAt <= now) return { kind: "invalid" as const };

    // Re-read the user: a deleted account loses access at its next refresh.
    const [user] = await tx.select(safeUserColumns).from(users).where(eq(users.id, row.userId));
    if (!user) return { kind: "invalid" as const };

    const next = await issueRefreshRow(tx, user.id, row.familyId);
    if (!row.revokedAt) {
      await tx.update(refreshTokens).set({ revokedAt: now, replacedBy: next.id }).where(eq(refreshTokens.id, row.id));
    }
    return { kind: "ok" as const, session: buildSession(user, next) };
  });

  if (outcome.kind === "reused") throw new AppError(401, "Session expired, please log in again");
  if (outcome.kind === "invalid") throw new AppError(401, "Invalid or expired refresh token");
  return outcome.session;
};

/** Revoke the presented token's whole family (logout). Silently ignores bad tokens. */
export const endSession = async (token: string | undefined) => {
  if (!token) return;
  try {
    const { fam } = verifyRefreshToken(token);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, fam), isNull(refreshTokens.revokedAt)));
  } catch {
    /* already invalid: nothing to revoke */
  }
};

// ── Accounts ─────────────────────────────────────────────────────────────────

export const registerUser = async ({ name, email, password }: RegisterInput): Promise<SafeUser> => {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  if (existing) throw new AppError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, env.HASH_SALT_ROUND);
  try {
    const [user] = await db.insert(users).values({ name, email, passwordHash }).returning(safeUserColumns);
    return user;
  } catch (error) {
    // Lost a race with a concurrent registration of the same email.
    if ((error as { code?: string }).code === "23505") throw new AppError(409, "An account with this email already exists");
    throw error;
  }
};

export const verifyCredentials = async ({ email, password }: LoginInput): Promise<SafeUser> => {
  const [user] = await db
    .select({ ...safeUserColumns, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  // Always run a bcrypt compare so unknown and known emails take the same time.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? timingGuard());
  if (!user || !ok) throw new AppError(401, "Invalid email or password");
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
};

export const getUserById = async (id: string): Promise<SafeUser | null> => {
  const [user] = await db.select(safeUserColumns).from(users).where(eq(users.id, id));
  return user ?? null;
};
