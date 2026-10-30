# Lab 4 Test Plan and Results

## 1. Test Strategy

Written and committed before any Lab 4 implementation, from
`specification.md`. Work follows red, green, refactor: each Issue starts from
its failing tests. Every Acceptance Criterion (`specification.md` §11) maps to
at least one row below. The Final column starts at `Planned` and moves to
`Pass` or `Fail` as each file lands, so this stays a living record and is not
rebuilt at the end.

Coverage types: unit, API/integration, UI component, UI style, responsive,
authorization, workflow, migration/regression, performance smoke, security,
and end to end. Server tests run against the real PostgreSQL database with
file parallelism off, as in Lab 3. Tests create their own data and never
depend on the demo seed. All paths are repo relative.

Test files:

- `server/tests/lab-04/`: `actions-taken`, `ticket-workflow`,
  `requester-dashboard`, `staff-dashboard` (names per the handout), plus
  `carry-overs`, `migration`, `security` (all `.api.test.ts` except migration)
- `client/tests/lab-04/`: `ActionsTaken`, `TicketWorkflow`, `RequesterDashboard`,
  `StaffDashboard` (`.test.tsx`), plus `CarryOvers.test.tsx`
- `e2e/lab-04/`: `actions-taken-flow`, `ticket-resolution`, `dashboards` (`.spec.ts`)

## 2. Planned Tests

### API: Actions Taken (Issue 25)

File: `server/tests/lab-04/actions-taken.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| ACT-01 | AC-L4-01, FR-L4-01, BR-L4-01 | IT Staff creates a valid Action | 201; stored under the Ticket; creator is the session user | Planned |
| ACT-02 | AC-L4-02, BR-L4-04 | Body contains `performedBy`, `createdById`, `ticketId` | Values ignored; stored with session user and URL ticket | Planned |
| ACT-03 | AC-L4-03, BR-L4-03 | Assignee inactive, Requester, unknown id (create and edit) | 400 each; nothing saved | Planned |
| ACT-04 | AC-L4-04, BR-L4-07 | Follow-up true with no note; false with a note | 400 each | Planned |
| ACT-05 | AC-L4-05, FR-L4-05 | Requester lists own Ticket's Actions; creates; edits; lists another's | 200 list; 403; 403; 403 | Planned |
| ACT-06 | AC-L4-06, BR-L4-20 | Action id from Ticket A requested through Ticket B | 404 `ACTION_NOT_FOUND` for read and edit | Planned |
| ACT-07 | AC-L4-07, BR-L4-02 | Staff B creates and edits an Action on Staff A's Ticket | Accepted | Planned |
| ACT-08 | AC-L4-08, BR-L4-13 | Two edits with the same `version` | Second is 409 `STALE_UPDATE`; first change kept | Planned |
| ACT-09 | AC-L4-09, BR-L4-05 | Edit a Cancelled Action; edit description of a Completed one; Completed to Planned | 409 `ACTION_LOCKED` / `INVALID_ACTION_TRANSITION`; follow-up fields still editable on Completed | Planned |
| ACT-10 | AC-L4-10, BR-L4-19 | Same `requestId` posted twice | Second 200 with original; one row | Planned |
| ACT-11 | AC-L4-11, BR-L4-08 | Create and edit on Closed and Cancelled Tickets | 409 `TICKET_LOCKED` | Planned |
| ACT-12 | BR-L4-06 | Result required when Completed; future time rejected for Completed; length limits | 400 with field messages | Planned |
| ACT-13 | BR-L4-08 | `DELETE` on an Action | 404; row still exists | Planned |
| ACT-14 | AC-L4-05 | No session; password-change-required session | 401; 403 | Planned |
| ACT-15 | Security, BR-L3-12 | Description containing `<script>` | Stored and returned verbatim as data | Planned |
| ACT-16 | BR-L4-16 | List order with equal `actionAt` | Stable by `id` | Planned |

### API: Ticket Workflow (Issues 24 and 27)

File: `server/tests/lab-04/ticket-workflow.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| WF-01 | AC-L4-13, BR-L4-09 | Every allowed transition in the matrix | 200 each; status updates | Planned |
| WF-02 | AC-L4-13 | Every disallowed pair, including from Cancelled | 409 `INVALID_TRANSITION` with `allowed` | Planned |
| WF-03 | AC-L4-12, BR-L4-10 | Resolve with no completed Action; with a Planned Action; with an open follow-up | 409 `RESOLUTION_BLOCKED` listing each blocker | Planned |
| WF-04 | AC-L4-12 | Resolve after a completed Action, none planned, follow-up done | 200 | Planned |
| WF-05 | AC-L4-14 | Requester calls status, priority, reassign, claim | 403 each | Planned |
| WF-06 | AC-L4-15, BR-L4-11 | Requester marks appears-resolved on own active Ticket | 200; `requesterResolvedAt` set; `currentStatus` unchanged | Planned |
| WF-07 | AC-L4-15 | Appears-resolved on another's Ticket, on New, on Closed, by staff | 403, 409 `NOT_APPLICABLE`, 409, 403 | Planned |
| WF-08 | AC-L4-16 | Move to Reopened after an indication | `requesterResolvedAt` cleared | Planned |
| WF-09 | AC-L4-17, BR-L4-18 | Several transitions then read history | One row each, ordered, with actor | Planned |
| WF-10 | AC-L4-17 | `POST`, `PATCH`, `DELETE` on history | 404 or 405; table unchanged | Planned |
| WF-11 | AC-L4-18, BR-L4-12 | Cancel a Ticket with Planned Actions | All Planned become Cancelled in one transaction | Planned |
| WF-12 | AC-L4-08, BR-L4-13 | Status, priority, reassign with outdated `expectedVersion` | 409 `STALE_UPDATE`; no change | Planned |
| WF-13 | AC-L4-08 | Two simultaneous status updates, same version | Exactly one succeeds | Planned |
| WF-14 | FR-L4-07 | `GET /api/tickets/:id` for staff | `version`, `actionsSummary`, `resolution.canResolve` and blockers correct | Planned |
| WF-15 | AC-L4-23 | `statusGroup` and `requesterReportedResolved` on `GET /api/tickets`; unknown value | Correct filtering for both roles; 400 | Planned |
| WF-16 | BR-L4-10 | `ResolutionGate` unit, no database | Blocker list correct for each combination | Planned |
| WF-17 | BR-L4-09 | Transition matrix unit over the State classes | Matches the table exactly | Planned |
| WF-18 | AC-L4-15, AC-L4-25 | Staff queue and detail data expose the reported-resolved flag | Flag present for staff, absent for other Requesters | Planned |

