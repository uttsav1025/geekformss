// Integration tests against a real Postgres (DATABASE_URL). Each run creates
// its own users and removes them afterwards, so it is safe on a dev database.
process.env.NODE_ENV = "test";
process.env.HASH_SALT_ROUND ??= "4"; // fast bcrypt in tests

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { sql } from "drizzle-orm";

const { createApp } = await import("../src/app.js");
const { migrate } = await import("../src/db/migrate.js");
const { db, pool } = await import("../src/config/db.js");
const { purgeStalePartials } = await import("../src/modules/response/Response.service.js");

const app = createApp();
const API = "/api/v1";
const stamp = Date.now();
const email = `test-${stamp}@example.com`;
let token = "";
let surveyId = "";
let slug = "";
const auth = () => ({ Authorization: `Bearer ${token}` });
const refreshCookie = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers["set-cookie"] ?? [])
    .find((c) => c.startsWith("gf_refresh="))
    ?.split(";")[0] ?? "";

const schema = {
  questions: [
    {
      id: "q_pet",
      type: "single",
      label: "Do you own a pet?",
      required: true,
      options: [
        { id: "o_yes", label: "Yes" },
        { id: "o_no", label: "No" },
      ],
    },
    {
      id: "q_kind",
      type: "multi",
      label: "Which kinds?",
      required: true,
      options: [
        { id: "o_dog", label: "Dog" },
        { id: "o_cat", label: "Cat" },
      ],
      condition: { questionId: "q_pet", operator: "equals", value: "o_yes" },
    },
    { id: "q_rate", type: "rating", label: "Rate us", required: true },
    { id: "q_note", type: "text", label: "Anything else?", required: false },
  ],
};

before(async () => {
  await migrate();
  const res = await request(app).post(`${API}/auth/register`).send({ name: "Tester", email, password: "password123" });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  token = res.body.data.accessToken;
});

after(async () => {
  await db.execute(sql`DELETE FROM users WHERE email LIKE 'test-%@example.com'`);
  await pool.end();
});

// ── Contract ─────────────────────────────────────────────────────────────────

test("envelope: success, error and unknown route", async () => {
  const unauth = await request(app).get(`${API}/surveys`);
  assert.equal(unauth.status, 401);
  assert.deepEqual(Object.keys(unauth.body).sort(), ["data", "message", "success"]);
  assert.equal(unauth.body.success, false);

  const missing = await request(app).get(`${API}/nope`);
  assert.equal(missing.status, 404);
  assert.match(missing.body.message, /Route not found/);

  const health = await request(app).get("/health");
  assert.equal(health.body.data.status, "ok");
  const ready = await request(app).get("/ready");
  assert.equal(ready.body.data.status, "ready");
});

test("validation failures are 422 with field errors", async () => {
  const res = await request(app).post(`${API}/auth/register`).send({ name: "", email: "nope", password: "x" });
  assert.equal(res.status, 422);
  const fields = res.body.errors.map((e: { field: string }) => e.field).sort();
  assert.deepEqual(fields, ["email", "name", "password"]);
});

// ── Auth ─────────────────────────────────────────────────────────────────────

test("login never returns the password hash; bad password is 401", async () => {
  const bad = await request(app).post(`${API}/auth/login`).send({ email, password: "wrongpass1" });
  assert.equal(bad.status, 401);
  const good = await request(app)
    .post(`${API}/auth/login`)
    .send({ email: ` ${email.toUpperCase()} `, password: "password123" });
  assert.equal(good.status, 200);
  assert.deepEqual(Object.keys(good.body.data.user).sort(), ["email", "id", "name"]);
  assert.ok(refreshCookie(good), "refresh cookie set");
  assert.match(String(good.headers["set-cookie"]), /HttpOnly/i);
  const me = await request(app)
    .get(`${API}/auth/me`)
    .set({ Authorization: `Bearer ${good.body.data.accessToken}` });
  assert.equal(me.body.data.email, email);
});

