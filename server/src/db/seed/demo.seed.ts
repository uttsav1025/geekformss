// Demo account + a published survey with conditional logic and ~80 realistic
// responses over the last three weeks, plus a draft survey.
//
//   npm run db:seed:demo -w server            idempotent: an existing demo account is left untouched
//   npm run db:seed:demo -w server -- --reset  delete the demo account's data and recreate it
//
// Credentials come from DEMO_EMAIL / DEMO_PASSWORD (never CLI args). Outside
// production they default to the documented demo login.
import path from "node:path";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { type Answers, type SurveySchema, validateAnswers, validateSurveySchema } from "@survey/shared";
import { db, pool } from "../../config/db.js";
import { env, isProd } from "../../config/env.js";
import { users } from "../schema/user.schema.js";
import { surveyVersions, surveys } from "../schema/survey.schema.js";
import { responses } from "../schema/response.schema.js";
import { migrate } from "../migrate.js";

const feedbackSchema: SurveySchema = {
  questions: [
    {
      id: "q_used",
      type: "single",
      label: "Have you used our product in the last month?",
      required: true,
      options: [
        { id: "o_yes", label: "Yes" },
        { id: "o_no", label: "No" },
      ],
    },
    {
      id: "q_features",
      type: "multi",
      label: "Which features did you use?",
      required: true,
      condition: { questionId: "q_used", operator: "equals", value: "o_yes" },
      options: [
        { id: "o_builder", label: "Survey builder" },
        { id: "o_logic", label: "Conditional logic" },
        { id: "o_analytics", label: "Analytics dashboard" },
        { id: "o_export", label: "CSV export" },
      ],
    },
    {
      id: "q_sat",
      type: "rating",
      label: "How satisfied are you overall?",
      required: true,
      condition: { questionId: "q_used", operator: "equals", value: "o_yes" },
    },
    {
      id: "q_improve",
      type: "text",
      label: "What should we improve first?",
      required: true,
      multiline: true,
      description: "Shown only to respondents who rated 3 or lower.",
      condition: { questionId: "q_sat", operator: "lte", value: 3 },
    },
    {
      id: "q_why_not",
      type: "single",
      label: "What's kept you away?",
      required: false,
      condition: { questionId: "q_used", operator: "equals", value: "o_no" },
      options: [
        { id: "o_time", label: "No time" },
        { id: "o_alt", label: "Using another tool" },
        { id: "o_price", label: "Pricing" },
        { id: "o_other", label: "Something else" },
      ],
    },
    {
      id: "q_role",
      type: "single",
      label: "Which best describes your role?",
      required: true,
      options: [
        { id: "o_pm", label: "Product manager" },
        { id: "o_research", label: "Researcher" },
        { id: "o_eng", label: "Engineer" },
        { id: "o_mkt", label: "Marketing" },
      ],
    },
    { id: "q_nps", type: "rating", label: "How likely are you to recommend us to a colleague?", required: true },
    { id: "q_comments", type: "text", label: "Anything else you want to tell us?", required: false },
  ],
};

const rsvpSchema: SurveySchema = {
  questions: [
    {
      id: "q_attend",
      type: "single",
      label: "Will you attend?",
      required: true,
      options: [
        { id: "o_y", label: "Yes" },
        { id: "o_n", label: "No" },
      ],
    },
    {
      id: "q_diet",
      type: "multi",
      label: "Dietary needs",
      required: false,
      condition: { questionId: "q_attend", operator: "equals", value: "o_y" },
      options: [
        { id: "o_veg", label: "Vegetarian" },
        { id: "o_vegan", label: "Vegan" },
        { id: "o_gf", label: "Gluten-free" },
      ],
    },
  ],
};

const improvements = [
  "More chart types in analytics",
  "Let me schedule a survey to close automatically",
  "Templates to start from",
  "Branching on multiple conditions at once",
  "Slack notifications for new responses",
  "Better mobile layout for the builder",
  "Custom thank-you page",
  "Faster loading on big surveys",
  "Bulk-edit options",
  "Export to Google Sheets",
];
const comments = [
  "Great tool, the conditional logic saved us a lot of time.",
  "Love how simple publishing is.",
  "Would pay for team accounts.",
  "Analytics page is clean.",
  "Keep it up!",
  "The autosave feature is a lifesaver for long surveys.",
  "Please add dark mode for the public form.",
  "Our team switched from spreadsheets to this.",
];

const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const weighted = <T>(pairs: [T, number][]) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};

