# Public form

No authentication: respondents are anonymous. Only published, non-deleted surveys resolve.

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/public/surveys/:slug` | `?resume=<token>` | 200 `{ survey: { slug, title, description, version, schema }, resume: { token, answers } }`, `resume` is null when there's nothing to restore |
| PUT | `/public/surveys/:slug/draft` | `{ answers, resumeToken?, website? }` | 201 on the first save, 200 after: `{ resumeToken, savedAt }` |
| POST | `/public/surveys/:slug/responses` | `{ answers, resumeToken?, website? }` | 201 `{ id }` |

Errors: `404` unknown, unpublished or deleted · `410` closed · `422` invalid answers (`errors[].field` is the question id) · `429` rate limited.

## Rules
- **Answers** are an object keyed by question id: text → string, single choice → option id, multiple choice → array of option ids, rating → integer 1–5.
- Answers to questions **hidden** by conditional logic are dropped before saving. Required is enforced only for visible questions.
- **Autosave** (`PUT /draft`, at most 60 per minute per IP) checks answer types but not required-ness. The first save that contains an answer creates the partial row and returns an opaque `resumeToken`; only its SHA-256 hash is stored. Saves with no answers create nothing.
- **Resume**: `GET ?resume=` returns the version the partial was started on, even if the survey has been republished since, together with the saved answers.
- **Submit** (at most `SUBMIT_LIMIT` per 10 minutes per IP) validates strictly against that version, turns the partial into the complete response (so each person counts once) and invalidates the token.
- **Honeypot**: if the hidden `website` field is filled in, the server returns a believable success and stores nothing.
- Partials untouched for `PARTIAL_TTL_DAYS` are deleted, after which the resume token simply stops working.
