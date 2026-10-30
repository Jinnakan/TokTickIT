# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal

Complete the core service-desk workflow. IT Staff record the work done on a
Ticket as Actions Taken, the Ticket lifecycle is enforced end to end by the
backend (including a resolution gate and stale-update protection), and each
role lands on a concise dashboard that links into the detailed screens. The
sprint ends with a hardening pass so Labs 1 to 3 keep working as one
coherent, accessible, responsive application.

## 2. Stakeholder Request Interpretation

The service desk can already take Tickets and talk to Requesters. What is
missing is a reliable record of the work itself. Each Ticket needs a list of
Actions Taken (what was done, by whom, with what result, and whether
follow-up is still owed) so a Ticket cannot be called Resolved while work is
unfinished. The primary Ticket Owner coordinates the Ticket, but any IT Staff
member may do and record an action. A Requester can say "this looks fixed",
but only IT Staff close the loop. Dashboards give each role a short answer to
"what needs my attention?" and always link to the full list, never replace it.
Everything stays inside the existing Zen Green design and the authorization
rules from Lab 3.

## 3. Scope

### Included

- Actions Taken: create, list, edit, complete and cancel, under each Ticket
- Final Ticket status-transition matrix and a backend resolution gate
- Stale-update detection (optimistic concurrency) on Ticket and Action edits
- Append-only Ticket status history
- Requester "Problem Appears Resolved" indication (advisory only)
- Requester dashboard and IT Staff dashboard (Administrator reuses the staff
  one and adds user counts), with drill-down links and empty states
- Lab 3 carry-overs: reassign control and assignable-staff list, Administrator
  email edit, clear error messages, attachment controls hidden from IT Staff
- Final hardening: regression, accessibility, double-submit protection,
  removal of leftover placeholder and inconsistent UI

### Excluded (labsheet §4.2)

- SLA clocks, escalation, on-call scheduling, breach notifications
- Email, SMS, LINE, push, or any external notification
- Inventory, spare parts, purchasing, cost accounting, billing, payroll,
  labor-cost calculation
- Multi-level approvals and electronic signatures
- BI tools, report builders, exports
- Multi-tenant organizations, production-scale cloud operations
- Deleting an Action Taken (Actions are cancelled, never deleted)
- Any feature not listed in this contract

## 4. Functional Requirements

- **FR-L4-01** IT Staff and Administrators shall create an Action Taken under
  a Ticket they can access.
- **FR-L4-02** The system shall set "Performed by" from the authenticated
  session, never from request data.
- **FR-L4-03** An Action Taken shall have an assignee (an active IT Staff or
  Administrator), which may differ from the Ticket Owner and from the
  creator.
- **FR-L4-04** IT Staff and Administrators shall edit an Action Taken, move
  it from Planned to Completed or Cancelled, and mark a required follow-up
  as done.
- **FR-L4-05** A Requester shall view all Actions Taken on their own Tickets
  and shall not create or change any.
- **FR-L4-06** The system shall enforce the Ticket transition matrix (§5
  BR-L4-09) for every status change, regardless of the client used.
- **FR-L4-07** The system shall refuse a transition to Resolved while the
  resolution gate (BR-L4-10) has blockers, and shall report the blockers.
- **FR-L4-08** The system shall reject an update made against an outdated
  Ticket or Action version and shall not overwrite the newer change.
- **FR-L4-09** The system shall record every status change in an append-only
  history with actor and time.
- **FR-L4-10** A Requester shall be able to indicate that the problem appears
  resolved, without changing the Ticket status.
- **FR-L4-11** IT Staff shall see when a Requester has reported a problem as
  resolved, on the queue, the Ticket Detail, and the staff dashboard.
- **FR-L4-12** A Requester shall retrieve a dashboard of only their own
  Tickets (BR-L4-14).
- **FR-L4-13** IT Staff and Administrators shall retrieve a staff dashboard
  (BR-L4-15); Administrators additionally receive user-account counts.
- **FR-L4-14** Every dashboard card shall have a defined query, an empty
  state, and a drill-down to the matching filtered list where one exists.
