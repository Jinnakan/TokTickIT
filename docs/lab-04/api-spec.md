# Lab 4 API Contract

Base path: `/api`. JSON bodies. Extends `docs/lab-03/api-spec.md`; anything
not listed here is unchanged. Session, role, password-change, and origin
checks from Lab 3 §0 apply to every endpoint, and run before any ownership
check. Role columns: `REQ` Requester, `IT` IT Staff, `ADM` Administrator.

## 0. Common Rules

| Condition | Status | Body |
|---|---|---|
| No valid session | 401 | `{ "error": "UNAUTHENTICATED" }` |
| Role not permitted | 403 | `{ "error": "FORBIDDEN" }` |
| Requester on a Ticket they do not own | 403 | `{ "error": "TICKET_FORBIDDEN" }` |
| Unknown Ticket, Action, or User id | 404 | `TICKET_NOT_FOUND`, `ACTION_NOT_FOUND`, `USER_NOT_FOUND` |
| Validation failure | 400 | `{ "error": "VALIDATION_FAILED", "fields": { "<field>": "<message>" } }` |
| Outdated `expectedVersion` or Action `version` | 409 | `{ "error": "STALE_UPDATE", "currentVersion": 7 }` |
| Unexpected failure | 500 | `{ "error": "INTERNAL_ERROR" }`, never a stack trace |

Mutating requests that change a Ticket carry `expectedVersion` (integer, from
the last `GET /api/tickets/:id`). A missing or non-integer value is 400.

## 1. Actions Taken

Action object returned everywhere:

```json
{
  "id": 31, "ticketId": 42, "version": 2,
  "actionAt": "2026-10-30T07:15:00.000Z",
  "description": "Replaced the docking station firmware.",
  "result": "Dock detected after reboot.",
  "status": "COMPLETED",
  "createdById": 8, "createdByName": "Alex Rivera",
  "assigneeId": 9, "assigneeName": "Priya Nair",
  "followUpRequired": true, "followUpNote": "Check again Friday.",
  "followUpDoneAt": null,
  "attachmentNotes": "See dock-photo.jpg on this ticket.",
  "createdAt": "...", "updatedAt": "..."
}
```

### `GET /api/tickets/:ticketId/actions`

Role: `REQ` (own Ticket only), `IT`, `ADM`. Ordered by `actionAt` ascending,
then `id` ascending (stable).

- 200: `[ <Action>, ... ]` (empty array when none)
- 403 `TICKET_FORBIDDEN`, 404 `TICKET_NOT_FOUND`

### `POST /api/tickets/:ticketId/actions`

Role: `IT`, `ADM`. Body (only these fields are read; anything else, including
`createdById`, `ticketId`, and `version`, is ignored):

| Field | Required | Rule |
|---|---|---|
| `description` | yes | 1 to 2000 characters |
| `status` | no | `PLANNED` (default) or `COMPLETED` |
| `result` | when `COMPLETED` | up to 2000 characters |
| `actionAt` | no | ISO time, default now; not in the future when `COMPLETED` |
| `assigneeId` | no | active IT Staff or Administrator; default the caller |
| `followUpRequired` | no | boolean, default false |
| `followUpNote` | when `followUpRequired` | 1 to 1000 characters; must be empty otherwise |
| `attachmentNotes` | no | up to 500 characters |
| `requestId` | no | client UUID; repeat on the same Ticket returns the original |

| Condition | Status | Body |
|---|---|---|
| Validation failure | 400 | `VALIDATION_FAILED` with `fields` |
| Assignee inactive, wrong role, or unknown | 400 | `{ "error": "VALIDATION_FAILED", "fields": { "assigneeId": "Assignee must be an active IT Staff or Administrator." } }` |
| Ticket `CLOSED` or `CANCELLED` | 409 | `{ "error": "TICKET_LOCKED", "currentStatus": "CLOSED" }` |
| Same `requestId` already used on this Ticket | 200 | the original Action |
| Success | 201 | the created Action; `createdById` is the session user; Ticket `updatedAt` refreshed |

### `PATCH /api/tickets/:ticketId/actions/:actionId`

