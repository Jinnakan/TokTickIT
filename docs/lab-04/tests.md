# Lab 4 Test Plan and Results

## 1. Test Strategy

Written and committed before any Lab 4 implementation, from
`specification.md`. Each Issue starts from its failing tests (red, green,
refactor). Every Acceptance Criterion (`specification.md` §11) maps to at least
one row below. The Final column starts at `Planned` and changes to `Pass` or
`Fail` as each file lands, so this stays a living record.

Coverage types: unit, API/integration, UI component, UI style, responsive,
authorization, workflow, migration/regression, performance smoke, security,
and end to end. Server tests run against the real PostgreSQL database with file
parallelism off, as in Lab 3.

Two rules keep the suite trustworthy as it grows:

- **Tests own their data.** They create throwaway users and Tickets through
  helpers and never pick a seeded account by position in the id order. They
  also never change seeded accounts, and the E2E specs follow the same rule.
- **Stability is a requirement,** not a hope. The server suite must pass ten
  consecutive runs (REG-04) before the sprint is done, and any intermittent
  failure is root-caused before more tests are added.

Test files:

- `server/tests/lab-04/`: `actions-taken`, `ticket-workflow`,
  `requester-dashboard`, `staff-dashboard` (handout names, `.api.test.ts`), plus
  `carry-overs.api.test.ts`, `security.api.test.ts`, `migration.test.ts`,
  `action-rules.unit.test.ts`, and `workflow-rules.unit.test.ts`
- `client/tests/lab-04/`: `ActionsTaken`, `TicketWorkflow`, `RequesterDashboard`,
  `StaffDashboard`, `Navigation`, `CarryOvers` (`.test.tsx`)
- `e2e/lab-04/`: `actions-taken-flow`, `ticket-resolution`, `dashboards` (`.spec.ts`)

## 2. Planned Tests

### Unit (shared rules and workflow policy)

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| ACT-U01 | BR-L4-06, BR-L4-07 | Action field validation on create: required text, limits at and over, follow-up note pairing, `actionAt` format and future rule | Exact messages per field; at-limit accepted | `action-rules.unit.test.ts` | Pass |
| ACT-U02 | BR-L4-05 | Action status moves and locks for every from and to pair, Cancelled and Completed edit locks | Matches the BR-L4-05 table exactly | `action-rules.unit.test.ts` | Pass |
| ACT-U03 | BR-L4-04 | Unknown and protected fields in the body | Ignored, never copied into the result | `action-rules.unit.test.ts` | Pass |
| WF-U01 | BR-L4-10 | Resolution gate over every combination of Action statuses and follow-ups, no database | Correct blocker list each time | `workflow-rules.unit.test.ts` | Planned |
| WF-U02 | BR-L4-09 | Ticket transition matrix through the State classes | Matches the table exactly | `workflow-rules.unit.test.ts` | Planned |

### API: Actions Taken

