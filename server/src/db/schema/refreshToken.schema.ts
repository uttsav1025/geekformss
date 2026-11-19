import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./user.schema.js";

/**
 * Server-side record of every refresh token, so they can be rotated and revoked.
 *
 * The refresh JWT carries this row's id as `jti` and its `familyId` as `fam`.
 * - Each refresh revokes the presented row and issues a new one in the same family.
 * - Presenting an already-revoked token means it was copied: the whole family
 *   is revoked, which logs out the thief and the victim alike.
 * - Logout revokes the family; a password change would revoke all of a user's families.
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedBy: uuid("replaced_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId), index("refresh_tokens_family_idx").on(t.familyId)],
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
