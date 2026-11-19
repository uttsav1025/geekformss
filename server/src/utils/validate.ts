import type { ZodType } from "zod";
import { AppError } from "../middleware/errorHandler.js";

/** Validate params / query / body explicitly in every handler; 422 with field errors on failure. */
export const parseOrThrow = <T>(schema: ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      422,
      "Validation failed",
      result.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })),
    );
  }
  return result.data;
};
