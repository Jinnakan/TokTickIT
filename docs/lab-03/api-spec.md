# Lab 3 API Contract

Base path: `/api`. All request/response bodies are JSON. Extends Lab 2's
`docs/lab-02/api-spec.md`; endpoints not listed here are unchanged except
that every one of them now reads the current user from the session instead
of the `X-Dev-Requester-Id` header, which is removed entirely.

## 0. Session and Authorization

Every endpoint below except `POST /api/auth/login` requires a valid session
cookie (`toktickit_session`, `httpOnly`, `SameSite=Lax`).

| Condition | Status | Body |
|---|---|---|
| No session cookie, or cookie references an unknown/expired session | 401 | `{ "error": "UNAUTHENTICATED" }` |
| Valid session, but `mustChangePassword` is true and the endpoint isn't `/api/auth/change-password` or `/api/auth/logout` | 403 | `{ "error": "PASSWORD_CHANGE_REQUIRED" }` |
| Valid session, but the user's role is not permitted for this endpoint | 403 | `{ "error": "FORBIDDEN" }` |
| Mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) with a missing/mismatched `Origin`/`Referer` | 403 | `{ "error": "ORIGIN_MISMATCH" }` |

Role columns below use `REQ` (Requester), `IT` (IT Staff), `ADM`
(Administrator). This check runs before any resource-ownership check.

## 1. Authentication

### `POST /api/auth/login`

Not session-protected (this is how a session is obtained). Rate-limited
per (email, IP) — see §0 lockout row below.

Request body: `{ "email": "jane@example.com", "password": "correct horse" }`

| Condition | Status | Body |
|---|---|---|
| Missing email or password | 400 | `{ "error": "VALIDATION_FAILED", "fields": { ... } }` |
| Unknown email, wrong password, or inactive account | 401 | `{ "error": "INVALID_CREDENTIALS", "message": "Invalid email or password." }` (identical message in all three cases — BR-L3-05) |
| Lockout window active for this (email, IP) | 429 | `{ "error": "TOO_MANY_ATTEMPTS", "message": "Too many failed attempts. Try again later." }` |
| Success | 200 | `{ "id": 3, "email": "jane@example.com", "name": "Jane Doe", "role": "REQUESTER", "mustChangePassword": false }` — session cookie set, session id regenerated (BR-L3-06) |

### `POST /api/auth/logout`

Requires a session. Deletes the `Session` row server-side and clears the
cookie.

- 200: `{ "success": true }`

### `GET /api/auth/me`

Requires a session.

- 200: `{ "id": 3, "email": "jane@example.com", "name": "Jane Doe", "role": "REQUESTER", "mustChangePassword": false }`

### `POST /api/auth/change-password`

Requires a session (allowed even when `mustChangePassword` is true, since
this is the escape hatch).

Request body: `{ "currentPassword": "...", "newPassword": "..." }`

| Condition | Status | Body |
|---|---|---|
| `currentPassword` doesn't match | 400 | `{ "error": "CURRENT_PASSWORD_INVALID" }` |
| `newPassword` fails complexity/length rule | 400 | `{ "error": "VALIDATION_FAILED", "fields": { "newPassword": "..." } }` |
| Success | 200 | `{ "success": true }` — `mustChangePassword` set false |

## 2. Requester Endpoints (unchanged behavior, new auth)

`POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:id`, the
Attachment endpoints — identical request/response shapes to
`docs/lab-02/api-spec.md` §2–5, scoped to `req.session.userId` instead of
the `X-Dev-Requester-Id` header. Role: `REQ`.

## 3. Comments and Notes

### `GET /api/tickets/:id/comments`

Role: `REQ` (own ticket only), `IT`, `ADM`.

