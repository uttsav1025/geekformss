import crypto from "node:crypto";

export const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/**
 * Public survey slug: readable prefix + random suffix. The suffix makes
 * collisions vanishingly rare and stops slugs being guessable from titles;
 * the unique constraint stays the authority (callers retry on 23505).
 */
export const surveySlug = (title: string) => {
  const base = slugify(title);
  const suffix = crypto.randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : `survey-${suffix}`;
};
