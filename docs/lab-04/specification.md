# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal

Complete the core service-desk workflow. IT Staff record the work done on a
Ticket as Actions Taken, the backend enforces the whole Ticket lifecycle
(including a resolution gate and protection against stale or simultaneous
edits), and every role starts on a concise dashboard that links into the
detailed screens. The sprint ends with a hardening pass so Labs 1 to 3 keep
working as one coherent, accessible, responsive application.

## 2. Stakeholder Request Interpretation

The service desk can already receive Tickets and talk to Requesters. What is
missing is a reliable record of the work itself. Each Ticket needs a list of
Actions Taken (what was done, by whom, with what result, and whether
follow-up is still owed), so a Ticket cannot be called Resolved while work is
unfinished. The Ticket Owner coordinates the Ticket, but any IT Staff member
may do and record an action. A Requester can say "this looks fixed", but only
IT Staff close the loop. Dashboards answer "what needs my attention?" in a
few cards and always link to the full lists, never replace them. Everything
stays inside the Zen Green design and the authorization rules from Lab 3.

## 3. Scope

### Included

- Actions Taken: create, list, edit, start, complete, and cancel, under each Ticket
- The final Ticket status-transition matrix and a backend resolution gate
- Stale-update detection on Ticket and Action edits, and serialization of
  simultaneous workflow changes on one Ticket
- An append-only Ticket status history
- The Requester "Problem appears resolved" indication (advisory only)
- Requester and IT Staff dashboards (Administrator reuses the staff
  dashboard and adds user counts) with drill-down links and empty states
- Lab 3 carry-overs: reassign control with a backend staff list,
  Administrator email edit, specific error messages, attachment controls
  hidden from roles the server already refuses
- Final hardening: regression, accessibility, double-submit protection,
  stable tests, and removal of leftover inconsistent UI

### Excluded (handout §4.2)

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
- **FR-L4-03** An Action Taken shall have an assignee who is an active IT
  Staff member or Administrator, and who may differ from the Ticket Owner and
  from the creator.
- **FR-L4-04** IT Staff and Administrators shall edit an Action Taken, move it
  through Planned, In Progress, Completed, and Cancelled as allowed, and mark
  a required follow-up as done.
- **FR-L4-05** A Requester shall view all Actions Taken on their own Tickets
  and shall not create or change any.
- **FR-L4-06** The backend shall enforce the Ticket status-transition matrix
  for every client, including one that bypasses the normal screen.
- **FR-L4-07** The backend shall refuse a transition to Resolved while the
  resolution gate has blockers, and report each blocker.
- **FR-L4-08** The backend shall reject an update made against an outdated
  Ticket or Action version and shall not overwrite the newer change.
- **FR-L4-09** The system shall record every status change, including
  creation, in an append-only history with actor and time.
- **FR-L4-10** A Requester shall be able to indicate that the problem appears
  resolved without changing the Ticket status.
- **FR-L4-11** IT Staff shall see when a Requester has reported a problem as
  resolved, in the queue, on Ticket Detail, and on the staff dashboard.
- **FR-L4-12** A Requester shall retrieve a dashboard built only from their
  own Tickets.
- **FR-L4-13** IT Staff and Administrators shall retrieve a staff dashboard;
  Administrators additionally receive user-account counts.
- **FR-L4-14** Every dashboard card shall have a defined query, an empty
  state, and a drill-down to the matching list where one exists.
- **FR-L4-15** IT Staff shall reassign a Ticket to any active IT Staff member
  or Administrator chosen from a list supplied by the backend.
- **FR-L4-16** An Administrator shall edit a User's email address, with the
  same duplicate rule as creation.
- **FR-L4-17** The application shall show a specific message for a duplicate
  email, self-deactivation, last Administrator, stale update, and blocked
  resolution, instead of a generic failure.
- **FR-L4-18** Repeated clicks or a network retry shall not create duplicate
  Actions Taken.
- **FR-L4-19** Every role shall land on a Dashboard; Administrators shall also
  reach the Ticket Queue.
- **FR-L4-20** Labs 1 to 3 behavior shall be preserved, with no console
  errors, broken links, or leftover placeholders in the final application.

## 5. Business Rules