Role: `IT`, `ADM`. Body: `version` (required) plus any of `description`,
`result`, `status`, `actionAt`, `assigneeId`, `followUpRequired`,
`followUpNote`, `followUpDone` (boolean; true sets `followUpDoneAt` to now,
false clears it), `attachmentNotes`.

| Condition | Status | Body |
|---|---|---|
| Action id not under this Ticket | 404 | `ACTION_NOT_FOUND` |
| `version` does not match | 409 | `STALE_UPDATE` with `currentVersion`; nothing changed |
| Action is `CANCELLED` | 409 | `{ "error": "ACTION_LOCKED", "reason": "CANCELLED" }` |
| `COMPLETED` Action and a locked field is sent | 409 | `{ "error": "ACTION_LOCKED", "reason": "COMPLETED", "fields": ["description"] }` |
| Invalid status move (for example `COMPLETED` to `PLANNED`) | 409 | `{ "error": "INVALID_ACTION_TRANSITION", "from": "COMPLETED", "to": "PLANNED" }` |
| Ticket `CLOSED` or `CANCELLED` | 409 | `TICKET_LOCKED` |
| Validation failure | 400 | `VALIDATION_FAILED` |
| Success | 200 | the updated Action with `version + 1` |

There is no `DELETE` endpoint; a stray `DELETE` returns 404.

## 2. Ticket Workflow

All endpoints: role `IT`, `ADM` unless noted. All carry `expectedVersion`
except claim, which is atomic on its own. Every success returns the updated
Ticket (see §3) with `version` incremented.

### `PATCH /api/tickets/:id/status`

Body: `{ "status": "RESOLVED", "expectedVersion": 4 }`

| Condition | Status | Body |
|---|---|---|
| Requester | 403 | `FORBIDDEN` |
| Not an allowed move from the current status | 409 | `{ "error": "INVALID_TRANSITION", "from": "NEW", "to": "CLOSED", "allowed": ["OPEN","CANCELLED"] }` |
| Move to `RESOLVED` with blockers | 409 | `{ "error": "RESOLUTION_BLOCKED", "blockers": [ { "code": "NO_COMPLETED_ACTION" }, { "code": "PLANNED_ACTIONS_OPEN", "count": 2 }, { "code": "FOLLOW_UP_OPEN", "count": 1 } ] }` |
| Outdated `expectedVersion` | 409 | `STALE_UPDATE` |
| Success | 200 | updated Ticket |

Side effects in one transaction: a history row is appended; moving to
`REOPENED` clears `requesterResolvedAt`; moving to `CANCELLED` sets the
Ticket's `PLANNED` Actions to `CANCELLED`.

Transition matrix (BR-L4-09):

| From | Allowed To |
|---|---|
| `NEW` | `OPEN`, `CANCELLED` |
| `OPEN` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |
| `RESOLVED` | `CLOSED`, `REOPENED` |
| `CLOSED` | `REOPENED` |
| `REOPENED` | `IN_PROGRESS`, `CANCELLED` |
| `CANCELLED` | none |

### `PATCH /api/tickets/:id/priority`

Body: `{ "itPriority": "HIGH", "expectedVersion": 4 }`. 200 updated Ticket;
400 invalid value; 409 `STALE_UPDATE`.

### `POST /api/tickets/:id/reassign`

Body: `{ "ticketOwnerId": 9, "expectedVersion": 4 }`. The owner must be an
active IT Staff or Administrator (400 otherwise). 200 updated Ticket; 409
`STALE_UPDATE`.

### `POST /api/tickets/:id/claim`

No body. Unchanged from Lab 3 (409 `ALREADY_CLAIMED`), and now also
increments `version`.

### `POST /api/tickets/:id/appears-resolved`

Role: `REQ`, own Ticket only. No body.

| Condition | Status | Body |
|---|---|---|
| Ticket not owned | 403 | `TICKET_FORBIDDEN` |
| Status not `OPEN`, `IN_PROGRESS`, or `WAITING_FOR_REQUESTER` | 409 | `{ "error": "NOT_APPLICABLE", "currentStatus": "NEW" }` |
| Success (idempotent) | 200 | `{ "id": 42, "requesterResolvedAt": "...", "currentStatus": "IN_PROGRESS" }`; status unchanged |

