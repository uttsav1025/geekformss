#!/usr/bin/env node
// End-to-end smoke test against a RUNNING stack (local or staging only).
// Dependency-free: plain fetch. Creates a throwaway account, walks the whole
// product journey, prints ✓/✗ per check and exits non-zero on any failure.
//
//   npm run smoke -w server                         (API defaults to http://localhost:4000/api/v1)
//   SMOKE_API=https://staging.example.com/api/v1 npm run smoke -w server
const API = process.env.SMOKE_API ?? "http://localhost:4000/api/v1";
let passed = 0;
const failures = [];
const check = (name, cond, detail = "") => {
  if (cond) passed++;
  else failures.push(name);
  console.log(`  ${cond ? "✓" : "✗"} ${name}${!cond && detail ? ` — ${detail}` : ""}`);
};

let cookie = "";
const call = async (token, method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { "Content-Type": "application/json" }),
      ...(cookie && path.startsWith("/auth/") && { Cookie: cookie }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.().find((c) => c.startsWith("gf_refresh="));
  if (set) cookie = set.split(";")[0];
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, data: json.data, meta: json.meta, message: json.message, errors: json.errors, raw: json.raw };
};

const schema = {
  questions: [
    {
      id: "q_used",
      type: "single",
      label: "Used it?",
      required: true,
      options: [
        { id: "o_y", label: "Yes" },
        { id: "o_n", label: "No" },
      ],
    },
    {
      id: "q_rate",
      type: "rating",
      label: "Rate it",
      required: true,
      condition: { questionId: "q_used", operator: "equals", value: "o_y" },
    },
    { id: "q_note", type: "text", label: "Notes", required: false },
  ],
};

const main = async () => {
  console.log(`Smoke flow against ${API}\n`);
  const email = `smoke-${Date.now()}@example.com`;

  console.log("Auth");
  const reg = await call(null, "POST", "/auth/register", { name: "Smoke", email, password: "smoke-password-1" });
  check(
    "register → 201 + access token + refresh cookie",
    reg.status === 201 && reg.data?.accessToken && cookie,
    `status ${reg.status}`,
  );
  let token = reg.data?.accessToken;
  const refreshed = await call(null, "POST", "/auth/refresh");
  check(
    "refresh via cookie rotates the session",
    refreshed.status === 200 && refreshed.data?.accessToken,
    `status ${refreshed.status}`,
  );
  token = refreshed.data?.accessToken ?? token;
  check("me", (await call(token, "GET", "/auth/me")).data?.email === email);

  console.log("Build & publish");
  const created = await call(token, "POST", "/surveys", { title: "Smoke survey" });
  check("create survey → 201", created.status === 201, `status ${created.status}`);
  const id = created.data?.id;
  const slug = created.data?.slug;
  check("save draft (PATCH)", (await call(token, "PATCH", `/surveys/${id}`, { schema })).status === 200);
  const pub = await call(token, "POST", `/surveys/${id}/publish`);
  check("publish → v1 live", pub.data?.currentVersion?.version === 1 && pub.data?.status === "published", pub.message);
  const list = await call(token, "GET", "/surveys?limit=5");
  check("list has pagination meta", list.meta?.total >= 1 && list.meta?.page === 1);

  console.log("Respond");
  const form = await call(null, "GET", `/public/surveys/${slug}`);
  check("public form loads", form.status === 200 && form.data?.survey?.schema?.questions?.length === 3);
  const draft = await call(null, "PUT", `/public/surveys/${slug}/draft`, { answers: { q_used: "o_y" } });
  check("autosave returns a resume token", draft.status === 201 && draft.data?.resumeToken);
  const resumed = await call(null, "GET", `/public/surveys/${slug}?resume=${draft.data?.resumeToken}`);
  check("resume restores answers", resumed.data?.resume?.answers?.q_used === "o_y");
  const invalid = await call(null, "POST", `/public/surveys/${slug}/responses`, { answers: { q_used: "o_y" } });
  check("missing conditional answer → 422", invalid.status === 422 && invalid.errors?.[0]?.field === "q_rate");
  const done = await call(null, "POST", `/public/surveys/${slug}/responses`, {
    answers: { q_used: "o_y", q_rate: 4, q_note: "smoke" },
    resumeToken: draft.data?.resumeToken,
  });
  check("submit → 201", done.status === 201);

  console.log("Results");
  const a = await call(token, "GET", `/surveys/${id}/analytics`);
  check(
    "1 response, 0 in progress",
    a.data?.totals?.responses === 1 && a.data?.totals?.partial === 0,
    JSON.stringify(a.data?.totals),
  );
  check("rating average 4", a.data?.questions?.find((q) => q.id === "q_rate")?.average === 4);
  const csv = await call(token, "GET", `/surveys/${id}/responses.csv`);
  check("CSV export", typeof csv.raw === "string" && csv.raw.split("\n").length >= 2);

  console.log("Clean up");
  check("soft delete", (await call(token, "DELETE", `/surveys/${id}`)).status === 200);
  check("public link now 404", (await call(null, "GET", `/public/surveys/${slug}`)).status === 404);
  check("logout", (await call(null, "POST", "/auth/logout")).status === 200);
  check("refresh after logout → 401", (await call(null, "POST", "/auth/refresh")).status === 401);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
};

main().catch((error) => {
  console.error("Smoke flow crashed:", error.message);
  process.exit(1);
});