| BR ID | Rule |
|---|---|
| BR-L4-01 | An Action Taken belongs to exactly one Ticket. |
| BR-L4-02 | The Ticket Owner coordinates the Ticket; an Action Taken may be created by, and assigned to, a different IT Staff member or Administrator. |
| BR-L4-03 | An Action's assignee must be an active user whose role is IT Staff or Administrator; otherwise the API returns 400. With no assignee supplied it defaults to the creator. The check runs when an assignee is chosen or changed, not on every later edit. |
| BR-L4-04 | "Performed by" is the session user who created the Action. A `createdById`, `ticketId`, `version`, or any unknown field in a request body is ignored. |
| BR-L4-05 | Action status is `PLANNED`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`. A new Action may start as Planned, In Progress, or Completed. Allowed moves: Planned to In Progress, Completed, or Cancelled; In Progress to Completed or Cancelled. Completed and Cancelled are final. A Cancelled Action is read-only. A Completed Action may only change its follow-up fields and attachment notes. |
| BR-L4-06 | `description` is required, 1 to 2000 characters. `result` is required when the Action is Completed, up to 2000 characters. `actionAt` defaults to now; a Completed Action may not be dated more than one minute in the future (clock skew), a Planned or In Progress one may. All text is trimmed, and an empty optional text is stored as null. |
| BR-L4-07 | `followUpNote` is required (1 to 1000 characters) when `followUpRequired` is true and must be empty when it is false. A follow-up is open until `followUpDoneAt` is set. `attachmentNotes` is free text, up to 500 characters, naming which uploaded file to look at. |
| BR-L4-08 | Actions cannot be created or edited while the Ticket is `CLOSED` or `CANCELLED` (409 `TICKET_LOCKED`). Actions are never deleted. |
| BR-L4-09 | Ticket transitions: `NEW` to `OPEN` or `CANCELLED`; `OPEN` to `IN_PROGRESS` or `CANCELLED`; `IN_PROGRESS` to `WAITING_FOR_REQUESTER`, `RESOLVED`, or `CANCELLED`; `WAITING_FOR_REQUESTER` to `IN_PROGRESS`, `RESOLVED`, or `CANCELLED`; `RESOLVED` to `CLOSED` or `REOPENED`; `CLOSED` to `REOPENED`; `REOPENED` to `IN_PROGRESS` or `CANCELLED`; `CANCELLED` is terminal. Only IT Staff and Administrators make transitions; a Requester never does. |
| BR-L4-10 | Resolution gate: a Ticket may move to `RESOLVED` only when it has at least one `COMPLETED` Action, no `PLANNED` or `IN_PROGRESS` Action, and no open required follow-up on a non-cancelled Action. Otherwise the API returns 409 `RESOLUTION_BLOCKED` with a blocker list. The gate is evaluated only at the moment of the transition, so Tickets already Resolved or Closed are not rechecked. A legacy Ticket with no Actions cannot be resolved until one Completed Action is recorded. |
| BR-L4-11 | Every write that can change the gate's answer (creating or editing an Action, and changing a Ticket's status) runs in one transaction that first locks the Ticket row (`SELECT ... FOR UPDATE`, the pattern Lab 2 uses for the attachment limit). Two simultaneous requests on one Ticket therefore run one after the other, so an Action cannot slip in while another user resolves the Ticket. |
| BR-L4-12 | The Requester indication sets `requesterResolvedAt` and never changes `currentStatus`. It is allowed only on the Requester's own Ticket in `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`, is idempotent (the first time is kept), and is cleared when the Ticket moves to `REOPENED`. |
| BR-L4-13 | Moving a Ticket to `CANCELLED` sets its remaining `PLANNED` and `IN_PROGRESS` Actions to `CANCELLED` in the same transaction. |
| BR-L4-14 | `Ticket.version` increases by one on every claim, reassign, priority change, and status change. Reassign, priority, and status requests carry `expectedVersion`; a mismatch returns 409 `STALE_UPDATE` and changes nothing. Claim is already an atomic check-and-set. Each Action has its own `version` with the same rule on edit. The Requester indication, and adding Actions, Comments, or Notes, do not change `Ticket.version`. |
| BR-L4-15 | Any child activity (a new or edited Action, Comment, Note, Attachment upload or removal) refreshes `Ticket.updatedAt`, so "recently updated" means any activity on the Ticket. |
| BR-L4-16 | `TicketStatusHistory` rows are append-only: written in the same transaction as the change, never updated or deleted, and ordered by `changedAt` then `id`. Creating a Ticket writes the first row (no previous status). The migration writes one baseline row per existing Ticket. |
| BR-L4-17 | Requester dashboard, all from the Requester's own Tickets: Open = status in `NEW`, `OPEN`, `REOPENED`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`; In Progress = `IN_PROGRESS`; Waiting for you = `WAITING_FOR_REQUESTER`; Resolved = `RESOLVED`. Recently updated = the 5 newest by `updatedAt`. Recently resolved = up to 5 Tickets that are now Resolved or Closed and whose latest move to Resolved is within the last 7 days, from the status history. |
| BR-L4-18 | Staff dashboard: Unassigned = active Tickets with no owner; Owned by me = active Tickets owned by the caller; Reported resolved = active Tickets with `requesterResolvedAt` set; My open actions = `PLANNED` or `IN_PROGRESS` Actions assigned to the caller; By status = a count per status over all Tickets; By IT Priority = a count per priority over active Tickets; Recently updated = the 5 newest active Tickets. "Active" means the same five statuses as BR-L4-17 Open. The Administrator response adds counts of active and inactive Users and a count per role. |
| BR-L4-19 | Dashboards return counts, short lists (at most 5 items of at most 6 fields), and drill-down targets, never whole Ticket collections. "Recent" is a rolling 7 days from the server time of the request, measured in UTC, so no calendar-day or time-zone boundary changes a count between users. Times are shown in the viewer's local time. |
| BR-L4-20 | Every card count equals the number of rows its drill-down list returns for the same user at the same moment. |
| BR-L4-21 | A create request may carry a client-generated `requestId`. A repeat of the same `requestId` on the same Ticket returns the original Action and creates nothing, including when two identical requests arrive at once. |
| BR-L4-22 | Lab 3 rules BR-L3-01 to BR-L3-22 still apply. In particular, role is checked before ownership, an existing resource owned by someone else returns 403, an unknown id returns 404, and an Action addressed through the wrong Ticket returns 404. |
| BR-L4-23 | After login every role lands on its Dashboard. The active navigation item is marked in text (underline plus `aria-current`), not by color alone. |

