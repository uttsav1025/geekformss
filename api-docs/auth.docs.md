# Auth

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/register` | – | `{ name, email, password }` | 201 `{ accessToken, user }` + refresh cookie |
| POST | `/auth/login` | – | `{ email, password }` | 200 `{ accessToken, user }` + refresh cookie |
| POST | `/auth/refresh` | refresh cookie (or `{ refreshToken }` in the body for non-browser clients) | – | 200 `{ accessToken, user }` + rotated cookie |
| POST | `/auth/logout` | refresh cookie | – | 200, session revoked, cookie cleared |
| GET | `/auth/me` | Bearer | – | 200 `{ id, name, email }` |

`register`, `login` and `refresh` are rate limited (20 per 15 minutes per IP).

## Rules
- Emails are trimmed and lower-cased before validation. Uniqueness is case-insensitive (a DB index on `lower(email)`).
- Passwords: 8–128 characters, hashed with bcrypt (cost `HASH_SALT_ROUND`, default 12). The hash is never returned.
- Login runs a bcrypt compare even for unknown emails, and returns the same 401 for an unknown email and a wrong password.
- **Access token**: HS256 JWT `{ id }`, valid for `ACCESS_TOKEN_TTL_MINUTES` (15). Keep it in memory, not in storage.
- **Refresh token**: HS256 JWT `{ id, jti, fam }` signed with a separate `REFRESH_SECRET`, sent as an httpOnly,
  `SameSite=Strict`, path-scoped cookie (`Secure` in production), valid for `REFRESH_TOKEN_TTL_DAYS` (7).
  - Every token is a row in `refresh_tokens`. Each refresh revokes the presented row and issues a successor in the same family (`fam`).
  - Presenting an already-rotated token more than 10 seconds after its rotation is treated as theft: the **whole family is revoked**, so both the attacker and the real user must log in again. Within 10 seconds it is treated as two tabs refreshing at once.
  - Refresh re-reads the user row, so a deleted account loses access at its next refresh.
  - Logout revokes the family.

## Example

```http
POST /api/v1/auth/login
{ "email": "demo@geekforms.dev", "password": "demo12345" }

200  Set-Cookie: gf_refresh=…; Path=/api/v1/auth; HttpOnly; SameSite=Strict
{ "success": true, "data": { "accessToken": "eyJ…", "user": { "id": "…", "name": "Demo Admin", "email": "demo@geekforms.dev" } }, "message": "Logged in" }
```
