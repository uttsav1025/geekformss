import { z } from "zod";

// Normalise before validating so " Foo@X.com " and "foo@x.com" are one account.
const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).pipe(z.string().max(254));
const passwordField = z.string().min(8, "Password must be at least 8 characters").max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: emailField,
  password: passwordField,
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(128),
});

// Refresh token normally arrives in the httpOnly cookie; the body is a fallback
// for non-browser clients (scripts, mobile).
export const refreshBodySchema = z.object({ refreshToken: z.string().min(1).max(2048).optional() }).optional();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