## 6. UI Specification Summary

Detail is in `ui-spec.md`.

- **Navigation:** Requester: Dashboard, My Tickets, Create Ticket. IT Staff:
  Dashboard, Ticket Queue. Administrator: Dashboard, Ticket Queue, User
  Management.
- **Requester Dashboard:** four count cards, recently updated and recently
  resolved lists, quick actions.
- **Staff Dashboard:** metric cards, status and priority breakdowns, my open
  actions, recently updated Tickets; Administrators also see a user-count strip.
- **Actions Taken (Ticket Detail):** list with status badges, create form, edit
  mode, Start, Complete, and Cancel actions, and a read-only list for Requesters.
- **Ticket workflow controls:** only the permitted transitions, with blockers
  shown when Resolved is not yet allowed; a collapsed status history.
- **Carry-overs:** reassign selector, Requester "Problem appears resolved"
  button, editable email on user edit, specific messages, no attachment
  controls for IT Staff.
- Zen Green tokens, badges, forms, tables, cards, and the responsive rules of
  Labs 2 and 3 are reused.

## 7. Data Changes

One additive migration. No existing table loses a column or a row.

- **ActionTaken** (new): `id`, `ticketId` (FK), `createdById` (FK User),
  `assigneeId` (FK User), `actionAt`, `description`, `result` (nullable),
  `status` (enum `ActionStatus`), `followUpRequired`, `followUpNote`
  (nullable), `followUpDoneAt` (nullable), `attachmentNotes` (nullable),
  `requestId` (nullable), `version` (default 1), `createdAt`, `updatedAt`.
  Unique `(ticketId, requestId)`; indexes on `ticketId` and
  `(assigneeId, status)`.
- **TicketStatusHistory** (new): `id`, `ticketId` (FK), `fromStatus`
  (nullable), `toStatus`, `changedById` (nullable FK User), `changedAt`.
  Index on `(ticketId, changedAt)`.
- **Ticket** (extended): `version` Int default 1, `requesterResolvedAt`
  DateTime nullable. New indexes on `currentStatus`, `updatedAt`, and
  `(requesterId, currentStatus)`, chosen from the dashboard queries.
- **Backfill:** every existing Ticket gets `version = 1`, no
  `requesterResolvedAt`, zero Actions, and one baseline history row
  (`fromStatus` null, `toStatus` the current status, `changedAt` the Ticket's
  `updatedAt`, `changedById` null). Dashboards count legacy Tickets exactly
  like new ones; a legacy "recently resolved" Ticket is dated by its baseline.
