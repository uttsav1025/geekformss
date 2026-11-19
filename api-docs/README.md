# GeekForms API (v1)

Base URL: `/api/v1`. All bodies are JSON. Module docs:

| Module | Doc | Prefix |
|---|---|---|
| Auth | [auth.docs.md](auth.docs.md) | `/auth` |
| Surveys (admin) | [surveys.docs.md](surveys.docs.md) | `/surveys` |
| Analytics (admin) | [analytics.docs.md](analytics.docs.md) | `/surveys/:id/...` |
| Public form | [public.docs.md](public.docs.md) | `/public` |

Outside the prefix: `GET /health` (process up) and `GET /ready` (database reachable, `503` otherwise).

## Envelope

Every JSON response has one of three shapes:

```jsonc
// success
{ "success": true, "data": { }, "message": "Survey fetched" }
// paginated: meta is a sibling of data
{ "success": true, "data": [ ], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNextPage": true, "hasPrevPage": false }, "message": "Surveys fetched" }
// error: `errors` only for field-level problems
{ "success": false, "data": null, "message": "Validation failed", "errors": [{ "field": "email", "message": "Enter a valid email" }] }
```

The one exception is the CSV export, which returns `text/csv`.

## Status codes

| Code | When |
|---|---|
| 200 / 201 | ok / created |
| 400 | malformed JSON |
| 401 | missing, invalid or expired token; bad credentials |
| 404 | not found, soft-deleted, unpublished, **or someone else's survey** |
| 409 | duplicate (email already registered) |
| 410 | survey closed to new responses |
| 413 | body over 256 KB |
| 422 | field validation failed; survey can't be published as-is |
| 429 | rate limited (`RateLimit-*` headers say when to retry) |
| 500 | unexpected (production messages never include internals) |

## Authentication

`Authorization: Bearer <accessToken>` on every `/surveys` route. Access tokens last
15 minutes. Renew with `POST /auth/refresh`, which reads the httpOnly `gf_refresh`
cookie (path `/api/v1/auth`) and rotates it. See [auth.docs.md](auth.docs.md).

## Pagination

`?page=1&limit=20` on list endpoints. `limit` is capped at 100. Sort and filter values
come from allow-lists, and unknown query params are ignored.