### API: Requester Dashboard (Issue 28)

File: `server/tests/lab-04/requester-dashboard.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| RD-01 | AC-L4-19, BR-L4-14 | Each card count vs a direct database query | Equal | Planned |
| RD-02 | AC-L4-19 | Another Requester's Tickets present | Never counted or listed | Planned |
| RD-03 | BR-L4-16 | List sizes and fields | At most 5 items, only the documented fields | Planned |
| RD-04 | BR-L4-14 | Recently resolved around the 7-day boundary | Inside included, outside excluded, uses history time | Planned |
| RD-05 | AC-L4-22 | User with no Tickets | All counts 0, lists empty | Planned |
| RD-06 | AC-L4-21 | IT Staff, Administrator, no session | 403, 403, 401 | Planned |
| RD-07 | AC-L4-23, BR-L4-17 | Open each card's drill-down against `GET /api/tickets` | `totalItems` equals the card count | Planned |
| RD-08 | AC-L4-29 | About 300 Tickets, one request | Responds in under 1 second | Planned |
| RD-09 | AC-L4-24 | Legacy Ticket with baseline history | Counted like any other | Planned |

### API: Staff Dashboard (Issue 28)

File: `server/tests/lab-04/staff-dashboard.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| SD-01 | AC-L4-20, BR-L4-15 | Every card, `byStatus`, `byItPriority` vs database queries | Equal | Planned |
| SD-02 | AC-L4-20 | Administrator vs IT Staff response | `users` present only for Administrator, counts correct | Planned |
| SD-03 | AC-L4-21 | Requester, no session | 403, 401 | Planned |
| SD-04 | AC-L4-22 | Empty database state | Zeros, 8 status rows at 0, empty lists | Planned |
| SD-05 | AC-L4-23, BR-L4-17 | Each drill-down against the queue | Row count equals card count | Planned |
| SD-06 | BR-L4-15 | `myActions` | Only the caller's Planned Actions, soonest first, at most 5 | Planned |
| SD-07 | BR-L4-15 | Reported-resolved count | Counts only active Tickets with the indication | Planned |
| SD-08 | AC-L4-29 | About 300 Tickets | Under 1 second | Planned |
| SD-09 | BR-L4-15 | Active definition | Resolved, Closed, Cancelled excluded from unassigned and mine | Planned |