File: `actions-taken.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| ACT-01 | AC-L4-01, BR-L4-01 | IT Staff and Administrator create a valid Action | 201; under the Ticket; creator is the session user; Ticket `updatedAt` refreshed; Ticket `version` unchanged | Pass |
| ACT-02 | AC-L4-02, BR-L4-04 | Body with `createdById`, `ticketId`, `version`, unknown fields | Ignored; session user and URL Ticket used | Pass |
| ACT-03 | AC-L4-03, BR-L4-03 | Assignee inactive, a Requester, unknown id, on create and edit | 400 each; nothing saved | Pass |
| ACT-04 | AC-L4-04, BR-L4-07 | Follow-up required with no note; a note without follow-up | 400 each | Pass |
| ACT-05 | AC-L4-05 | Requester lists own Ticket; creates; edits; lists another Requester's | 200; 403; 403; 403 | Pass |
| ACT-06 | AC-L4-06 | Action id used through another Ticket, and an unknown id | 404 `ACTION_NOT_FOUND` | Pass |
| ACT-07 | AC-L4-07, BR-L4-02 | A staff member who is not the owner creates and edits; assignee is a third person | Accepted | Pass |
| ACT-08 | AC-L4-08, BR-L4-14 | Two edits with the same `version`, in order and at the same moment | One 200, one 409 `STALE_UPDATE`; first change kept | Pass |
| ACT-09 | AC-L4-09, BR-L4-05 | Edit a Cancelled Action; change description of a Completed one; change follow-up on a Completed one | 409 `ACTION_LOCKED` twice; follow-up change 200 | Pass |
| ACT-10 | AC-L4-10, BR-L4-21 | Same `requestId` posted twice, and twice at once; same id on another Ticket; unsafe id | One row; 201 then 200; separate per Ticket; 400 | Pass |
| ACT-11 | AC-L4-11, BR-L4-08 | Create and edit on Closed and Cancelled Tickets; create on Resolved | 409 `TICKET_LOCKED`; Resolved accepted | Pass |
| ACT-12 | BR-L4-06 | Result required on Completed; future Completed time; length limits | 400 with field messages | Pass |
| ACT-13 | BR-L4-08 | `DELETE` on an Action | 404; row remains | Pass |
| ACT-14 | AC-L4-05 | No session; a session that must change its password | 401; 403 `PASSWORD_CHANGE_REQUIRED` | Pass |
| ACT-15 | Security | Description containing `<script>` | Stored and returned verbatim as data | Pass |
| ACT-16 | BR-L4-19 | List order with equal `actionAt` | Stable by `id` | Pass |
| ACT-17 | AC-L4-09, BR-L4-05 | Every Action status move through the API (Start, Complete, Cancel, and refused ones) | Allowed moves 200; others 409 `INVALID_ACTION_TRANSITION` | Pass |
| ACT-18 | FR-L4-04 | Mark a follow-up done, repeat, and reopen it | `followUpDoneAt` set once, kept on repeat, cleared on false | Pass |

### API: Ticket Workflow

File: `ticket-workflow.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| WF-01 | AC-L4-14, BR-L4-09 | Every allowed transition | 200 each | Planned |
| WF-02 | AC-L4-14 | Every disallowed pair, including from Cancelled | 409 `INVALID_TRANSITION` with `allowed` | Planned |
| WF-03 | AC-L4-12, BR-L4-10 | Resolve with no Completed Action; with a Planned and an In Progress Action; with an open follow-up | 409 `RESOLUTION_BLOCKED` listing each blocker | Planned |
| WF-04 | AC-L4-12 | Resolve once the blockers are cleared; a follow-up on a Cancelled Action | 200 | Planned |
| WF-05 | AC-L4-15 | Requester calls status, priority, reassign, claim | 403 each | Planned |
| WF-06 | AC-L4-16, BR-L4-12 | Requester marks appears-resolved in each allowed status | 200; `requesterResolvedAt` set; status and `version` unchanged; repeat keeps the first time | Planned |
| WF-07 | AC-L4-16 | Appears-resolved on another's Ticket, on New, on Closed; by staff; unknown id; no session | 403, 409 `NOT_APPLICABLE`, 409, 403, 404, 401 | Planned |
| WF-08 | AC-L4-17 | Move to Reopened after an indication | `requesterResolvedAt` cleared | Planned |
| WF-09 | AC-L4-18, BR-L4-16 | Create a Ticket and move it through several statuses, then read history | First row is creation; one row per change, in order, with actor | Planned |
| WF-10 | AC-L4-18 | `POST`, `PATCH`, `DELETE` on history | 404 or 405; table unchanged | Planned |
| WF-11 | AC-L4-19, BR-L4-13 | Cancel a Ticket with Planned and In Progress Actions | All become Cancelled in one transaction | Planned |
| WF-12 | AC-L4-08, BR-L4-14 | Status, priority, reassign with an outdated `expectedVersion`; missing version | 409 `STALE_UPDATE`; 400 | Planned |
| WF-13 | AC-L4-08 | Two simultaneous status changes with the same version | Exactly one succeeds | Planned |
| WF-14 | AC-L4-13, BR-L4-11 | Resolve while a Planned Action is added at the same moment, repeated | Never Resolved with an open Action; each run ends in one valid ordering | Planned |
| WF-15 | FR-L4-07 | `GET /api/tickets/:id` for staff and Requester | `version`, `actionsSummary`, and for staff `resolution` correct | Planned |
| WF-16 | AC-L4-25 | `statusGroup` and `requesterReportedResolved` for both roles; unknown value | Correct rows; 400 | Planned |
| WF-17 | AC-L4-20, BR-L4-14, BR-L4-15 | Which operations change `version` and which refresh `updatedAt` (claim, reassign, priority, status, Action, Comment, Note, Attachment) | As the table in BR-L4-14 and BR-L4-15 | Planned |
| WF-18 | FR-L4-11 | Staff list and detail carry the indication; Requester list items do not | Present for staff only | Planned |

