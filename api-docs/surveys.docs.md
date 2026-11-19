# Surveys (admin)

All routes require `Authorization: Bearer`. Every query is scoped to the caller:
another user's survey returns **404**, never 403.

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/surveys` | `?page&limit&search&status&sort` | 200 page of surveys |
| GET | `/surveys/search` | `?q&scope&status&responses&unpublished&sort&page&limit` | 200 page of surveys (default `limit` 25) |
| GET | `/surveys/search/facets` | same query (no paging) | 200 contextual counts for the filter pills |
| GET | `/surveys/stats` | – | 200 `{ days: [{ day, count }], previousTotal }`: completed responses per UTC day for the last 30 days, all your surveys |
| POST | `/surveys` | `{ title, description?, schema? }` | 201 survey |
| GET | `/surveys/:id` | – | 200 survey |
| GET | `/surveys/:id/versions` | – | 200 `[{ version, title, publishedAt, questionCount, responseCount }]`, newest first |
| PATCH | `/surveys/:id` | `{ title?, description?, schema? }` (at least one) | 200 survey (draft saved) |
| POST | `/surveys/:id/publish` | – | 200 survey, or 422 with field errors |
| PATCH | `/surveys/:id/status` | `{ status: "published" \| "closed" }` | 200 survey |
| DELETE | `/surveys/:id` | – | 200 (soft delete) |

## List query
- `search`: case-insensitive match on title or slug. `%` and `_` match literally.
- `status`: repeatable, e.g. `?status=draft&status=closed`. Values: `draft`, `published`, `closed`.
- `sort`: `updated` (default), `created`, `title`, `responses`. Each sort ends with an id tie-breaker, so pages never repeat or skip rows.

## Search query
The survey table's search. Both endpoints take the same query, so the counts always describe the list on screen.
- `q`: whitespace-separated terms (up to 8); **every** term must match the title, the slug or a status word (`live` finds published surveys). Case-insensitive; `%` and `_` match literally.
- `scope`: a fixed status the whole search lives in (Home uses `scope=published`). Applies to the counts too.
- `status`: repeatable filter, e.g. `?status=draft&status=closed`.
- `responses`: `any` (default), `with` (at least one completed response) or `none`.
- `unpublished`: `true` keeps published surveys whose draft differs from the live version.
- `sort`, `page`, `limit`: as for `GET /surveys`. Invalid values are `422` with field errors.

Facets response:

```jsonc
{
  "baseTotal": 3,                                  // in scope, before search and filters
  "status": { "draft": 1, "published": 1, "closed": 1 },
  "statusAll": 3,
  "responses": { "any": 3, "with": 1, "none": 2 },
  "unpublished": 1,
  "anyUnpublished": true
}
```

Each count is **contextual**: how many surveys would remain if that option were picked, with the other facets as they are. A facet ignores its own selection, so with `status=draft` the other status counts are still shown. All counts come from one aggregate query over the searched pool.

## Survey shape

```jsonc
{
  "id": "uuid", "slug": "pet-survey-a1b2c3", "title": "…", "description": "…",
  "status": "draft | published | closed",
  "schema": { "questions": [] },                       // the working draft (see the main README)
  "currentVersion": { "version": 2, "publishedAt": "…" },  // or null if never published
  "hasUnpublishedChanges": true,
  "responseCount": 80,                                 // completed
  "partialCount": 6,                                   // in progress, touched within PARTIAL_TTL_DAYS
  "lastResponseAt": "…",                               // or null
  "createdAt": "…", "updatedAt": "…"
}
```

## Rules
- **Drafts save leniently.** `PATCH` checks only the overall shape (at most 100 questions), so a half-written question can be saved. **Publishing validates fully**, using the shared validator (the same code the builder and the form use). Errors come back as `422`, with `errors[].field` set to the question id.
- **Publish** locks the survey row and copies the draft into an immutable `survey_versions` row (`version = max + 1`). If the draft is identical to the current version, it just (re)opens the survey.
- **Status**: `published` requires at least one published version (422 otherwise). `closed` makes the public link return `410`.
- **Slug**: generated once from the title plus a random suffix. Renaming never changes it, so shared links stay stable. A unique-constraint collision is retried.
- **Delete is soft**: `deleted = true` and `deleted_at` is stamped. The survey disappears from every list, every read and its public link. Its versions and responses are kept, and the slug stays reserved.