function fakeAnswers(): Answers {
  const a: Answers = {};
  a.q_used = weighted([
    ["o_yes", 78],
    ["o_no", 22],
  ]);
  if (a.q_used === "o_yes") {
    const features = ["o_builder", "o_logic", "o_analytics", "o_export"].filter(
      (_, i) => Math.random() < [0.92, 0.55, 0.7, 0.3][i],
    );
    a.q_features = features.length ? features : ["o_builder"];
    a.q_sat = weighted([
      [1, 3],
      [2, 6],
      [3, 14],
      [4, 40],
      [5, 37],
    ]);
    if ((a.q_sat as number) <= 3) a.q_improve = pick(improvements);
  } else if (Math.random() < 0.8) {
    a.q_why_not = weighted([
      ["o_time", 45],
      ["o_alt", 30],
      ["o_price", 15],
      ["o_other", 10],
    ]);
  }
  a.q_role = weighted([
    ["o_pm", 35],
    ["o_research", 30],
    ["o_eng", 20],
    ["o_mkt", 15],
  ]);
  a.q_nps = weighted([
    [1, 2],
    [2, 4],
    [3, 14],
    [4, 38],
    [5, 42],
  ]);
  if (Math.random() < 0.3) a.q_comments = pick(comments);
  return a;
}

export const seedDemo = async ({ reset = false } = {}) => {
  if (isProd && (!env.DEMO_EMAIL || !env.DEMO_PASSWORD)) {
    throw new Error("DEMO_EMAIL and DEMO_PASSWORD must be set to seed demo data in production");
  }
  const email = (env.DEMO_EMAIL ?? "demo@geekforms.dev").toLowerCase();
  const password = env.DEMO_PASSWORD ?? "demo12345";
  for (const s of [feedbackSchema, rsvpSchema]) {
    const { valid, errors } = validateSurveySchema(s);
    if (!valid) throw new Error(`Seed schema invalid: ${errors[0].message}`);
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  if (existing && !reset) {
    console.log(`${email} already exists, leaving it untouched (pass --reset to recreate)`);
    return;
  }

  await db.transaction(async (tx) => {
    // Cascades remove the account's surveys, versions, responses and refresh tokens.
    await tx.delete(users).where(sql`lower(${users.email}) = ${email}`);

    const [user] = await tx
      .insert(users)
      .values({ name: "Demo Admin", email, passwordHash: await bcrypt.hash(password, env.HASH_SALT_ROUND) })
      .returning({ id: users.id });

    const title = "Product feedback — Q4";
    const description = "Help us shape the roadmap. Takes about 2 minutes. Questions adapt to your answers.";
    const [survey] = await tx
      .insert(surveys)
      .values({
        ownerId: user.id,
        slug: "product-feedback-demo",
        title,
        description,
        draftSchema: feedbackSchema,
        status: "published",
      })
      .returning({ id: surveys.id });
    const [version] = await tx
      .insert(surveyVersions)
      .values({
        surveyId: survey.id,
        version: 1,
        title,
        description,
        schema: feedbackSchema,
        publishedAt: sql`now() - interval '21 days'`,
      })
      .returning({ id: surveyVersions.id });
    await tx.update(surveys).set({ currentVersionId: version.id }).where(eq(surveys.id, survey.id));

    const completed = Array.from({ length: 80 }, () => {
      const { answers } = validateAnswers(feedbackSchema, fakeAnswers());
      // Skewed toward recent days.
      const secs = Math.floor(21 * Math.random() ** 1.6) * 86400 + Math.floor(Math.random() * 86400);
      const at = sql`now() - make_interval(secs => ${secs})`;
      return {
        surveyId: survey.id,
        versionId: version.id,
        answers,
        status: "complete" as const,
        createdAt: at,
        updatedAt: at,
        submittedAt: at,
      };
    });
    await tx.insert(responses).values(completed);
    await tx.insert(responses).values(
      Array.from({ length: 6 }, () => ({
        surveyId: survey.id,
        versionId: version.id,
        answers: { q_used: "o_yes" },
        status: "partial" as const,
      })),
    );

    await tx.insert(surveys).values({
      ownerId: user.id,
      slug: "event-signup-demo",
      title: "Team offsite RSVP",
      description: "Draft — not published yet.",
      draftSchema: rsvpSchema,
    });
  });
  console.log(`Seeded. Log in with ${email}${isProd ? "" : ` / ${password}`}`);
  console.log("Public survey: /s/product-feedback-demo");
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  migrate()
    .then(() => seedDemo({ reset: process.argv.includes("--reset") }))
    .then(() => pool.end())
    .catch((error) => {
      console.error("Demo seed failed:", error);
      process.exit(1);
    });
}