### API: Carry-overs (Issue 24)

File: `server/tests/lab-04/carry-overs.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| CO-01 | AC-L4-25, FR-L4-15 | `GET /api/users/assignable` by role | IT and Administrator 200 (active IT Staff and Administrators, minimal fields); Requester 403 | Planned |
| CO-02 | FR-L4-15 | Reassign to an Administrator; to an inactive user | 200; 400 | Planned |
| CO-03 | AC-L4-25, FR-L4-16 | Administrator edits email; duplicate; bad format | 200; 400 `EMAIL_TAKEN`; 400 | Planned |
| CO-04 | AC-L4-25 | Attachment upload and remove as IT Staff; list and download | 403, 403; 200, 200 | Planned |
| CO-05 | FR-L4-17 | Self-deactivation and last-Administrator codes | 409 `SELF_DEACTIVATION`, 409 `LAST_ADMINISTRATOR` | Planned |

### Migration, Seed, and Regression

File: `server/tests/lab-04/migration.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| MIG-01 | AC-L4-24 | Row counts and key fields of Users, Tickets, Comments, Notes, Attachments | Unchanged after migration | Planned |
| MIG-02 | AC-L4-24, §7 | Baseline history | Exactly one row per legacy Ticket with the documented values | Planned |
| MIG-03 | AC-L4-24 | Legacy defaults | `version` 1, no indication, zero Actions | Planned |
| MIG-04 | §7 | `rollback.sql` on a copy | New objects dropped, Lab 3 data intact | Planned |
| MIG-05 | §7 | Demo seed run twice | Same row counts; zero, one, and many Actions present | Planned |
| REG-01 | AC-L4-28 | All Lab 1 to Lab 3 server suites | Pass | Planned |
| REG-02 | AC-L4-28 | All Lab 1 to Lab 3 client suites | Pass | Planned |
| REG-03 | AC-L4-28 | All Lab 2 and Lab 3 E2E specs | Pass | Planned |

### Security and Authorization (Issue 29)

File: `server/tests/lab-04/security.api.test.ts`

| Test ID | Requirement/AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|
| SEC4-01 | BR-L4-20 | IDOR sweep over actions, history, appears-resolved, dashboards across roles and owners | Only permitted combinations succeed; 403 or 404 otherwise | Planned |
| SEC4-02 | §10 | Mass assignment on Action create and edit, ticket mutations | Disallowed fields ignored | Planned |
| SEC4-03 | §10 | Mutating Lab 4 routes with a wrong or missing Origin | 403 `ORIGIN_MISMATCH` | Planned |
| SEC4-04 | §10 | Forced server errors and bad input | Body is `INTERNAL_ERROR` or a stable code; no stack trace | Planned |
| SEC4-05 | §10 | Existing static guards over `server/src` | No raw SQL, no shell execution | Planned |