### API: Requester Dashboard

File: `requester-dashboard.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| RD-01 | AC-L4-21, BR-L4-17 | Each card count against a direct database query | Equal | Planned |
| RD-02 | AC-L4-21 | Another Requester's Tickets present | Never counted or listed | Planned |
| RD-03 | BR-L4-19 | List sizes and fields | At most 5 items, only the documented fields | Planned |
| RD-04 | BR-L4-17 | Recently resolved around the 7-day edge, including a Closed Ticket and one reopened later | Inside included, outside and reopened excluded; uses history time | Planned |
| RD-05 | AC-L4-24 | A Requester with no Tickets | Counts 0, lists empty | Planned |
| RD-06 | AC-L4-23 | IT Staff, Administrator, no session | 403, 403, 401 | Planned |
| RD-07 | AC-L4-25, BR-L4-20 | Open each card's drill-down on `GET /api/tickets` | `totalItems` equals the count | Planned |
| RD-08 | AC-L4-33 | About 300 Tickets, one request | Under 1 second | Planned |
| RD-09 | AC-L4-26 | Legacy Ticket with only a baseline history row | Counted like any other | Planned |

### API: Staff Dashboard

File: `staff-dashboard.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| SD-01 | AC-L4-22, BR-L4-18 | Every card, `byStatus`, `byItPriority` against database queries | Equal | Planned |
| SD-02 | AC-L4-22 | Administrator and IT Staff responses | `users` only for Administrator, counts correct | Planned |
| SD-03 | AC-L4-23 | Requester, no session | 403, 401 | Planned |
| SD-04 | AC-L4-24 | A clean state | Zeros, 8 status rows at 0, empty lists | Planned |
| SD-05 | AC-L4-25, BR-L4-20 | Each drill-down against the queue | Row count equals the card count | Planned |
| SD-06 | BR-L4-18 | `myActions` | Only the caller's Planned and In Progress Actions, soonest first, at most 5 | Planned |
| SD-07 | BR-L4-18 | Reported-resolved count | Counts only active Tickets with the indication | Planned |
| SD-08 | AC-L4-33 | About 300 Tickets | Under 1 second | Planned |
| SD-09 | BR-L4-18 | Active definition | Resolved, Closed, Cancelled excluded from unassigned and mine | Planned |

### API: Carry-overs and Security

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| CO-01 | AC-L4-27, FR-L4-15 | `GET /api/users/assignable` by role and content | Staff and Administrator 200, active staff and Administrators only, minimal fields; Requester 403 | `carry-overs.api.test.ts` | Pass |
| CO-02 | FR-L4-15 | Reassign to an Administrator; to an inactive user and a Requester | 200; 400 | `carry-overs.api.test.ts` | Pass |
| CO-03 | AC-L4-27, FR-L4-16 | Administrator edits email; duplicate; bad format; own unchanged email | 200; 400 `EMAIL_TAKEN`; 400; 200 | `carry-overs.api.test.ts` | Pass |
| CO-04 | AC-L4-27 | Attachment upload and remove as IT Staff; list and download | 403, 403; 200, 200 | `carry-overs.api.test.ts` | Pass |
| CO-05 | FR-L4-17 | Self-deactivation and last-Administrator codes | 409 `SELF_DEACTIVATION`, 409 `LAST_ADMINISTRATOR` | `carry-overs.api.test.ts` | Pass |
| SEC4-01 | BR-L4-22 | IDOR sweep over Actions, history, appears-resolved, dashboards across roles and owners | Only permitted combinations succeed | `security.api.test.ts` | Planned |
| SEC4-02 | §10 | Mass assignment on Action create and edit and on Ticket mutations | Disallowed fields ignored | `security.api.test.ts` | Planned |
| SEC4-03 | §10 | Every new mutating route with a wrong or missing Origin | 403 `ORIGIN_MISMATCH` | `security.api.test.ts` | Planned |
| SEC4-04 | §10 | Forced server errors and bad input | Stable code, no stack trace | `security.api.test.ts` | Planned |
| SEC4-05 | §10 | Existing static guards over `server/src` | No raw SQL beyond the bound `FOR UPDATE`, no shell execution | `security.api.test.ts` | Planned |