test("refresh rotates the token; reusing an old one revokes the family", async () => {
  const login = await request(app).post(`${API}/auth/login`).send({ email, password: "password123" });
  const first = refreshCookie(login);

  const r1 = await request(app).post(`${API}/auth/refresh`).set("Cookie", first);
  assert.equal(r1.status, 200);
  const second = refreshCookie(r1);
  assert.ok(second && second !== first, "rotated to a new token");
  assert.ok(r1.body.data.accessToken);

  // Age the rotation past the concurrency grace window, then replay the first token.
  await db.execute(sql`UPDATE refresh_tokens SET revoked_at = now() - interval '1 minute'
    WHERE revoked_at IS NOT NULL AND user_id = (SELECT id FROM users WHERE email = ${email})`);
  const replay = await request(app).post(`${API}/auth/refresh`).set("Cookie", first);
  assert.equal(replay.status, 401);
  // ...which also killed the legitimate successor.
  const victim = await request(app).post(`${API}/auth/refresh`).set("Cookie", second);
  assert.equal(victim.status, 401);
});

test("logout revokes the session", async () => {
  const login = await request(app).post(`${API}/auth/login`).send({ email, password: "password123" });
  const cookie = refreshCookie(login);
  const out = await request(app).post(`${API}/auth/logout`).set("Cookie", cookie);
  assert.equal(out.status, 200);
  const after = await request(app).post(`${API}/auth/refresh`).set("Cookie", cookie);
  assert.equal(after.status, 401);
});

test("a just-rotated token can't revive a logged-out session (grace window)", async () => {
  const login = await request(app).post(`${API}/auth/login`).send({ email, password: "password123" });
  const original = refreshCookie(login);
  const rotated = refreshCookie(await request(app).post(`${API}/auth/refresh`).set("Cookie", original));
  // Inside the concurrency grace window a second tab may still present `original`...
  assert.equal((await request(app).post(`${API}/auth/refresh`).set("Cookie", original)).status, 200);
  // ...but once the user logs out, neither token works, even within the window.
  await request(app).post(`${API}/auth/logout`).set("Cookie", rotated);
  assert.equal((await request(app).post(`${API}/auth/refresh`).set("Cookie", original)).status, 401);
  assert.equal((await request(app).post(`${API}/auth/refresh`).set("Cookie", rotated)).status, 401);
});

// ── Surveys ──────────────────────────────────────────────────────────────────

test("create, save draft, publish", async () => {
  const created = await request(app).post(`${API}/surveys`).set(auth()).send({ title: "Pet survey", description: "About pets" });
  assert.equal(created.status, 201);
  surveyId = created.body.data.id;
  slug = created.body.data.slug;
  assert.equal(created.body.data.status, "draft");

  assert.equal((await request(app).get(`${API}/public/surveys/${slug}`)).status, 404); // not public yet
  assert.equal((await request(app).post(`${API}/surveys/${surveyId}/publish`).set(auth())).status, 422); // no questions

  const saved = await request(app).patch(`${API}/surveys/${surveyId}`).set(auth()).send({ schema });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.schema.questions.length, 4);

  const pub = await request(app).post(`${API}/surveys/${surveyId}/publish`).set(auth());
  assert.equal(pub.status, 200);
  assert.equal(pub.body.data.status, "published");
  assert.equal(pub.body.data.currentVersion.version, 1);
  assert.equal(pub.body.data.hasUnpublishedChanges, false);
});

test("publish rejects a semantically invalid schema with field errors", async () => {
  const bad = structuredClone(schema);
  (bad.questions[1].condition as { value: string }).value = "o_missing";
  await request(app).patch(`${API}/surveys/${surveyId}`).set(auth()).send({ schema: bad });
  const pub = await request(app).post(`${API}/surveys/${surveyId}/publish`).set(auth());
  assert.equal(pub.status, 422);
  assert.match(pub.body.message, /option that no longer exists/);
  assert.equal(pub.body.errors[0].field, "q_kind");
  await request(app).patch(`${API}/surveys/${surveyId}`).set(auth()).send({ schema });
});

test("list is paginated with meta; other users get 404", async () => {
  const list = await request(app).get(`${API}/surveys?limit=1&page=1&search=pet`).set(auth());
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
  assert.deepEqual(list.body.meta, { page: 1, limit: 1, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false });
  // LIKE wildcards are literal
  const wild = await request(app).get(`${API}/surveys?search=%25`).set(auth());
  assert.equal(wild.body.meta.total, 0);

  const other = await request(app)
    .post(`${API}/auth/register`)
    .send({ name: "Other", email: `test-other-${stamp}@example.com`, password: "password123" });
  const res = await request(app)
    .get(`${API}/surveys/${surveyId}`)
    .set({ Authorization: `Bearer ${other.body.data.accessToken}` });
  assert.equal(res.status, 404);
});

