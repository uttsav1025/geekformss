import { z } from "zod";

export const slugParamSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/, "Invalid survey link") });

export const resumeQuerySchema = z.object({ resume: z.string().max(100).optional() });

export const answersBodySchema = z.object({
  answers: z.record(z.string().max(64), z.unknown()).refine((a) => Object.keys(a).length <= 200, "Too many answers"),
  resumeToken: z.string().max(100).nullish(),
  // Honeypot: a hidden input real people never fill in.
  website: z.string().max(500).optional(),
});

export type AnswersBody = z.infer<typeof answersBodySchema>;
