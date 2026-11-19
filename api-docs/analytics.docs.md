# Analytics (admin)

Bearer auth, owner-scoped (404 for other users' surveys). The `version` query:
omitted means the current published version, `N` means that version, and `all` means every
version (labelled with the latest schema; question ids are stable across versions).

| Method | Path | Query | Success |
|---|---|---|---|
| GET | `/surveys/:id/analytics` | `?version` | 200 summary |
| GET | `/surveys/:id/analytics/text/:questionId` | `?version&page&limit&search` | 200 page of `{ id, value, submittedAt }` |
| GET | `/surveys/:id/responses.csv` | `?version` | 200 `text/csv` attachment |

## Summary shape

```jsonc
{
  "survey": { "id": "…", "title": "…", "slug": "…", "status": "published" },
  "version": 2,                          // or "all", or null if never published
  "totals": { "responses": 80, "partial": 6, "completionRate": 93, "lastResponseAt": "…" },
  "timeline": [{ "day": "2026-11-18", "count": 4 }],   // completed per UTC day, last 30 days
  "questions": [
    {
      "id": "q_used", "index": 1, "type": "single", "label": "…", "required": true,
      "conditional": false, "answeredCount": 80, "skippedCount": 0,
      "options": [{ "id": "o_yes", "label": "Yes", "count": 62, "percent": 77.5 }]   // single / multi
      // rating: "average": 4.21, "distribution": [{ "value": 1, "count": 2 }, …] (always 1–5)
      // text:   "recent": [{ "value": "…", "submittedAt": "…" }]  (latest 8)
    }
  ]
}
```

## Rules
- The whole summary takes a fixed number of queries (5), however many questions the survey has.
- Only `complete` responses are counted. "In progress" counts partials touched within `PARTIAL_TTL_DAYS`.
- Option percentages are of the people who answered that question, not of all respondents.
- In `version=all`, answers to options removed in a later version appear as `(removed option)`.
- CSV cells starting with `=`, `+`, `-` or `@` are prefixed with `'`, which blocks spreadsheet formula injection.