// ── Table search ─────────────────────────────────────────────────────────────

test("search: terms, status words, facet filters, scope and contextual counts", async () => {
  // A separate account, so the counts only see the surveys made here.
  const reg = await request(app)
    .post(`${API}/auth/register`)
    .send({ name: "Searcher", email: `test-search-${stamp}@example.com`, password: "password123" });
  const h = { Authorization: `Bearer ${reg.body.data.accessToken}` };
  const make = async (title: string) => {
    const r = await request(app).post(`${API}/surveys`).set(h).send({ title });
    await request(app).patch(`${API}/surveys/${r.body.data.id}`).set(h).send({ schema });
    return r.body.data as { id: string; slug: string };
  };
  await make("Alpha launch"); // draft
  const beta = await make("Beta feedback");
  const gamma = await make("Gamma retro");
  await request(app).post(`${API}/surveys/${beta.id}/publish`).set(h);
  await request(app).post(`${API}/surveys/${gamma.id}/publish`).set(h);
  await request(app).patch(`${API}/surveys/${gamma.id}/status`).set(h).send({ status: "closed" });
  const sent = await request(app)
    .post(`${API}/public/surveys/${beta.slug}/responses`)
    .send({ answers: { q_pet: "o_no", q_rate: 4 } });
  assert.equal(sent.status, 201);
  // Edit after publishing: Beta now has unpublished changes.
  await request(app).patch(`${API}/surveys/${beta.id}`).set(h).send({ title: "Beta feedback v2" });

  const find = async (query: string) => {
    const r = await request(app).get(`${API}/surveys/search?${query}`).set(h);
    assert.equal(r.status, 200);
    return (r.body.data as { title: string }[]).map((x) => x.title).sort();
  };
  assert.deepEqual(await find("q=alpha"), ["Alpha launch"]);
  assert.deepEqual(await find("q=live"), ["Beta feedback v2"]); // status word
  assert.deepEqual(await find("q=beta%20feed"), ["Beta feedback v2"]); // every term must match
  assert.deepEqual(await find("q=beta%20zzz"), []);
  assert.deepEqual(await find("q=%25"), []); // LIKE wildcards are literal
  assert.deepEqual(await find("status=draft&status=closed"), ["Alpha launch", "Gamma retro"]);
  assert.deepEqual(await find("responses=with"), ["Beta feedback v2"]);
  assert.deepEqual(await find("responses=none&status=closed"), ["Gamma retro"]);
  assert.deepEqual(await find("unpublished=true"), ["Beta feedback v2"]);
  assert.deepEqual(await find("scope=published"), ["Beta feedback v2"]);

  const paged = await request(app).get(`${API}/surveys/search?limit=2&sort=title`).set(h);
  assert.deepEqual(
    paged.body.data.map((x: { title: string }) => x.title),
    ["Alpha launch", "Beta feedback v2"],
  );
  assert.equal(paged.body.meta.total, 3);
  assert.equal(paged.body.meta.hasNextPage, true);

  const facets = async (query: string) => (await request(app).get(`${API}/surveys/search/facets?${query}`).set(h)).body.data;
  assert.deepEqual(await facets(""), {
    baseTotal: 3,
    status: { draft: 1, published: 1, closed: 1 },
    statusAll: 3,
    responses: { any: 3, with: 1, none: 2 },
    unpublished: 1,
    anyUnpublished: true,
  });
  // Counts are contextual: each facet ignores its own selection, honours the others.
  const drafts = await facets("status=draft");
  assert.equal(drafts.status.published, 1);
  assert.deepEqual(drafts.responses, { any: 1, with: 0, none: 1 });
  const searched = await facets("q=gamma");
  assert.equal(searched.baseTotal, 3); // before search
  assert.equal(searched.statusAll, 1);

  const bad = await request(app).get(`${API}/surveys/search?responses=maybe`).set(h);
  assert.equal(bad.status, 422);
  assert.equal((await request(app).get(`${API}/surveys/search`)).status, 401);
});

// ── Public form ──────────────────────────────────────────────────────────────