### Migration, Seed, and Regression

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| MIG-01 | AC-L4-26 | Row counts and key fields of Users, Tickets, Comments, Notes, Attachments | Unchanged by the migration | `migration.test.ts` | Pass |
| MIG-02 | AC-L4-26, §7 | Baseline history | One row per existing Ticket with the documented values | `migration.test.ts` | Pass |
| MIG-03 | AC-L4-26 | Legacy defaults | `version` 1, no indication, zero Actions | `migration.test.ts` | Pass |
| MIG-04 | §7 | `rollback.sql` inside a transaction that is then discarded | New objects dropped, earlier data intact | `migration.test.ts` | Pass |
| MIG-05 | §7 | Demo seed run twice | Same row counts; zero, one, and many Actions; a Requester with no Tickets | `migration.test.ts` | Pass |
| MIG-06 | §7 | Re-running the seed after staff edited a seeded Action | The edit is kept | `migration.test.ts` | Pass |
| REG-01 | AC-L4-31 | All Lab 1 to Lab 3 server suites | Pass | whole server suite | Planned |
| REG-02 | AC-L4-31 | All Lab 1 to Lab 3 client suites | Pass | whole client suite | Planned |
| REG-03 | AC-L4-31 | All Lab 2 and Lab 3 E2E specs | Pass | `e2e/` | Planned |
| REG-04 | AC-L4-31 | The full server suite ten times in a row | Ten passes, no flaky failure | script and log in the release Issue | Planned |

### UI Component

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| UI4-01 | AC-L4-21 | Requester dashboard with data | Four cards and two lists render | `RequesterDashboard.test.tsx` | Planned |
| UI4-02 | AC-L4-24 | Zero counts and empty lists | `0` shown; empty messages shown | `RequesterDashboard.test.tsx` | Planned |
| UI4-03 | AC-L4-25 | Click a card and a list row | Opens the right filtered list or Ticket | `RequesterDashboard.test.tsx` | Planned |
| UI4-04 | FR-L4-14 | Loading, and failure with a working Retry | Status text; alert and Retry | `RequesterDashboard.test.tsx` | Planned |
| UI4-05 | AC-L4-22 | Staff dashboard cards, breakdowns, my actions | Render and link correctly | `StaffDashboard.test.tsx` | Planned |
| UI4-06 | AC-L4-22 | Administrator users strip, absent for IT Staff | Shown only for Administrator | `StaffDashboard.test.tsx` | Planned |
| UI4-07 | AC-L4-24 | Staff empty and zero states | Messages shown | `StaffDashboard.test.tsx` | Planned |
| UI4-08 | FR-L4-01 | Actions list with several Actions; empty list | Cards in order; empty message | `ActionsTaken.test.tsx` | Pass |
| UI4-09 | AC-L4-04 | Follow-up checkbox | Note field appears and is required | `ActionsTaken.test.tsx` | Pass |
| UI4-10 | AC-L4-28 | A failed save | Entered values remain; message shown | `ActionsTaken.test.tsx` | Pass |
| UI4-11 | AC-L4-28 | Rapid repeated Save clicks | One request | `ActionsTaken.test.tsx` | Pass |
| UI4-12 | AC-L4-09 | Completed and Cancelled cards | Locked fields read-only; Cancelled has no Edit | `ActionsTaken.test.tsx` | Pass |
| UI4-13 | AC-L4-05 | Requester view | No Add, Edit, buttons, or assignee control | `ActionsTaken.test.tsx` | Pass |
| UI4-14 | AC-L4-08 | A 409 stale response | Conflict message with Reload; text kept | `ActionsTaken.test.tsx` | Pass |
| UI4-15 | AC-L4-03 | Assignee select | Lists only the backend's assignable users | `ActionsTaken.test.tsx` | Pass |
| UI4-16 | FR-L4-04 | Start, Complete, Cancel buttons | Only allowed moves appear and send the right request | `ActionsTaken.test.tsx` | Pass |
| UI4-17 | FR-L4-06 | Ticket status control | Only permitted next statuses offered | `TicketWorkflow.test.tsx` | Planned |
| UI4-18 | AC-L4-12 | Resolve blocked | Blocker lines from `resolution` and from a 409 | `TicketWorkflow.test.tsx` | Planned |
| UI4-19 | AC-L4-19 | Cancel | Confirmation mentions open actions | `TicketWorkflow.test.tsx` | Planned |
| UI4-20 | AC-L4-16 | Requester button and text; staff badge | Button then text; badge for staff only | `TicketWorkflow.test.tsx` | Planned |
| UI4-21 | AC-L4-18 | History list | Ordered rows | `TicketWorkflow.test.tsx` | Planned |
| UI4-22 | AC-L4-08 | A stale ticket update | Message and Reload; nothing overwritten | `TicketWorkflow.test.tsx` | Planned |
| UI4-23 | AC-L4-27 | Reassign control, email field, specific messages, attachment controls | As specified; no Add or Remove for staff | `CarryOvers.test.tsx` | Pass |
| UI4-24 | AC-L4-30, BR-L4-23 | Navigation per role, landing page, active-item marking | Right items, Dashboard first, `aria-current` on the active one | `Navigation.test.tsx` | Planned |