### UI Component

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| UI4-01 | AC-L4-22 | Requester dashboard with data | Four cards and two lists render | `RequesterDashboard.test.tsx` | Planned |
| UI4-02 | AC-L4-22 | Zero counts and empty lists | `0` shown; empty messages shown | `RequesterDashboard.test.tsx` | Planned |
| UI4-03 | AC-L4-23 | Click a card and a list row | Navigates with the right filter or Ticket | `RequesterDashboard.test.tsx` | Planned |
| UI4-04 | FR-L4-14 | Loading, failure with Retry | Status text; alert and working Retry | `RequesterDashboard.test.tsx` | Planned |
| UI4-05 | AC-L4-20 | Staff dashboard cards, breakdowns, my actions | Render and link correctly | `StaffDashboard.test.tsx` | Planned |
| UI4-06 | AC-L4-20 | Administrator users strip; absent for IT Staff | Shown only for Administrator | `StaffDashboard.test.tsx` | Planned |
| UI4-07 | AC-L4-22 | Staff empty and zero states | Messages shown | `StaffDashboard.test.tsx` | Planned |
| UI4-08 | FR-L4-01 | Actions list with several Actions; empty list | Cards in order; empty message | `ActionsTaken.test.tsx` | Planned |
| UI4-09 | AC-L4-04 | Follow-up checkbox | Note field appears and is required | `ActionsTaken.test.tsx` | Planned |
| UI4-10 | AC-L4-26 | Failed save | Entered values remain; message shown | `ActionsTaken.test.tsx` | Planned |
| UI4-11 | AC-L4-26 | Rapid repeated Save clicks | One request | `ActionsTaken.test.tsx` | Planned |
| UI4-12 | AC-L4-09 | Completed and Cancelled cards | Locked fields read-only; Cancelled has no Edit | `ActionsTaken.test.tsx` | Planned |
| UI4-13 | AC-L4-05 | Requester view | No Add, Edit, or assignee controls | `ActionsTaken.test.tsx` | Planned |
| UI4-14 | AC-L4-08 | 409 stale response | Conflict message with Reload; text kept | `ActionsTaken.test.tsx` | Planned |
| UI4-15 | AC-L4-03 | Assignee select | Lists only assignable users | `ActionsTaken.test.tsx` | Planned |
| UI4-16 | FR-L4-06 | Status control | Only permitted next statuses offered | `TicketWorkflow.test.tsx` | Planned |
| UI4-17 | AC-L4-12 | Resolve blocked | Blocker lines shown from `resolution` and from a 409 | `TicketWorkflow.test.tsx` | Planned |
| UI4-18 | AC-L4-18 | Cancel | Confirmation mentions planned actions | `TicketWorkflow.test.tsx` | Planned |
| UI4-19 | AC-L4-15 | Requester button and text; staff badge | Button then text; badge for staff only | `TicketWorkflow.test.tsx` | Planned |
| UI4-20 | AC-L4-17 | History list | Ordered rows; legacy row text | `TicketWorkflow.test.tsx` | Planned |
| UI4-21 | AC-L4-25 | Reassign control, email field, specific messages, attachment controls | Present for staff and admin as specified; Add and Remove absent for staff | `CarryOvers.test.tsx` | Planned |

### UI Style, Responsive, and Accessibility

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| ST4-01 | AC-L4-27 | Action status and reported-resolved badges | Text label always present; classes from the badge tokens | `ActionsTaken.test.tsx` | Planned |
| ST4-02 | AC-L4-27 | Read-only versus editable fields | Distinct read-only styling | `ActionsTaken.test.tsx` | Planned |
| RESP4-01 | AC-L4-27 | Dashboards and Ticket Detail at 1280, 768, 390px | No horizontal overflow, no clipped text | `e2e/lab-04/dashboards.spec.ts` | Planned |
| A11Y4-01 | AC-L4-27 | Keyboard walk of each new screen | Logical order, focus ring visible, cards reachable | `e2e/lab-04/dashboards.spec.ts` | Planned |
| A11Y4-02 | AC-L4-27 | Card and badge accessible names | Name includes label and count; state not color only | `StaffDashboard.test.tsx` | Planned |

### End to End