- **Preservation of earlier labs:** Users, Sessions, Categories, Related
  Systems, Tickets, Comments, Notes, and Attachments keep every column and row.
  Lab 2 and Lab 3 endpoints keep their paths, shapes, and status codes; the
  responses only gain fields.
- **Rollback and recovery:** the migration only adds tables, columns, and
  indexes. A `rollback.sql` beside it drops them, is not run automatically,
  and is exercised in a test inside a transaction that is then discarded,
  checking that earlier data is intact.
- **Seed (idempotent):** the opt-in demo seed gains Tickets with zero, one, and
  several Actions across every status, priority, and ownership case, a done and
  an open follow-up, and a Requester with no Tickets for the zero-metric case.
  Rows are matched by stable keys and existing rows are never overwritten.
  The default `prisma:seed` stays minimal so automated tests keep a stable
  baseline.

### Database design decisions

1. **Integer `version` for optimistic concurrency**, not an `updatedAt`
   comparison. Timestamps can tie and need exact round-tripping through JSON;
   an integer is exact, is compared inside the `WHERE` of the `UPDATE`, and
   needs no lock held while a person is typing.
2. **A ticket-row lock for the resolution gate.** The gate reads other rows
   (Actions), so a version check on the Ticket alone cannot stop an Action
   being added while another user resolves. Locking the Ticket row for the
   short write transaction serializes them, using the pattern already proven
   for the attachment limit.
3. **A separate `TicketStatusHistory` table**, not `updatedAt` or a log. "Recently
   resolved" must mean when a Ticket was resolved, which `updatedAt` loses
   as soon as a comment is added.
4. **`ActionTaken` as its own table**, not JSON on `Ticket`: Actions are
   queried by assignee and status, edited individually with their own
   version, and need foreign keys to Users.
5. **Targeted indexes** taken from the real dashboard queries, so counts stay
   index-backed as data grows, instead of speculative ones.

## 8. API Contract

Full shapes, statuses, and errors are in `api-spec.md`. Added or changed:

- `GET`, `POST /api/tickets/:ticketId/actions` and
  `PATCH /api/tickets/:ticketId/actions/:actionId`
- `GET /api/tickets/:id/history`
- `PATCH /api/tickets/:id/status`, `PATCH /api/tickets/:id/priority`,
  `POST /api/tickets/:id/reassign` (version-aware), `POST /api/tickets/:id/claim`
- `POST /api/tickets/:id/appears-resolved`
- `GET /api/tickets/:id` (adds `version`, `requesterResolvedAt`,
  `actionsSummary`, and for staff `resolution`)
- `GET /api/tickets` (adds `statusGroup` and `requesterReportedResolved`)
- `GET /api/dashboard/requester`, `GET /api/dashboard/staff`
- `GET /api/users/assignable`; `PATCH /api/users/:id` accepts `email`

## 9. Design Patterns

| Pattern | Lives in | Why here |
|---|---|---|
| Facade | `server/src/tickets/ticket-workflow-service.ts` | One entry point does lock, state check, gate, version check, history, and side effects in one transaction, so the route handlers stay thin and none can skip a step. |
| State (reused) | `server/src/tickets/ticket-state/*` | The existing per-status classes keep owning the transition matrix; the gate is a separate policy the facade calls, so the matrix stays pure. |
| Strategy | `server/src/dashboard/metrics/*` | Each dashboard metric is one class with the same `compute(user, now)` shape, so a metric can be added or tested without touching the route or the others. |
| Builder (extended) | `server/src/staff/ticket-query-builder.ts` | `withStatusGroup()` and `reportedResolved()` are two more chained steps; the Requester list moves onto the same Builder so drill-down filters take one allowlisted path. |
| Mediator (extended) | client `staff/ticket-detail-mediator.ts` | An Action or status change refreshes the Actions list, the status control, and the summary through the existing single refresh point. |
| Factory (reused) | client `nav/role-navigation-factory.ts` | Gains the Dashboard item and the Administrator queue item. |

## 10. Security Requirements

