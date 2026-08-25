# Lab 2 API Contract

Base path: `/api`. All request/response bodies are JSON except file upload
(`multipart/form-data`) and file download (binary). All Requester-scoped
endpoints require the `X-Dev-Requester-Id` header (see §0).

## 0. Requester Context Header

Every endpoint under "Requester-scoped" below requires:

```
X-Dev-Requester-Id: <integer DevRequester id>
```

| Condition | Status | Body |
|---|---|---|
| Header missing or not an integer | 400 | `{ "error": "DEV_REQUESTER_REQUIRED", "message": "Select a Development Requester first." }` |
| Header references an unknown or inactive DevRequester | 400 | `{ "error": "DEV_REQUESTER_INVALID", "message": "Selected Development Requester is no longer available." }` |

This check runs before any ownership check on the specific resource.

## 1. Reference Data

### `GET /api/categories`

Not Requester-scoped. Returns active Categories only.

- 200: `[{ "id": 1, "name": "Hardware" }, ...]` (ordered by `id` asc)

### `GET /api/related-systems`

Not Requester-scoped. Returns active Related Systems only.

- 200: `[{ "id": 1, "name": "Corporate Laptop" }, ...]` (ordered by `id` asc)

### `GET /api/dev-requesters`

Not Requester-scoped (this endpoint populates the selector itself). Returns
active Development Requesters only.

- 200: `[{ "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" }, ...]` (ordered by `id` asc)
- 500: `{ "error": "INTERNAL_ERROR" }` on unexpected DB failure — client shows the safe API-failure state (AC-15).

## 2. Ticket Creation

### `POST /api/tickets`

Requester-scoped. Creates one Ticket owned by the header's Requester.

Request body:

```json
{
  "categoryId": 1,
  "relatedSystemId": 6,
  "requestedPriority": "MEDIUM",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual..."
}
```

`requesterId`, `ticketNumber`, `currentStatus`, and any date fields are
never accepted from the request body (BR-05); if present they are ignored.

Validation (all enforced server-side; client mirrors the same rules):

| Field | Rule | Failure status |
|---|---|---|
| `categoryId` | required, integer, references an active Category | 400 |
| `relatedSystemId` | required, integer, references an active Related System | 400 |
| `requestedPriority` | required, one of `LOW`/`MEDIUM`/`HIGH` | 400 |
| `summary` | required, trimmed length 5–150 | 400 |
| `description` | required, trimmed length 10–2000 | 400 |

Validation-failure response shape (one entry per invalid field):

```json
{
  "error": "VALIDATION_FAILED",
  "fields": { "summary": "Summary must be 5-150 characters." }
}
```

Responses:

- 201: `{ "id": 42, "ticketNumber": "TKT-2026-000042", "categoryId": 1, "relatedSystemId": 6, "requesterId": 3, "requestedPriority": "MEDIUM", "currentStatus": "NEW", "summary": "...", "description": "...", "createdAt": "2026-08-25T09:14:00.000Z" }`
- 400: validation failure (above) or `DEV_REQUESTER_*` (§0)

The Ticket Number is computed after the row is inserted, from the row's own
`id` (BR-04), then written back in the same transaction before the response
is sent — the client never sees a Ticket without its Ticket Number.

## 3. Ticket List (My Tickets)

### `GET /api/tickets`

Requester-scoped. Returns only Tickets owned by the header's Requester
(BR-12, enforced by a `WHERE requesterId = :headerId` clause, never by
filtering after the fact).

Query parameters:

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | matches `ticketNumber` OR `summary`, case-insensitive, partial |
| `categoryId` | integer | — | filter |
| `requestedPriority` | `LOW`\|`MEDIUM`\|`HIGH` | — | filter |
| `currentStatus` | `NEW` | — | filter (only value possible in Lab 2) |
| `sortBy` | `createdAt`\|`ticketNumber`\|`summary` | `createdAt` | |
| `sortDir` | `asc`\|`desc` | `desc` | secondary sort is always `id desc` for stability |
| `page` | integer | `1` | non-numeric → 400; `< 1` → clamped to `1` |
| `pageSize` | integer | `10` | non-numeric → 400; clamped to range `1`–`50` |

Invalid enum values for `requestedPriority`, `currentStatus`, `sortBy`, or
`sortDir` return 400 (not silently ignored), since these come from UI
controls with a known fixed set of options.

Response:

```json
{
  "data": [
    { "id": 42, "ticketNumber": "TKT-2026-000042", "summary": "Laptop battery drains quickly",
      "categoryId": 1, "requestedPriority": "MEDIUM", "currentStatus": "NEW",
      "createdAt": "2026-08-25T09:14:00.000Z", "updatedAt": "2026-08-25T09:14:00.000Z" }
  ],
  "meta": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
}
```