| Test ID | Requirement/AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| E2E4-01 | AC-L4-01, AC-L4-07, AC-L4-05 | Staff adds Planned Action, another staff completes it with a follow-up, Requester views | Visible to all as specified; Requester has no controls | `actions-taken-flow.spec.ts` | Planned |
| E2E4-02 | AC-L4-12, AC-L4-15, AC-L4-16 | Resolve blocked, fix blockers, resolve; Requester indication; reopen | Matches the rules; history shows each step | `ticket-resolution.spec.ts` | Planned |
| E2E4-03 | AC-L4-19, AC-L4-20, AC-L4-23 | Requester and staff dashboards, click a card | Opened list size equals the count; Administrator sees users | `dashboards.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-L4-01 | ACT-01, UI4-08, E2E4-01 |
| AC-L4-02 | ACT-02, SEC4-02 |
| AC-L4-03 | ACT-03, UI4-15 |
| AC-L4-04 | ACT-04, UI4-09 |
| AC-L4-05 | ACT-05, ACT-14, UI4-13, E2E4-01 |
| AC-L4-06 | ACT-06, SEC4-01 |
| AC-L4-07 | ACT-07, E2E4-01 |
| AC-L4-08 | ACT-08, WF-12, WF-13, UI4-14 |
| AC-L4-09 | ACT-09, UI4-12 |
| AC-L4-10 | ACT-10 |
| AC-L4-11 | ACT-11 |
| AC-L4-12 | WF-03, WF-04, WF-14, WF-16, UI4-17, E2E4-02 |
| AC-L4-13 | WF-01, WF-02, WF-17 |
| AC-L4-14 | WF-05 |
| AC-L4-15 | WF-06, WF-07, WF-18, UI4-19, E2E4-02 |
| AC-L4-16 | WF-08, E2E4-02 |
| AC-L4-17 | WF-09, WF-10, UI4-20 |
| AC-L4-18 | WF-11, UI4-18 |
| AC-L4-19 | RD-01, RD-02, RD-03, RD-04, E2E4-03 |
| AC-L4-20 | SD-01, SD-02, SD-06, SD-07, SD-09, UI4-05, UI4-06 |
| AC-L4-21 | RD-06, SD-03, SEC4-01 |
| AC-L4-22 | RD-05, SD-04, UI4-01, UI4-02, UI4-07 |
| AC-L4-23 | WF-15, RD-07, SD-05, UI4-03, E2E4-03 |
| AC-L4-24 | MIG-01, MIG-02, MIG-03, RD-09 |
| AC-L4-25 | CO-01 to CO-05, UI4-21 |
| AC-L4-26 | UI4-10, UI4-11 |
| AC-L4-27 | ST4-01, ST4-02, RESP4-01, A11Y4-01, A11Y4-02 |
| AC-L4-28 | REG-01, REG-02, REG-03 |
| AC-L4-29 | RD-08, SD-08 |

## 4. Responsive and Visual Checklist

Tracks `ui-spec.md` §9. Each box is ticked in the Issue that ships the screen
and rechecked in Issue 29, not backfilled at the end.

- [ ] Requester Dashboard (Issue 28)
- [ ] Staff Dashboard (Issue 28)
- [ ] Actions Taken, all modes (Issue 26)
- [ ] Ticket workflow controls and history (Issue 27)
- [ ] Lab 3 carry-over screens (Issue 24)
- [ ] Full-application pass at three widths (Issue 29)

## 5. Test Commands

Unchanged from Lab 3: server `npm run typecheck && npm test` from `server/`;
client `npx tsc -b --noEmit && npm test && npm run build` from `client/`;
E2E `npx playwright test` from the repo root. No new tooling.

## 6. Final Results

Not yet run. Filled in during Issues 29 and 30 once every file above exists,
in the same way as Lab 3.

## 7. Known Limitations or Deferred Tests (anticipated)

- Performance smoke tests use a fixed bound of one second on about 300
  Tickets. They show the dashboards are not pathological, not a load test.
- Concurrency tests simulate two requests in one process; they prove the
  version check is atomic in the database, not behavior across servers.
- Accessibility is checked with keyboard walk-throughs and accessible-name
  assertions; no screen-reader testing is done.
- The demo seed is exercised by MIG-05 only; other tests build their own data.