### `GET /api/tickets/:id/history`

Role: `REQ` (own Ticket), `IT`, `ADM`. Ordered by `changedAt`, then `id`.

- 200: `[ { "id": 1, "fromStatus": null, "toStatus": "NEW", "changedById": null, "changedByName": null, "changedAt": "..." }, ... ]`
- 403 `TICKET_FORBIDDEN`, 404 `TICKET_NOT_FOUND`. Read only; no write route exists.

## 3. Ticket Retrieval Changes

### `GET /api/tickets/:id`

Adds to the Lab 3 response:

- `version`, `requesterResolvedAt`
- `actionsSummary`: `{ "total": 3, "planned": 1, "completed": 2, "cancelled": 0, "openFollowUps": 1 }`
- Staff only: `resolution`: `{ "canResolve": false, "blockers": [ ... same shape as RESOLUTION_BLOCKED ... ] }`, so the UI explains the blocker without reimplementing the rule.

### `GET /api/tickets`

New query parameters, both roles (Requesters are still scoped to their own
Tickets), validated against allowlists; an unknown value is 400:

| Param | Values | Meaning |
|---|---|---|
| `statusGroup` | `active`, `in-progress`, `waiting`, `resolved` | `active` = `NEW`, `OPEN`, `REOPENED`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`; `in-progress` = `IN_PROGRESS`; `waiting` = `WAITING_FOR_REQUESTER`; `resolved` = `RESOLVED` |
| `requesterReportedResolved` | `true` | only Tickets with `requesterResolvedAt` set |

`statusGroup` is combined with, and does not replace, `currentStatus`; if
both are given, both must match. For `IT` and `ADM`, each list item also
carries `requesterResolvedAt` so the queue can show the "Requester reports
resolved" badge; Requester list items do not change.

## 4. Dashboards

Counts and short lists only. `generatedAt` is the server time (UTC);
`windowDays` is 7. Every card has `key`, `label`, `count`, and `drillDown`
(`{ "view": "my-tickets" | "ticket-queue", "query": { ... } }` using the
`GET /api/tickets` parameters, or `null`).

### `GET /api/dashboard/requester`

Role: `REQ` only (403 for `IT` and `ADM`). Everything is scoped to the
session user.

```json
{
  "generatedAt": "...", "windowDays": 7,
  "cards": [
    { "key": "open", "label": "Open tickets", "count": 3, "drillDown": { "view": "my-tickets", "query": { "statusGroup": "active" } } },
    { "key": "in-progress", "label": "In progress", "count": 1, "drillDown": { "view": "my-tickets", "query": { "statusGroup": "in-progress" } } },
    { "key": "waiting", "label": "Waiting for you", "count": 1, "drillDown": { "view": "my-tickets", "query": { "statusGroup": "waiting" } } },
    { "key": "resolved", "label": "Resolved", "count": 2, "drillDown": { "view": "my-tickets", "query": { "statusGroup": "resolved" } } }
  ],
  "recentlyUpdated": [ { "id": 42, "ticketNumber": "TKT-2026-000042", "summary": "...", "currentStatus": "OPEN", "updatedAt": "..." } ],
  "recentlyResolved": [ { "id": 40, "ticketNumber": "...", "summary": "...", "currentStatus": "RESOLVED", "resolvedAt": "..." } ]
}
```

Lists hold at most 5 items. `recentlyResolved` uses the status history:
Tickets moved to `RESOLVED` or `CLOSED` within the last 7 days. With no
Tickets every count is 0 and both lists are `[]`.

### `GET /api/dashboard/staff`

Role: `IT`, `ADM` (403 for `REQ`).

```json
{
  "generatedAt": "...", "windowDays": 7,
  "cards": [
    { "key": "unassigned", "label": "Unassigned", "count": 7, "drillDown": { "view": "ticket-queue", "query": { "unassignedOnly": "true", "statusGroup": "active" } } },
    { "key": "mine", "label": "Owned by me", "count": 4, "drillDown": { "view": "ticket-queue", "query": { "ticketOwnerId": "8", "statusGroup": "active" } } },
    { "key": "reported-resolved", "label": "Reported resolved by Requester", "count": 2, "drillDown": { "view": "ticket-queue", "query": { "requesterReportedResolved": "true", "statusGroup": "active" } } },
    { "key": "my-planned-actions", "label": "My planned actions", "count": 3, "drillDown": null }
  ],
  "byStatus": [ { "status": "NEW", "count": 5, "drillDown": { "view": "ticket-queue", "query": { "currentStatus": "NEW" } } } ],
  "byItPriority": [ { "priority": "HIGH", "count": 3, "drillDown": { "view": "ticket-queue", "query": { "itPriority": "HIGH", "statusGroup": "active" } } } ],
  "myActions": [ { "actionId": 31, "ticketId": 42, "ticketNumber": "...", "description": "first 80 characters", "actionAt": "..." } ],
  "recentlyUpdated": [ { "id": 42, "ticketNumber": "...", "summary": "...", "currentStatus": "OPEN", "ticketOwnerName": "Alex Rivera", "updatedAt": "..." } ],
  "users": { "active": 9, "inactive": 2, "byRole": { "REQUESTER": 5, "IT_STAFF": 4, "ADMINISTRATOR": 1 } }
}
```

- `byStatus` always lists all 8 statuses (zero counts included); `byItPriority`
  lists LOW, MEDIUM, HIGH.
- `myActions`: `PLANNED` Actions assigned to the caller, `actionAt`
  ascending, at most 5.
- `users` is present only for `ADM`; it is omitted (not null) for `IT`.
- `recentlyUpdated`: 5 newest active Tickets by `updatedAt`.

## 5. Lab 3 Carry-overs

### `GET /api/users/assignable`

Role: `IT`, `ADM`. Active users with role `IT_STAFF` or `ADMINISTRATOR`,
name ascending: `[ { "id": 8, "name": "Alex Rivera", "role": "IT_STAFF" } ]`.
No email or other fields. Registered before `/api/users/:id`.

### `PATCH /api/users/:id` (changed)

Role: `ADM`. Body may now also include `email`. It is trimmed, lowercased,
and checked for format; a duplicate returns 400 `EMAIL_TAKEN`. Self-
deactivation (409 `SELF_DEACTIVATION`) and last-Administrator
(409 `LAST_ADMINISTRATOR`) behavior is unchanged; the UI now maps these codes
to specific messages.

### Attachments

Server rules are unchanged: upload and remove stay `REQ` only (403 for
`IT`/`ADM`); list and download stay open to all three roles. Only the UI
changes, to stop offering controls the server refuses.

## 6. Status Code Summary

| Status | Used for |
|---|---|
| 200 | Retrieval, update, idempotent repeat of a create |
| 201 | Action created |
| 400 | Validation, bad assignee, duplicate email, unknown filter value |
| 401 | No valid session |
| 403 | Wrong role, Requester on another's Ticket, password change required, origin mismatch |
| 404 | Unknown Ticket, Action, or User; Action under the wrong Ticket; any `DELETE` on Actions |
| 409 | `STALE_UPDATE`, `INVALID_TRANSITION`, `RESOLUTION_BLOCKED`, `TICKET_LOCKED`, `ACTION_LOCKED`, `INVALID_ACTION_TRANSITION`, `ALREADY_CLAIMED`, `NOT_APPLICABLE`, `SELF_DEACTIVATION`, `LAST_ADMINISTRATOR` |
| 429 | Login lockout (unchanged) |
| 500 | `INTERNAL_ERROR` |

## 7. Authorization Matrix

| Operation | REQ | IT | ADM |
|---|---|---|---|
| List Actions | own Ticket | any | any |
| Create / edit Action | no (403) | yes | yes |
| Change status, priority, owner, claim | no (403) | yes | yes |
| Mark "appears resolved" | own Ticket | no (403) | no (403) |
| Read status history | own Ticket | any | any |
| Requester dashboard | yes | no (403) | no (403) |
| Staff dashboard | no (403) | yes | yes (plus `users`) |
| Assignable users list | no (403) | yes | yes |
| Edit user email | no | no | yes |