test("public submit validates required + conditional fields", async () => {
  const pub = await request(app).get(`${API}/public/surveys/${slug}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.data.survey.version, 1);

  const missing = await request(app)
    .post(`${API}/public/surveys/${slug}/responses`)
    .send({ answers: { q_pet: "o_yes", q_rate: 4 } });
  assert.equal(missing.status, 422);
  assert.ok(missing.body.errors.some((e: { field: string }) => e.field === "q_kind"));

  const badType = await request(app)
    .post(`${API}/public/surveys/${slug}/responses`)
    .send({ answers: { q_pet: "o_no", q_rate: 9 } });
  assert.equal(badType.status, 422);

  assert.equal(
    (
      await request(app)
        .post(`${API}/public/surveys/${slug}/responses`)
        .send({ answers: { q_pet: "o_yes", q_kind: ["o_dog", "o_cat"], q_rate: 5, q_note: "Love it" } })
    ).status,
    201,
  );
  // Hidden answer (q_kind with q_pet=No) is stripped server-side.
  assert.equal(
    (
      await request(app)
        .post(`${API}/public/surveys/${slug}/responses`)
        .send({ answers: { q_pet: "o_no", q_kind: ["o_dog"], q_rate: 2 } })
    ).status,
    201,
  );
});

test("honeypot submissions are silently dropped", async () => {
  const res = await request(app)
    .post(`${API}/public/surveys/${slug}/responses`)
    .send({ answers: { q_pet: "o_no", q_rate: 1 }, website: "http://spam" });
  assert.equal(res.status, 201);
  const a = await request(app).get(`${API}/surveys/${surveyId}/analytics`).set(auth());
  assert.equal(a.body.data.totals.responses, 2);
});

test("partial save, resume, then complete", async () => {
  const empty = await request(app).put(`${API}/public/surveys/${slug}/draft`).send({ answers: {} });
  assert.equal(empty.body.data.resumeToken, null);

  const first = await request(app)
    .put(`${API}/public/surveys/${slug}/draft`)
    .send({ answers: { q_pet: "o_yes" } });
  assert.equal(first.status, 201);
  const rt = first.body.data.resumeToken;
  assert.ok(rt);
  assert.equal(
    (
      await request(app)
        .put(`${API}/public/surveys/${slug}/draft`)
        .send({ answers: { q_pet: "o_yes", q_kind: ["o_cat"] }, resumeToken: rt })
    ).status,
    200,
  );

  const resumed = await request(app).get(`${API}/public/surveys/${slug}?resume=${rt}`);
  assert.deepEqual(resumed.body.data.resume.answers, { q_pet: "o_yes", q_kind: ["o_cat"] });

  let a = await request(app).get(`${API}/surveys/${surveyId}/analytics`).set(auth());
  assert.equal(a.body.data.totals.partial, 1);

  assert.equal(
    (
      await request(app)
        .post(`${API}/public/surveys/${slug}/responses`)
        .send({ answers: { q_pet: "o_yes", q_kind: ["o_cat"], q_rate: 4 }, resumeToken: rt })
    ).status,
    201,
  );
  a = await request(app).get(`${API}/surveys/${surveyId}/analytics`).set(auth());
  assert.equal(a.body.data.totals.partial, 0);
  assert.equal(a.body.data.totals.responses, 3);
  assert.equal((await request(app).get(`${API}/public/surveys/${slug}?resume=${rt}`)).body.data.resume, null); // single-use
});

// ── Analytics ────────────────────────────────────────────────────────────────

test("analytics aggregates per question; text answers are paginated", async () => {
  const res = await request(app).get(`${API}/surveys/${surveyId}/analytics`).set(auth());
  const byId = Object.fromEntries(res.body.data.questions.map((q: { id: string }) => [q.id, q]));
  assert.deepEqual(
    byId.q_pet.options.map((o: { label: string; count: number }) => [o.label, o.count]),
    [
      ["Yes", 2],
      ["No", 1],
    ],
  );
  assert.deepEqual(
    byId.q_kind.options.map((o: { label: string; count: number }) => [o.label, o.count]),
    [
      ["Dog", 1],
      ["Cat", 2],
    ],
  );
  assert.equal(byId.q_kind.answeredCount, 2);
  assert.equal(byId.q_rate.average, 3.67);
  assert.equal(byId.q_note.recent[0].value, "Love it");

  const text = await request(app).get(`${API}/surveys/${surveyId}/analytics/text/q_note?limit=5`).set(auth());
  assert.equal(text.body.meta.total, 1);
  assert.equal(text.body.data[0].value, "Love it");
});

test("versioning: republish keeps old responses on v1", async () => {
  const v2 = structuredClone(schema);
  v2.questions[0].label = "Do you have a pet?";
  v2.questions[0].options!.push({ id: "o_maybe", label: "Thinking about it" });
  await request(app).patch(`${API}/surveys/${surveyId}`).set(auth()).send({ schema: v2 });
  assert.equal((await request(app).get(`${API}/surveys/${surveyId}`).set(auth())).body.data.hasUnpublishedChanges, true);

  const pub = await request(app).post(`${API}/surveys/${surveyId}/publish`).set(auth());
  assert.equal(pub.body.data.currentVersion.version, 2);
  assert.equal((await request(app).get(`${API}/surveys/${surveyId}/versions`).set(auth())).body.data.length, 2);

  await request(app)
    .post(`${API}/public/surveys/${slug}/responses`)
    .send({ answers: { q_pet: "o_maybe", q_rate: 3 } });
  assert.equal((await request(app).get(`${API}/surveys/${surveyId}/analytics`).set(auth())).body.data.totals.responses, 1);
  assert.equal(
    (await request(app).get(`${API}/surveys/${surveyId}/analytics?version=1`).set(auth())).body.data.totals.responses,
    3,
  );
  assert.equal(
    (await request(app).get(`${API}/surveys/${surveyId}/analytics?version=all`).set(auth())).body.data.totals.responses,
    4,
  );
});

test("closed surveys reject responses", async () => {
  await request(app).patch(`${API}/surveys/${surveyId}/status`).set(auth()).send({ status: "closed" });
  assert.equal((await request(app).get(`${API}/public/surveys/${slug}`)).status, 410);
  await request(app).patch(`${API}/surveys/${surveyId}/status`).set(auth()).send({ status: "published" });
  assert.equal((await request(app).get(`${API}/public/surveys/${slug}`)).status, 200);
});

test("stale partial responses are purged and never counted", async () => {
  await request(app)
    .put(`${API}/public/surveys/${slug}/draft`)
    .send({ answers: { q_pet: "o_no" } });
  const old = await request(app)
    .put(`${API}/public/surveys/${slug}/draft`)
    .send({ answers: { q_pet: "o_yes" } });
  await db.execute(sql`UPDATE responses SET updated_at = now() - interval '31 days'
    WHERE survey_id = ${surveyId} AND status = 'partial' AND answers->>'q_pet' = 'o_yes'`);
  let a = await request(app).get(`${API}/surveys/${surveyId}/analytics?version=all`).set(auth());
  assert.equal(a.body.data.totals.partial, 1, "stale partial excluded before purge");

  assert.ok((await purgeStalePartials()) >= 1);
  const { rows } = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM responses WHERE survey_id = ${surveyId} AND status = 'partial'`,
  );
  assert.equal(rows[0].n, 1);
  assert.equal(
    (await request(app).get(`${API}/public/surveys/${slug}?resume=${old.body.data.resumeToken}`)).body.data.resume,
    null,
  );
  a = await request(app).get(`${API}/surveys/${surveyId}/analytics?version=all`).set(auth());
  assert.equal(a.body.data.totals.partial, 1);
});