- **FR-L4-15** IT Staff shall reassign a Ticket to any active IT Staff or
  Administrator chosen from a list supplied by the backend.
- **FR-L4-16** An Administrator shall edit a User's email address, with the
  same duplicate-email rule as creation.
- **FR-L4-17** The application shall show a clear, specific message for a
  duplicate email, self-deactivation, last-Administrator, stale update, and
  blocked resolution, instead of a generic failure message.
- **FR-L4-18** Repeated clicks or a network retry shall not create duplicate
  Actions Taken.

## 5. Business Rules

| BR ID | Rule |
|---|---|
| BR-L4-01 | An Action Taken belongs to exactly one Ticket. |
| BR-L4-02 | The Ticket Owner coordinates the Ticket; an Action Taken may be created by, and assigned to, a different IT Staff member or Administrator. |
| BR-L4-03 | An Action's assignee must be an active user whose role is IT Staff or Administrator. An inactive user, a Requester, or an unknown id is rejected with 400. If no assignee is supplied it defaults to the creator. |
| BR-L4-04 | "Performed by" is the session user who created the Action. A `performedBy`, `createdById`, or `ticketId` in a request body is ignored. |
| BR-L4-05 | Action status is `PLANNED`, `COMPLETED`, or `CANCELLED`. Allowed moves are `PLANNED` to `COMPLETED` and `PLANNED` to `CANCELLED`. `CANCELLED` is read-only. A `COMPLETED` Action may only have its follow-up fields and attachment notes changed. |
| BR-L4-06 | `description` is required, 1 to 2000 characters. `result` is required when the Action is `COMPLETED`, at most 2000 characters. `actionAt` defaults to now and may not be in the future for a `COMPLETED` Action. |
| BR-L4-07 | `followUpNote` is required (1 to 1000 characters) when `followUpRequired` is true, and must be empty when it is false. A follow-up is open until `followUpDoneAt` is set. `attachmentNotes` is free text, at most 500 characters, naming which uploaded file to look at. |
| BR-L4-08 | Actions cannot be created or edited while the Ticket is `CLOSED` or `CANCELLED` (409 `TICKET_LOCKED`). Actions are never deleted. |
| BR-L4-09 | Status transitions are: `NEW` to `OPEN` or `CANCELLED`; `OPEN` to `IN_PROGRESS` or `CANCELLED`; `IN_PROGRESS` to `WAITING_FOR_REQUESTER`, `RESOLVED`, or `CANCELLED`; `WAITING_FOR_REQUESTER` to `IN_PROGRESS`, `RESOLVED`, or `CANCELLED`; `RESOLVED` to `CLOSED` or `REOPENED`; `CLOSED` to `REOPENED`; `REOPENED` to `IN_PROGRESS` or `CANCELLED`; `CANCELLED` is terminal. Only IT Staff and Administrators perform transitions. |
| BR-L4-10 | Resolution gate: a Ticket may move to `RESOLVED` only when it has at least one `COMPLETED` Action, no `PLANNED` Action, and no open required follow-up. Otherwise the API returns 409 `RESOLUTION_BLOCKED` with the blocker list. The gate is checked only at the moment of the transition. |
| BR-L4-11 | The Requester indication "problem appears resolved" sets `requesterResolvedAt` and never changes `currentStatus`. It is allowed only on the Requester's own Ticket in `OPEN`, `IN_PROGRESS`, or `WAITING_FOR_REQUESTER`, and is cleared when the Ticket moves to `REOPENED`. |
| BR-L4-12 | Moving a Ticket to `CANCELLED` sets all its remaining `PLANNED` Actions to `CANCELLED` in the same transaction. |
| BR-L4-13 | Every Ticket mutation made by claim, reassign, priority change, or status change increments `Ticket.version`. Update requests carry `expectedVersion`; a mismatch returns 409 `STALE_UPDATE` and changes nothing. Action edits carry the Action's own `version` with the same behavior. Adding an Action, Comment, or Note updates `Ticket.updatedAt` but not `version`. |
| BR-L4-14 | Requester dashboard (all counts are the Requester's own Tickets, computed by the backend): Open = status in `NEW`, `OPEN`, `REOPENED`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`; In Progress = `IN_PROGRESS`; Waiting for you = `WAITING_FOR_REQUESTER`; Resolved = `RESOLVED`. Recently updated = 5 newest by `updatedAt`. Recently resolved = up to 5 Tickets moved to `RESOLVED` or `CLOSED` in the last 7 days, taken from the status history. |
| BR-L4-15 | Staff dashboard: Unassigned = active Tickets with no owner; Mine = active Tickets owned by the caller; Reported resolved = active Tickets with `requesterResolvedAt` set; My planned actions = `PLANNED` Actions assigned to the caller; By status = count per status over all Tickets; By IT Priority = count per priority over active Tickets; Recently updated = 5 newest active Tickets. Active = `NEW`, `OPEN`, `REOPENED`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`. The Administrator response adds counts of active and inactive Users and a count per role. |
| BR-L4-16 | Dashboards return counts, short lists (at most 5 items, 6 fields each), and drill-down targets, never whole Ticket collections. "Recent" means a rolling 7 days measured from the server time of the request in UTC, so no calendar-day or time-zone boundary applies. Times are displayed in the viewer's local time. |
| BR-L4-17 | Every dashboard card's count equals the number of rows its drill-down list returns when opened, for the same user. |
| BR-L4-18 | Status history rows are append-only: no endpoint updates or deletes them. They are ordered by `changedAt` ascending, then `id` ascending. |
| BR-L4-19 | A POST that creates an Action may carry a client-generated `requestId`. A repeat of the same `requestId` on the same Ticket returns the original Action with 200 and creates nothing. |
| BR-L4-20 | Lab 3 rules BR-L3-01 to BR-L3-22 continue to apply. In particular, cross-role access returns 403 for an existing resource and 404 for an unknown id, and an Action addressed through the wrong Ticket id returns 404. |

## 6. UI Specification Summary

Detail is in `ui-spec.md`. Summary:

- **Navigation:** every role lands on a Dashboard. Requester: Dashboard, My
  Tickets, Create Ticket. IT Staff: Dashboard, Ticket Queue. Administrator:
  Dashboard, Ticket Queue, User Management. The active page is indicated.
- **Requester Dashboard:** four count cards, recently updated and recently
  resolved lists, quick actions.
- **Staff Dashboard:** metric cards, status and priority breakdowns, my
  planned actions, recently updated Tickets; Administrator also sees user counts.
- **Actions Taken (Ticket Detail):** a list of Actions with status badge,
  create form, edit mode, and a read-only view for Requesters.
- **Ticket workflow control:** shows only permitted transitions and, when
  Resolved is blocked, lists the blockers beside the control.
- **Carry-overs:** reassign selector, "Problem Appears Resolved" button,
  email field on user edit, specific error messages, no attachment edit
  controls for IT Staff.
- All screens reuse the Zen Green tokens, badges, forms, tables, and
  responsive rules from Labs 2 and 3.

## 7. Data Changes

Additive only. No existing table loses a column or row.

- **ActionTaken** (new): `id`, `ticketId` (FK), `createdById` (FK User),
  `assigneeId` (FK User), `actionAt`, `description`, `result` (nullable),
  `status` (enum `ActionStatus`), `followUpRequired`, `followUpNote`
  (nullable), `followUpDoneAt` (nullable), `attachmentNotes` (nullable),
  `requestId` (nullable), `version` (default 1), `createdAt`, `updatedAt`.
  Unique `(ticketId, requestId)`. Indexes on `ticketId`, and on
  `(assigneeId, status)` for the dashboard list.
- **TicketStatusHistory** (new): `id`, `ticketId` (FK), `fromStatus`
  (nullable), `toStatus`, `changedById` (nullable FK User), `changedAt`.
  Index on `(ticketId, changedAt)`.
- **Ticket** (extended): `version` Int default 1, `requesterResolvedAt`
  DateTime nullable. New indexes on `currentStatus` and on
  `(requesterId, currentStatus)` for the dashboard counts.
- **Migration and backfill:** every existing Ticket keeps all fields. Existing
  Tickets start with `version = 1`, no `requesterResolvedAt`, and zero
  Actions. One baseline history row is written per existing Ticket with
  `fromStatus` null, `toStatus` equal to the current status, `changedAt` equal
  to the Ticket's `updatedAt`, and `changedById` null. Legacy Tickets already
  `RESOLVED` or `CLOSED` are not re-checked against the gate. A legacy open
  Ticket needs at least one completed Action before it can be resolved.
  Dashboards count legacy Tickets exactly like new ones.
- **Rollback and recovery:** the migration only adds tables, columns, and
  indexes, so it is reversible. A `rollback.sql` file beside the migration
  drops the new objects, is not run automatically, and is exercised by the
  migration test against a copy of the data before and after.
- **Seed (idempotent):** extends the opt-in demo seed (`prisma:seed:demo`)
  with Tickets that have zero, one, and several Actions across every status
  and priority, owned and unowned, and a Requester with no Tickets so the
  zero-metric case is demonstrable. The default `prisma:seed` stays minimal
  so automated tests keep a stable baseline (the same decision that kept demo
  tickets out of the Lab 3 seed).

### Database design decisions

1. **Integer `version` for optimistic concurrency**, not `updatedAt`
   comparison. Timestamps can tie or lose precision across the API boundary,
   and every client would need exact timestamp round-tripping. An integer is
   exact, cheap to compare in the `WHERE` of an `UPDATE`, and needs no row
   locks, so one slow editor never blocks another.
2. **Separate `TicketStatusHistory` table**, not reading `updatedAt` or an
   audit log. "Recently resolved" must mean when a Ticket was resolved, which
   `updatedAt` loses the moment a comment is added. A dedicated append-only
   table also gives the stable ordering and audit trail the workflow needs.
3. **`ActionTaken` as its own table**, not JSON on `Ticket`. Actions are
   queried by assignee and status for the dashboard, edited individually with
   their own `version`, and need foreign keys to Users.
4. **Targeted indexes** on `Ticket.currentStatus`,
   `(requesterId, currentStatus)`, and `ActionTaken(assigneeId, status)` so
   dashboard counts stay index-backed as data grows; chosen from the actual
   dashboard queries, not added speculatively.

## 8. API Contract

Full shapes, statuses, and errors are in `api-spec.md`. Added or changed:

- `POST /api/tickets/:ticketId/actions`, `GET /api/tickets/:ticketId/actions`,
  `PATCH /api/tickets/:ticketId/actions/:actionId`
- `GET /api/tickets/:id/history`
- `PATCH /api/tickets/:id/status`, `PATCH /api/tickets/:id/priority`,
  `POST /api/tickets/:id/reassign`, `POST /api/tickets/:id/claim` (now
  version-aware)
- `POST /api/tickets/:id/appears-resolved`
- `GET /api/tickets/:id` (adds `version`, `requesterResolvedAt`,
  `actionsSummary`, and for staff `resolution`)
- `GET /api/tickets` (adds `statusGroup` and `requesterReportedResolved`)
- `GET /api/dashboard/requester`, `GET /api/dashboard/staff`
- `GET /api/users/assignable`; `PATCH /api/users/:id` now accepts `email`

## 9. Design Patterns

| Pattern | Lives in | Why here |
|---|---|---|
| Strategy | `server/src/dashboard/metrics/*` | Each dashboard metric is one class with the same `compute(user, now)` shape, so adding or testing a metric never touches the others or the route. |
| Facade | `server/src/tickets/ticket-workflow-service.ts` | One entry point coordinates state check, resolution gate, version check, history append, and side effects in one transaction, so route handlers stay thin. |
| State (extended) | `server/src/tickets/ticket-state/*` | The existing per-status classes keep owning the transition matrix; the gate is a separate policy called by the facade, so the matrix stays pure. |
| Builder (extended) | `server/src/staff/ticket-query-builder.ts` | `withStatusGroup()` and `reportedResolved()` are two more chained steps, which keeps drill-down filters on the same allowlisted path. |
| Mediator (extended) | client `staff/ticket-detail-mediator.ts` | Adding an Action or changing status refreshes the Actions list, the status control, and the summary through the same single refresh point. |

## 10. Security Requirements

| Class | Mitigation |
|---|---|
| IDOR / broken access control | Every action and dashboard route checks session then role, then ownership. An action fetched through the wrong ticket id is 404. Dashboards are scoped by the session user id. |
| Mass assignment | Create and update read an explicit field allowlist; `createdById`, `ticketId`, `version`-on-create, and `status` fields not permitted for the role are ignored. |
| Injection (SQL) | Prisma only; `statusGroup` and every filter are validated against allowlists. The Lab 3 static guard test still runs. |
| XSS | Action text and follow-up notes render through React text interpolation only. |
| Concurrency / lost update | `expectedVersion` checks inside the write, not a read-then-write gap. |
| Replay / double submit | `requestId` uniqueness on Action creation; client disables the control while a request is pending. |
| Information leakage | Dashboard and error bodies carry no stack traces and no other user's data; errors use stable codes. |

## 11. Acceptance Criteria

| AC ID | Criterion |
|---|---|
| AC-L4-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator as Performed by and the chosen active assignee. |
| AC-L4-02 | Given a request body that contains `performedBy`, `createdById`, or another `ticketId`, when an Action is created, then those values are ignored. |
| AC-L4-03 | Given an assignee who is inactive, a Requester, or unknown, when an Action is created or edited, then the API returns 400 and nothing is saved. |
| AC-L4-04 | Given `followUpRequired` is true with no note, or false with a note, when an Action is saved, then the API returns 400. |
| AC-L4-05 | Given a Requester, when they list Actions on their own Ticket, then all are returned; when they try to create or edit one, then the API returns 403; when they list another Requester's Ticket, then the API returns 403. |
| AC-L4-06 | Given an Action id that belongs to a different Ticket, when it is read or edited through this Ticket, then the API returns 404. |
| AC-L4-07 | Given an Action assigned to or created by an IT Staff member who is not the Ticket Owner, when it is saved, then it is accepted. |
| AC-L4-08 | Given two users edit the same Action or Ticket, when the second submits an outdated version, then the API returns 409 `STALE_UPDATE` and the first change is preserved. |
| AC-L4-09 | Given a `CANCELLED` Action, when an edit is attempted, then the API returns 409; given a `COMPLETED` Action, when a description edit is attempted, then it is rejected while follow-up fields can still change. |
| AC-L4-10 | Given the same `requestId` is sent twice, when the second request arrives, then no duplicate Action exists. |
| AC-L4-11 | Given a `CLOSED` or `CANCELLED` Ticket, when an Action is created or edited, then the API returns 409 `TICKET_LOCKED`. |
| AC-L4-12 | Given a Ticket with no completed Action, a `PLANNED` Action, or an open required follow-up, when a transition to `RESOLVED` is requested directly through the API, then it returns 409 `RESOLUTION_BLOCKED` listing the blockers; when none remain, then it succeeds. |
| AC-L4-13 | Given any status pair not in BR-L4-09, when a transition is requested, then the API returns 409 `INVALID_TRANSITION`; given a valid pair, then it succeeds and `currentStatus` updates. |
| AC-L4-14 | Given a Requester, when they call the status, priority, reassign, or claim endpoints, then the API returns 403. |
| AC-L4-15 | Given a Requester marks "problem appears resolved" on their own active Ticket, when it is saved, then `requesterResolvedAt` is set, `currentStatus` is unchanged, and IT Staff see the indicator; on another user's Ticket or a closed one, it is refused. |
| AC-L4-16 | Given a Ticket moved to `REOPENED`, when the transition completes, then `requesterResolvedAt` is cleared. |
| AC-L4-17 | Given a Ticket moves through several statuses, when its history is read, then every change appears once, in stable order, with its actor, and no endpoint can edit or delete a row. |
| AC-L4-18 | Given a Ticket is cancelled, when the transition completes, then every `PLANNED` Action on it is `CANCELLED`. |
| AC-L4-19 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned and each count equals a direct database query. |
| AC-L4-20 | Given an IT Staff user, when staff dashboard data is retrieved, then each metric equals its database query; given an Administrator, then the same data plus user counts is returned and an IT Staff response has no user counts. |
| AC-L4-21 | Given the wrong role or no session, when a dashboard endpoint is called, then the API returns 403 or 401. |
| AC-L4-22 | Given a user with no matching records, when the dashboard is retrieved, then every count is 0, lists are empty, and the UI shows an empty message instead of blank space. |
| AC-L4-23 | Given a dashboard card, when its drill-down is opened, then the list shows exactly as many Tickets as the card's count. |
| AC-L4-24 | Given the Lab 4 migration has run, when pre-existing Tickets, Comments, Notes, Attachments, and Users are read, then all are unchanged, legacy Tickets have zero Actions and one baseline history row, and dashboards include them. |
| AC-L4-25 | Given the Lab 3 carry-overs are done, when IT Staff reassign a Ticket, an Administrator edits an email, a duplicate email or self-deactivation is attempted, or IT Staff open a Requester's attachments, then each behaves per FR-L4-15 to FR-L4-17 and the attachment edit controls are absent. |
| AC-L4-26 | Given the Actions Taken UI, when a save fails recoverably, then entered values remain; when Save is clicked repeatedly, then one request is sent. |
| AC-L4-27 | Given any Lab 4 screen at desktop, tablet, and mobile widths, when it renders, then nothing is clipped or overlapping, the page does not scroll horizontally, every control is keyboard reachable with visible focus, and status is never shown by color alone. |
| AC-L4-28 | Given the full Lab 1 to Lab 3 test suites, when they run against the Lab 4 code, then they all pass. |
| AC-L4-29 | Given a database of about 300 Tickets, when either dashboard is requested, then it responds within one second. |

## 12. Definition of Done

**Product completion**

- Every Functional Requirement, Business Rule, and Security Requirement here
  is implemented.
- Every Acceptance Criterion has at least one passing, traceable automated
  test in `tests.md`; none is skipped, disabled, or commented out.
- Labs 1 to 3 suites still pass, and the full suite plus E2E pass from the
  documented commands on `main`.
- All write operations are enforced by the backend and tested by calling the
  API directly, not only through the UI.
- Dashboard numbers are verified against direct database queries.
- No console errors, broken links, placeholder text, or unfinished controls;
  README setup, seed, migration, test, and demo steps are current.
- Screens meet the Zen Green, responsive, and accessibility checklist in
  `ui-spec.md` at desktop, tablet, and mobile.

**Course delivery**

- Each Issue is implemented on its own feature branch and merged into
  `lab4-staging` by a peer-reviewed Pull Request.
- This specification and `tests.md` exist and are merged before the main
  implementation PRs.
- One release Pull Request goes from `lab4-staging` to `main`.
- `reviewer.md` and `ai-use.md` are current, and the Kanban shows every Lab 4
  Issue in Done.

## 13. Assumptions and Decisions

- **Assignee and status are added to Actions Taken.** The handout's field list
  has neither, but the required demonstrations include assigning, completing,
  cancelling, and rejecting an inactive assignee, so the model carries both.
  "Performed by" stays the creator; the assignee is who is responsible for
  doing it.
- **Resolution gate meaning.** "Incomplete Actions" is read as: nothing is
  still `PLANNED`, at least one Action is `COMPLETED`, and no required
  follow-up is open. A Ticket that was fixed with no recorded work cannot be
  resolved, which is the point of the rule.
- **Actions are cancelled, never deleted,** so the record of what was planned
  survives and "append-only" holds for history.
- **Administrator may own Tickets and take actions.** The handout lets an
  Administrator perform IT Staff behavior, and says a Ticket Owner is an
  active IT Staff or Administrator, so reassign accepts both roles.
- **Requester cannot reopen or cancel.** The only Requester workflow input is
  the advisory indication, which keeps formal status changes with IT Staff.
- **Rolling 7-day window** for "recent", chosen so no time-zone or calendar
  boundary can change a count between users.
- **Demo data stays opt-in.** Tests build their own data, so the default seed
  never changes test baselines.
- **One card has no list drill-down.** "My planned actions" links each item
  to its Ticket Detail instead, since no standalone Actions list screen is in
  scope. BR-L4-17 applies to every other card.