| Class | Mitigation |
|---|---|
| IDOR and broken access control | Session, then role, then ownership on every new route. An Action fetched through the wrong Ticket is 404. Dashboards are scoped by the session user id only. |
| Mass assignment | Create and update read an explicit field allowlist; `createdById`, `ticketId`, and `version` in a body are ignored. |
| Injection (SQL) | Prisma only. `statusGroup` and every filter are validated against allowlists. The Lab 3 static guard test keeps running. The `FOR UPDATE` lock uses the tagged-template form with bound parameters. |
| XSS | Action text and follow-up notes render through React text interpolation only. |
| Lost update and race conditions | `expectedVersion` and Action `version` are checked inside the write; the ticket-row lock serializes gate-sensitive writes. |
| Replay and double submit | `requestId` uniqueness on create; buttons disable while a request is pending. |
| Information leakage | Errors use stable codes and never carry stack traces, other users' data, or whether a protected id exists beyond the Lab 3 convention. |
| CSRF | Every new mutating route sits behind `requireSession`, so the Origin check applies. |

## 11. Acceptance Criteria

| AC ID | Criterion |
|---|---|
| AC-L4-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator and the chosen active assignee. |
| AC-L4-02 | Given a request body containing `createdById`, `ticketId`, `version`, or unknown fields, when an Action is created, then those values are ignored. |
| AC-L4-03 | Given an assignee who is inactive, a Requester, or unknown, when an Action is created or its assignee changed, then the API returns 400 and nothing is saved. |
| AC-L4-04 | Given follow-up required with no note, or a note with follow-up not required, when an Action is saved, then the API returns 400. |
| AC-L4-05 | Given a Requester, when they list Actions on their own Ticket, then all are returned; when they try to create or edit one, then the API returns 403; when they list another Requester's Ticket, then the API returns 403. |
| AC-L4-06 | Given an Action id that belongs to a different Ticket, when it is edited through this Ticket, then the API returns 404. |
| AC-L4-07 | Given an Action created by or assigned to an IT Staff member who is not the Ticket Owner, when it is saved, then it is accepted. |
| AC-L4-08 | Given two users edit the same Action or Ticket, when the second submits an outdated version, then the API returns 409 `STALE_UPDATE` and the first change is preserved. |
| AC-L4-09 | Given a Cancelled Action, when any edit is attempted, then the API returns 409; given a Completed Action, when a description edit is attempted, then it is refused while follow-up fields can still change. |
| AC-L4-10 | Given the same `requestId` is sent twice, including at the same moment, when both arrive, then exactly one Action exists. |
| AC-L4-11 | Given a Closed or Cancelled Ticket, when an Action is created or edited, then the API returns 409 `TICKET_LOCKED`. |
| AC-L4-12 | Given a Ticket with no Completed Action, a Planned or In Progress Action, or an open required follow-up, when a transition to Resolved is requested directly through the API, then it returns 409 `RESOLUTION_BLOCKED` listing the blockers; when none remain, then it succeeds. |
| AC-L4-13 | Given an Action is added while another user resolves the same Ticket, when both requests run, then the outcome is one of the two orderings and the Ticket is never Resolved with a Planned or In Progress Action. |
| AC-L4-14 | Given any status pair not in BR-L4-09, when a transition is requested, then the API returns 409 `INVALID_TRANSITION`; given a valid pair, then it succeeds. |
| AC-L4-15 | Given a Requester, when they call the status, priority, reassign, or claim endpoints, then the API returns 403. |
| AC-L4-16 | Given a Requester marks "problem appears resolved" on their own Ticket in an allowed status, when it is saved, then `requesterResolvedAt` is set, `currentStatus` is unchanged, and IT Staff see the indication; on another user's Ticket or in a status where it does not apply, it is refused. |
| AC-L4-17 | Given a Ticket moved to Reopened, when the transition completes, then `requesterResolvedAt` is cleared. |
| AC-L4-18 | Given a Ticket is created and then moves through several statuses, when its history is read, then every change including creation appears once, in stable order, with its actor, and no endpoint can edit or delete a row. |
| AC-L4-19 | Given a Ticket is cancelled, when the transition completes, then every Planned and In Progress Action on it is Cancelled. |
| AC-L4-20 | Given a Ticket change or an Action change, when it succeeds, then `Ticket.updatedAt` is refreshed, and `Ticket.version` changes only for claim, reassign, priority, and status changes. |
| AC-L4-21 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and Tickets owned by that Requester are returned and each count equals a direct database query. |
| AC-L4-22 | Given an IT Staff user, when staff dashboard data is retrieved, then each metric equals its database query; given an Administrator, then the same data plus user counts is returned, and an IT Staff response has none. |
| AC-L4-23 | Given the wrong role or no session, when a dashboard endpoint is called, then the API returns 403 or 401. |
| AC-L4-24 | Given a user with no matching records, when the dashboard is retrieved, then every count is 0, lists are empty, and the UI shows an empty message. |
| AC-L4-25 | Given a dashboard card, when its drill-down is opened, then the list shows exactly as many Tickets as the card's count. |
| AC-L4-26 | Given the Lab 4 migration has run, when pre-existing Users, Tickets, Comments, Notes, and Attachments are read, then all are unchanged, legacy Tickets have zero Actions and one baseline history row, and dashboards include them. |
| AC-L4-27 | Given the carry-overs, when IT Staff reassign a Ticket, an Administrator edits an email, a duplicate email or self-deactivation is attempted, or IT Staff open a Requester's attachments, then each behaves per FR-L4-15 to FR-L4-17 and the attachment edit controls are absent. |
| AC-L4-28 | Given the Actions Taken UI, when a save fails recoverably, then the entered values remain; when Save is clicked repeatedly, then one request is sent. |
| AC-L4-29 | Given any Lab 4 screen at desktop, tablet, and mobile widths, when it renders, then nothing is clipped or overlapping, the page does not scroll horizontally, every control is keyboard reachable with a visible focus ring, and status is never shown by color alone. |
| AC-L4-30 | Given a user logs in, when the app loads, then they land on their Dashboard, with the right navigation for their role and the active item marked. |
| AC-L4-31 | Given the Lab 1 to Lab 3 suites and the Lab 4 suites, when the full server suite runs ten times in a row, then every run passes. |
| AC-L4-32 | Given any screen of the final application, when it is used, then the browser console shows no errors, and there are no broken links or placeholder text. |
| AC-L4-33 | Given a database of about 300 Tickets, when either dashboard is requested, then it responds within one second. |