### UI Style, Responsive, and Accessibility

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| ST4-01 | AC-L4-29 | Action status and reported-resolved badges | Text label always present; badge tokens used | `ActionsTaken.test.tsx` | Planned |
| ST4-02 | AC-L4-29 | Read-only versus editable fields | Distinct read-only styling | `ActionsTaken.test.tsx` | Planned |
| RESP4-01 | AC-L4-29 | Dashboards, Ticket Detail, and Actions at 1280, 768, 390px | No horizontal overflow, no clipped text | `dashboards.spec.ts` | Planned |
| A11Y4-01 | AC-L4-29 | Keyboard walk of each new screen | Logical order, visible focus, cards reachable | `dashboards.spec.ts` | Planned |
| A11Y4-02 | AC-L4-29 | Card and badge accessible names | Name includes label and count; state not color only | `StaffDashboard.test.tsx` | Planned |

### End to End

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| E2E4-01 | AC-L4-01, AC-L4-05, AC-L4-07 | Staff adds an Action, another staff completes it with a follow-up, Requester views | Visible to all as specified; Requester has no controls | `actions-taken-flow.spec.ts` | Pass |
| E2E4-02 | AC-L4-12, AC-L4-16, AC-L4-17 | Resolve blocked, clear the blockers, resolve; Requester indication; reopen | Matches the rules; history shows each step | `ticket-resolution.spec.ts` | Planned |
| E2E4-03 | AC-L4-21, AC-L4-22, AC-L4-25, AC-L4-30 | Log in as each role, land on the Dashboard, open a card | The opened list size equals the count; Administrator sees users | `dashboards.spec.ts` | Planned |
| E2E4-04 | AC-L4-32 | Walk every screen of every role, collecting console errors and failed requests | None | `dashboards.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-L4-01 | ACT-01, UI4-08, E2E4-01 |
| AC-L4-02 | ACT-02, ACT-U03, SEC4-02 |
| AC-L4-03 | ACT-03, UI4-15 |
| AC-L4-04 | ACT-04, ACT-U01, UI4-09 |
| AC-L4-05 | ACT-05, ACT-14, UI4-13, E2E4-01 |
| AC-L4-06 | ACT-06, SEC4-01 |
| AC-L4-07 | ACT-07, E2E4-01 |
| AC-L4-08 | ACT-08, WF-12, WF-13, UI4-14, UI4-22 |
| AC-L4-09 | ACT-09, ACT-17, ACT-U02, UI4-12 |
| AC-L4-10 | ACT-10 |
| AC-L4-11 | ACT-11 |
| AC-L4-12 | WF-03, WF-04, WF-U01, UI4-18, E2E4-02 |
| AC-L4-13 | WF-14 |
| AC-L4-14 | WF-01, WF-02, WF-U02 |
| AC-L4-15 | WF-05 |
| AC-L4-16 | WF-06, WF-07, UI4-20, E2E4-02 |
| AC-L4-17 | WF-08, E2E4-02 |
| AC-L4-18 | WF-09, WF-10, UI4-21 |
| AC-L4-19 | WF-11, UI4-19 |
| AC-L4-20 | WF-17 |
| AC-L4-21 | RD-01, RD-02, RD-03, RD-04, UI4-01, E2E4-03 |
| AC-L4-22 | SD-01, SD-02, SD-06, SD-07, SD-09, UI4-05, UI4-06, E2E4-03 |
| AC-L4-23 | RD-06, SD-03, SEC4-01 |
| AC-L4-24 | RD-05, SD-04, UI4-02, UI4-07 |
| AC-L4-25 | WF-16, RD-07, SD-05, UI4-03, E2E4-03 |
| AC-L4-26 | MIG-01, MIG-02, MIG-03, RD-09 |
| AC-L4-27 | CO-01 to CO-05, UI4-23 |
| AC-L4-28 | UI4-10, UI4-11 |
| AC-L4-29 | ST4-01, ST4-02, RESP4-01, A11Y4-01, A11Y4-02 |
| AC-L4-30 | UI4-24, E2E4-03 |
| AC-L4-31 | REG-01, REG-02, REG-03, REG-04 |
| AC-L4-32 | E2E4-04 |
| AC-L4-33 | RD-08, SD-08 |

### Functional requirement coverage

| FR | Criteria that exercise it |
|---|---|
| FR-L4-01 | AC-L4-01, AC-L4-07 |
| FR-L4-02 | AC-L4-01, AC-L4-02 |
| FR-L4-03 | AC-L4-03, AC-L4-07 |
| FR-L4-04 | AC-L4-09, AC-L4-28 |
| FR-L4-05 | AC-L4-05 |
| FR-L4-06 | AC-L4-14, AC-L4-15 |
| FR-L4-07 | AC-L4-12, AC-L4-13 |
| FR-L4-08 | AC-L4-08 |
| FR-L4-09 | AC-L4-18 |
| FR-L4-10 | AC-L4-16, AC-L4-17 |
| FR-L4-11 | AC-L4-16 |
| FR-L4-12 | AC-L4-21 |
| FR-L4-13 | AC-L4-22 |
| FR-L4-14 | AC-L4-24, AC-L4-25 |
| FR-L4-15 | AC-L4-27 |
| FR-L4-16 | AC-L4-27 |
| FR-L4-17 | AC-L4-27, AC-L4-08, AC-L4-12 |
| FR-L4-18 | AC-L4-10, AC-L4-28 |
| FR-L4-19 | AC-L4-30 |
| FR-L4-20 | AC-L4-26, AC-L4-31, AC-L4-32 |

## 4. Responsive and Visual Checklist

Tracks `ui-spec.md` §9. Each box is ticked in the Issue that ships the screen
and rechecked in the hardening Issue, not backfilled at the end.

- [x] Carry-over screens (carry-overs Issue): reassign selector, editable email, specific messages, and attachment controls checked by component tests and the E2E; the three-width visual pass is rechecked in the hardening Issue
- [ ] Actions Taken, all modes (Actions UI Issue)
- [ ] Ticket workflow controls and history (workflow Issue)
- [ ] Requester and Staff dashboards and navigation (dashboards Issue)
- [ ] Full-application pass at three widths (hardening Issue)

## 5. Test Commands

Unchanged from Lab 3: server `npm run typecheck && npm test` from `server/`;
client `npx tsc -b --noEmit && npm test && npm run build` from `client/`;
E2E `npx playwright test` from the repo root. The ten-run stability check is a
loop over the server command, logged in the release Issue.

## 6. Final Results

Not yet run. Filled in during the hardening and release Issues once every file
above exists.

## 7. Known Limitations or Deferred Tests (anticipated)

- Performance smoke tests use a fixed one-second bound on about 300 Tickets.
  They show the dashboards are not pathological, not a load test.
- Concurrency tests run two requests in one process; they prove the row lock and
  version checks work in the database, not behavior across several servers.
- Accessibility is checked with keyboard walk-throughs and accessible-name
  assertions; no screen-reader testing is done.
- The demo seed is exercised by the MIG rows; every other test builds its own data.
- **Server suite stability (REG-04).** The Lab 3 suite failed about 1 run in 8
  (`socket hang up`, `Parse Error: Expected HTTP/`, 20 s timeouts). Cause:
  supertest listened on a random port on all interfaces, and other programs
  on the machine hold 127.0.0.1 ports in the same range, so a request could
  reach the wrong process. `server/tests/helpers/app.ts` now binds the test
  server to 127.0.0.1, and every test imports `app` from it. After the fix the
  full suite passed 40 of 40 consecutive runs.
- Feature 25 also adds `ticket-history.api.test.ts` (first history row on create) and `touch-ticket.api.test.ts` (BR-L4-15 for Comments, Notes, Attachments), covered by AC-L4-18 and AC-L4-20.
- Status-change history rows are written by the workflow Issue (the Lab 3 `PATCH /status` route is rewritten there), so until then only the baseline and creation rows exist.
- Feature 26 checked in a real browser at 1280, 768 and 390 px on a Ticket with an Action: no horizontal scroll or clipped text, focus moves to the first invalid field, Save errors appear under the field with `aria-invalid` and `aria-describedby`. Editable inputs use the page background (`#f5f7f6`) and read-only fields `#eef2f0`, a faint difference that the hardening Issue should review.
