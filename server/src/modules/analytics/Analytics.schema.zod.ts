import { z } from "zod";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** ?version=3 | ?version=all | omitted (current version). */
export const versionQuerySchema = z.object({
  version: z.preprocess(emptyToUndefined, z.union([z.literal("all"), z.coerce.number().int().positive()]).optional()),
});

export const textAnswersQuerySchema = versionQuerySchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});

export const textParamsSchema = z.object({
  id: z.uuid("Invalid survey id"),
  questionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid question id"),
});