- 200: as above (empty `data: []` with `totalItems: 0` for both the
  zero-tickets-total case and the no-results-for-this-search case — the
  client distinguishes them by checking whether `search`/filters are active, per AC-10)
- 400: invalid query parameter or `DEV_REQUESTER_*` (§0)

## 4. Ticket Detail

### `GET /api/tickets/:id`

Requester-scoped.

- 200: full Ticket fields (same shape as POST response) when `ticket.requesterId === headerId`
- 404: `{ "error": "TICKET_NOT_FOUND" }` when the id doesn't exist
- 403: `{ "error": "TICKET_FORBIDDEN" }` when the id exists but belongs to a different Requester (AC-03, §11 decision)
- 400: `DEV_REQUESTER_*` (§0)

## 5. Attachments

### `POST /api/tickets/:id/attachments`

Requester-scoped, `multipart/form-data`, field name `file` (single file per request; the client issues one request per selected file so partial failure is per-file, per BR-21).

| Condition | Status | Body |
|---|---|---|
| Ticket not found | 404 | `{ "error": "TICKET_NOT_FOUND" }` |
| Ticket exists, owned by a different Requester | 403 | `{ "error": "TICKET_FORBIDDEN" }` |
| No file in request | 400 | `{ "error": "FILE_REQUIRED" }` |
| Disallowed type (by extension or MIME) | 400 | `{ "error": "UNSUPPORTED_FILE_TYPE", "message": "Allowed types: JPG, PNG, WEBP, PDF." }` |
| File > 5 MB | 400 | `{ "error": "FILE_TOO_LARGE", "message": "Maximum size is 5 MB." }` |
| Ticket already has 5 active Attachments | 400 | `{ "error": "ATTACHMENT_LIMIT_REACHED", "message": "A Ticket may have at most 5 active attachments." }` |
| Success | 201 | `{ "id": 7, "ticketId": 42, "originalFilename": "screenshot.png", "mimeType": "image/png", "sizeBytes": 204800, "uploadedAt": "...", "isRemoved": false }` |

### `GET /api/tickets/:id/attachments`

Requester-scoped. Returns all Attachment metadata (active and removed) for
one owned Ticket, ordered by `uploadedAt` asc.

- 200: `[{ "id": 7, "originalFilename": "screenshot.png", "mimeType": "image/png", "sizeBytes": 204800, "uploadedAt": "...", "isRemoved": false, "removedAt": null, "removedReason": null }, ...]`
- 404: `TICKET_NOT_FOUND` (Ticket id doesn't exist)
- 403: `TICKET_FORBIDDEN` (Ticket exists, owned by a different Requester)

### `GET /api/attachments/:id/download`

Requester-scoped (ownership resolved via the Attachment's parent Ticket).

- 200: binary file stream, `Content-Disposition: attachment; filename="<originalFilename>"`
- 404: `{ "error": "ATTACHMENT_NOT_FOUND" }` — unknown id
- 403: `{ "error": "ATTACHMENT_FORBIDDEN" }` — attachment exists but its parent Ticket isn't owned by the header Requester
- 410: `{ "error": "ATTACHMENT_REMOVED" }` — attachment exists, is owned, but `isRemoved = true` (BR-20)

### `DELETE /api/attachments/:id`

Requester-scoped soft-remove. Body: `{ "reason": "Uploaded the wrong screenshot" }`.

| Condition | Status | Body |
|---|---|---|
| `reason` missing or shorter than 3 chars / longer than 200 | 400 | `{ "error": "REASON_REQUIRED", "message": "Provide a reason (3-200 characters)." }` |
| Attachment not found | 404 | `{ "error": "ATTACHMENT_NOT_FOUND" }` |
| Attachment exists, owned by a different Requester | 403 | `{ "error": "ATTACHMENT_FORBIDDEN" }` |
| Attachment already removed | 400 | `{ "error": "ALREADY_REMOVED" }` |
| Success | 200 | `{ "id": 7, "isRemoved": true, "removedAt": "...", "removedReason": "Uploaded the wrong screenshot" }` |

## 6. Status Code Summary

| Status | Used for |
|---|---|
| 200 | Successful retrieval or soft-remove |
| 201 | Ticket or Attachment created |
| 400 | Validation failure, missing/invalid Requester context, unsupported file, oversized file, attachment limit reached, missing/invalid removal reason, already-removed |
| 403 | Ticket/Attachment exists but is owned by a different Requester |
| 404 | Unknown Ticket/Attachment id |
| 410 | Download requested for a soft-removed Attachment |
| 500 | Unexpected server error (DB unreachable, etc.) — body is always `{ "error": "INTERNAL_ERROR" }`, never a stack trace or raw exception message |