- 200: `[{ "id": 12, "ticketId": 42, "authorId": 3, "authorName": "Jane Doe", "body": "Still happening after reboot.", "createdAt": "..." }, ...]` ordered `createdAt` asc
- 403: `TICKET_FORBIDDEN` (Requester requesting a ticket they don't own)
- 404: `TICKET_NOT_FOUND`

### `POST /api/tickets/:id/comments`

Role: `REQ` (own ticket only), `IT`, `ADM`. Body: `{ "body": "..." }`.

| Condition | Status | Body |
|---|---|---|
| `body` empty or > 2000 chars | 400 | `{ "error": "VALIDATION_FAILED", "fields": { "body": "..." } }` |
| Ticket not found | 404 | `TICKET_NOT_FOUND` |
| Requester, not their ticket | 403 | `TICKET_FORBIDDEN` |
| Success | 201 | the created comment, same shape as the GET list item |

Body is stored and later rendered as plain text (BR-L3-12); no
sanitization-by-stripping is needed because the client never renders it as
HTML.

### `GET /api/tickets/:id/notes`

Role: `IT`, `ADM` only.

| Condition | Status | Body |
|---|---|---|
| Requester (any ticket, owned or not) | 403 | `{ "error": "FORBIDDEN" }` (BR-L3-17 — never leaks note content or existence) |
| Ticket not found | 404 | `TICKET_NOT_FOUND` |
| Success | 200 | `[{ "id": 5, "ticketId": 42, "authorId": 8, "authorName": "Alex IT", "body": "Escalating to network team.", "createdAt": "..." }, ...]` |

### `POST /api/tickets/:id/notes`

Role: `IT`, `ADM` only. Same validation/response shape as comments, same
403-not-404-and-not-leaked treatment for a Requester caller.

## 4. IT Staff Ticket Queue and Detail

### `GET /api/tickets` (IT Staff/Administrator variant)

Role: `IT`, `ADM`. Same query parameters as `docs/lab-02/api-spec.md` §3
(`search`, `categoryId`, `requestedPriority`, `currentStatus`, `sortBy`,
`sortDir`, `page`, `pageSize`), not scoped to one requester, plus:

| Param | Type | Notes |
|---|---|---|
| `ticketOwnerId` | integer | filter to tickets claimed by one IT Staff member; omit for all |
| `unassignedOnly` | boolean | filter to tickets with `ticketOwnerId = null` |
| `itPriority` | `LOW`\|`MEDIUM`\|`HIGH` | filter |

`sortBy`/`sortDir`/every filter field is validated against the same
allowlist enum the Builder (`TicketQueryBuilder`) exposes; an unlisted
value is 400, never passed through to a raw query fragment (BR-L3-11).

### `POST /api/tickets/:id/claim`

Role: `IT`, `ADM`.

| Condition | Status | Body |
|---|---|---|
| Ticket not found | 404 | `TICKET_NOT_FOUND` |
| Already claimed by someone else | 409 | `{ "error": "ALREADY_CLAIMED", "ticketOwnerId": 8 }` |
| Success | 200 | updated ticket, `ticketOwnerId` set to the caller |

### `POST /api/tickets/:id/reassign`

Role: `IT`, `ADM`. Body: `{ "ticketOwnerId": 9 }`.

| Condition | Status | Body |
|---|---|---|
| `ticketOwnerId` doesn't reference an active IT Staff user | 400 | `{ "error": "VALIDATION_FAILED" }` |
| Ticket not found | 404 | `TICKET_NOT_FOUND` |
| Success | 200 | updated ticket |

### `PATCH /api/tickets/:id/priority`

Role: `IT`, `ADM`. Body: `{ "itPriority": "HIGH" }`.

- 200: updated ticket
- 400: invalid enum value
- 404: `TICKET_NOT_FOUND`

### `PATCH /api/tickets/:id/status`

Role: `IT`, `ADM`. Body: `{ "status": "IN_PROGRESS" }`.

| Condition | Status | Body |
|---|---|---|
| Requested status is not a valid transition from the current state for this role | 409 | `{ "error": "INVALID_TRANSITION", "from": "NEW", "to": "CLOSED", "allowed": ["OPEN", "CANCELLED"] }` |
| Ticket not found | 404 | `TICKET_NOT_FOUND` |
| Success | 200 | updated ticket |

The allowed-transition table (one `TicketState` subclass per status) is:

| From | Allowed To |
|---|---|
| `NEW` | `OPEN`, `CANCELLED` |
| `OPEN` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |
| `RESOLVED` | `CLOSED`, `REOPENED` |
| `CLOSED` | `REOPENED` |
| `REOPENED` | `IN_PROGRESS`, `CANCELLED` |
| `CANCELLED` | *(terminal — no outbound transitions)* |

## 5. Administrator User Management

All endpoints in this section: role `ADM` only.

### `GET /api/users`

Query parameters: `search` (matches name/email, partial, case-insensitive),
`role` (filter), `isActive` (filter), `page`, `pageSize` — same
page/pageSize defaults and clamping as Lab 2's ticket list. No mandatory
multi-column sort (§3 exclusion — kept minimal).

- 200: `{ "data": [{ "id": 9, "email": "alex@example.com", "name": "Alex IT", "role": "IT_STAFF", "isActive": true, "mustChangePassword": false, "createdAt": "..." }, ...], "meta": { "page": 1, "pageSize": 10, "totalItems": 8, "totalPages": 1 } }`

### `POST /api/users`

Body: `{ "email": "new.person@example.com", "name": "New Person", "role": "IT_STAFF" }`

| Condition | Status | Body |
|---|---|---|
| `email` already in use | 400 | `{ "error": "EMAIL_TAKEN" }` |
| Missing/invalid `role` | 400 | `{ "error": "VALIDATION_FAILED", "fields": { "role": "..." } }` |
| Success | 201 | `{ "id": 12, "email": "...", "name": "...", "role": "IT_STAFF", "isActive": true, "mustChangePassword": true, "initialPassword": "Xk9#mQ2pLr" }` — `initialPassword` appears in this one response only (BR-L3-19) |

### `PATCH /api/users/:id`

Body: any of `{ "name": "...", "role": "...", "isActive": true }`.

- 200: updated user (never includes a password field)
- 404: `USER_NOT_FOUND`

### `POST /api/users/:id/reset-password`

- 200: `{ "id": 12, "initialPassword": "Qm4#vBp8xZ" }` — shown once, same
  rule as creation (BR-L3-19); `mustChangePassword` set true
- 404: `USER_NOT_FOUND`

### `POST /api/users/:id/deactivate`

- 200: `{ "id": 12, "isActive": false }` — every `Session` row for this
  user is deleted in the same transaction (BR-L3-18); idempotent if
  already inactive
- 404: `USER_NOT_FOUND`

### `POST /api/users/:id/activate`

- 200: `{ "id": 12, "isActive": true }`
- 404: `USER_NOT_FOUND`

## 6. Status Code Summary

| Status | Used for |
|---|---|
| 200 | Successful retrieval, update, or state-changing action |
| 201 | User, Comment, or Note created |
| 400 | Validation failure, unknown/duplicate email, invalid enum value |
| 401 | No valid session |
| 403 | Wrong role for this endpoint, password-change-required gate, origin mismatch, Requester accessing a ticket/note they don't own |
| 404 | Unknown Ticket/User/Comment/Note id |
| 409 | Ticket already claimed by another IT Staff member; invalid status transition |
| 429 | Login rate-limit / lockout window active |
| 500 | Unexpected server error — body is always `{ "error": "INTERNAL_ERROR" }`, never a stack trace |