test("csv export", async () => {
  const res = await request(app).get(`${API}/surveys/${surveyId}/responses.csv?version=all`).set(auth());
  assert.equal(res.status, 200);
  const lines = res.text.trim().split("\n");
  assert.equal(lines.length, 5);
  assert.match(lines[0], /Do you have a pet\?/);
});

test("soft delete hides the survey everywhere but keeps its data", async () => {
  const del = await request(app).delete(`${API}/surveys/${surveyId}`).set(auth());
  assert.equal(del.status, 200);
  assert.equal((await request(app).get(`${API}/surveys/${surveyId}`).set(auth())).status, 404);
  assert.equal((await request(app).get(`${API}/public/surveys/${slug}`)).status, 404);
  assert.equal((await request(app).get(`${API}/surveys`).set(auth())).body.meta.total, 0);
  const { rows } = await db.execute<{ deleted: boolean; n: number }>(sql`
    SELECT s.deleted, (SELECT count(*)::int FROM responses r WHERE r.survey_id = s.id) AS n FROM surveys s WHERE s.id = ${surveyId}`);
  assert.equal(rows[0].deleted, true);
  assert.ok(rows[0].n > 0, "responses retained");
  assert.equal((await request(app).delete(`${API}/surveys/${surveyId}`).set(auth())).status, 404); // idempotent-ish: gone is gone
});