## 12. Definition of Done

**Product completion**

- Every Functional Requirement, Business Rule, and Security Requirement here
  is implemented.
- Every Acceptance Criterion has at least one passing, traceable automated test
  in `tests.md`; none is skipped, disabled, or commented out.
- The Lab 1 to Lab 3 suites and the Lab 4 suites pass from the documented
  commands on `main`, and the server suite passes ten runs in a row.
- All write operations are enforced by the backend and tested by calling the
  API directly, not only through the UI.
- Dashboard numbers are verified against direct database queries.
- The browser console is clean, and there are no placeholders or unfinished
  controls. README setup, seed, migration, test, and demo steps are current.
- Screens meet the Zen Green, responsive, and accessibility checklist in
  `ui-spec.md` at desktop, tablet, and mobile.

**Course delivery**

- Each Issue is implemented on its own feature branch and merged into
  `lab4-staging` by a peer-reviewed Pull Request.
- This specification and `tests.md` are merged before the main implementation
  Pull Requests.
- One release Pull Request goes from `lab4-staging` to `main`.
- `reviewer.md` and `ai-use.md` are current, and the Kanban shows every Lab 4
  Issue in Done.

## 13. Assumptions and Decisions

- **Assignee and four Action statuses are added.** The handout's field list
  has neither, but the required demonstrations grade assigning, status
  transition, completing, cancelling, and rejecting an inactive assignee. A
  Planned Action can go straight to Completed so recording finished work takes
  one step.
- **Resolution gate meaning.** "Incomplete Actions" is read as: nothing still
  Planned or In Progress, at least one Completed, and no open follow-up. A
  Ticket fixed with no recorded work cannot be resolved, which is the point
  of the rule.
- **Legacy Tickets.** They keep working as before. Only a legacy Ticket that
  is still open needs one Completed Action before it can be resolved.
- **Actions are cancelled, never deleted,** so what was planned survives.
- **Administrator may own Tickets and take actions.** The handout lets an
  Administrator perform IT Staff behavior and says a Ticket Owner is an
  active IT Staff member or Administrator.
- **The Requester cannot reopen or cancel.** The only Requester workflow input
  is the advisory indication.
- **Rolling 7-day window** for "recent", chosen so no time-zone or
  calendar boundary can change a count between users.
- **One migration, not one per issue.** The handout asks for one documented and
  tested migration and rollback, so all the new schema ships together in
  the Actions foundation Issue.
- **Demo data stays opt-in.** Tests create their own users and Tickets and do
  not depend on seed order, because index-based seeded-user lookups broke in
  Lab 4 planning when one account changed.
- **No router.** Navigation stays React state, as in Lab 3, held in one place so
  dashboards can open a filtered list or a Ticket directly.
- **One card has no list drill-down.** "My open actions" links each item to its
  Ticket Detail, since no standalone Actions list screen is in scope.
  BR-L4-20 applies to every other card.
