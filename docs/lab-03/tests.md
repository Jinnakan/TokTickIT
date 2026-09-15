# Lab 3 Test Plan and Results

## 1. Test Strategy

Planned from `specification.md` before implementation begins (Issue 13),
following the same red → green → refactor discipline as Lab 2. Every
Acceptance Criterion in `specification.md` §11 maps to at least one row
below. Unlike Lab 2, this table is written and committed *before* any
Lab 3 test file exists — the "Final" column starts at `Planned` and is
updated to `Pass`/`Fail` issue by issue as each test file lands, so this
document stays a living traceability record instead of being reconstructed
at the end (temp.md gotcha #4/#5: Lab 2's E2E and screenshots were both
backfilled after the fact; Lab 3 does not repeat that).

## 2. Planned Tests

### API — Authentication (Issue 15)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| AUTH-01 | AC-L3-01 | `POST /api/auth/login` valid credentials | 200; session cookie set; correct user shape returned | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-02 | AC-L3-02 | `POST /api/auth/login` wrong password / unknown email / inactive account | 401, identical `INVALID_CREDENTIALS` message in all three cases | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-03 | BR-L3-06 | Session id before vs. after a successful login | Session id changes (regenerated, not reused) | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-04 | AC-L3-06, BR-L3-08 | Repeated failed logins for one email+IP exceeding the threshold | 429 `TOO_MANY_ATTEMPTS`, even with the correct password, until the window clears | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-05 | FR-L3-03 | `POST /api/auth/logout` | 200; the session row no longer exists in the DB; a subsequent authenticated call with the old cookie returns 401 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-06 | AC-L3-03, BR-L3-07 | Any protected endpoint called while `mustChangePassword` is true, other than change-password/logout | 403 `PASSWORD_CHANGE_REQUIRED` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-07 | — | `POST /api/auth/change-password` with a wrong `currentPassword` | 400 `CURRENT_PASSWORD_INVALID`; password unchanged | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-08 | — | `POST /api/auth/change-password` success | 200; `mustChangePassword` becomes false; new password authenticates on next login | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-09 | AC-L3-04 | Any protected endpoint with no session cookie | 401 `UNAUTHENTICATED` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| AUTH-10 | AC-L3-16, BR-L3-09 | Mutating request with mismatched/missing `Origin` and `Referer` | 403 `ORIGIN_MISMATCH`; no state change occurs | `server/tests/lab-03/auth.api.test.ts` | Pass |

### API — Authorization (Issue 16)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| AUTHZ-01 | AC-L3-05 | Requester calling an IT-Staff-only endpoint (e.g. `GET /api/tickets` staff variant) | 403 `FORBIDDEN` | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| AUTHZ-02 | AC-L3-05 | IT Staff calling an Administrator-only endpoint (e.g. `POST /api/users`) | 403 `FORBIDDEN` | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| AUTHZ-03 | AC-L3-07 | Requester requesting `GET /api/tickets/:id` for a ticket they don't own | 403 `TICKET_FORBIDDEN` | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| AUTHZ-04 | BR-L3-10 | Every new resource type (User, Session, Comment, Note) exercised through the extended `OwnershipResult<T>` resolver | Resolver returns the correct discriminant (`ok`/`not-found`/`forbidden`) for owned/unowned/unknown ids | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| AUTHZ-05 | — | IT Staff and Administrator both calling a Requester-scoped-in-Lab-2 endpoint they should still be blocked from acting as (e.g. creating a ticket as a Requester alias) | 403 where role doesn't include Requester actions | `server/tests/lab-03/authorization.api.test.ts` | Pass |

### API — Staff Queue (Issue 18)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| QUEUE-01 | AC-L3-09 | `GET /api/tickets` as IT Staff, tickets from multiple requesters seeded | All requesters' tickets appear (not scoped to one) | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-02 | — | `?unassignedOnly=true` | Only tickets with `ticketOwnerId: null` returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-03 | — | `?ticketOwnerId=<id>` | Only tickets claimed by that IT Staff member returned | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-04 | BR-L3-11 | `?sortBy=` a field outside the Builder's allowlist | 400 `VALIDATION_FAILED`, no raw fragment reaches Prisma | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| QUEUE-05 | — | `TicketQueryBuilder` unit-level: chained `.withSearch().withStatus().sortBy().paginate().build()` | Produces the expected Prisma `where`/`orderBy`/`skip`/`take` shape | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |

### API — Staff Ticket Detail and Status Workflow (Issue 19)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| STAFF-01 | AC-L3-10 | `POST /api/tickets/:id/claim` on an unassigned ticket | 200; `ticketOwnerId` set to caller | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| STAFF-02 | — | `POST /api/tickets/:id/claim` on a ticket already claimed by someone else | 409 `ALREADY_CLAIMED` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| STAFF-03 | — | `POST /api/tickets/:id/reassign` to an inactive or non-IT-Staff user id | 400 `VALIDATION_FAILED` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| STAFF-04 | — | `PATCH /api/tickets/:id/priority` valid enum value | 200; `itPriority` updated, `requestedPriority` unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| STAFF-05 | AC-L3-11 | `PATCH /api/tickets/:id/status` `NEW` → `CLOSED` directly | 409 `INVALID_TRANSITION`; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| STAFF-06 | AC-L3-12 | `PATCH /api/tickets/:id/status` each allowed transition in the BR-L3-13 table | 200 for every listed pair; `currentStatus` updates | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| STAFF-07 | — | `PATCH /api/tickets/:id/status` from `CANCELLED` (terminal) to anything | 409 `INVALID_TRANSITION` for every target | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| STAFF-08 | — | Each `TicketState` subclass in isolation: `canTransitionTo()`/`allowedActions()` | Matches the BR-L3-13 table exactly, no database | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |

### API — Comments and Notes (Issues 17 and 19, shared file)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| CN-01 | FR-L3-07 | Requester posts a comment on their own ticket | 201; comment persisted, author correct | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| CN-02 | AC-L3-07 | Requester posts a comment on a ticket they don't own | 403 `TICKET_FORBIDDEN`; no row created | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| CN-03 | AC-L3-13, BR-L3-12 | Comment body containing `<script>`-like text | Stored verbatim; retrieval returns it as plain text data (no server-side transformation that would imply unsafe client rendering) | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| CN-04 | FR-L3-08 | IT Staff posts an internal note | 201; note persisted in `InternalNote`, not `PublicComment` | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| CN-05 | AC-L3-08, BR-L3-17 | Requester requests `GET /api/tickets/:id/notes` on their own ticket | 403 `FORBIDDEN`, not 404, not note content | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| CN-06 | BR-L3-16 | No edit/delete endpoint exists for either Comments or Notes | Requests to nonexistent edit/delete routes return 404 (route absent, confirming append-only by construction) | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| CN-07 | — | Comments list ordering | Returned oldest-first (`createdAt` asc) | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |

### API — Users/Administration (Issue 20)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| USER-01 | FR-L3-13 | `GET /api/users` with `search`/`role`/`isActive` filters | Correct subset returned, paginated | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| USER-02 | AC-L3-14, BR-L3-19 | `POST /api/users` success | 201; `initialPassword` present in this response; a second `GET` for the same user never includes a password field | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| USER-03 | — | `POST /api/users` with a duplicate email | 400 `EMAIL_TAKEN`; no row created | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| USER-04 | FR-L3-16, BR-L3-19 | `POST /api/users/:id/reset-password` | 200; new `initialPassword` returned once; old password no longer authenticates; `mustChangePassword` set true | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| USER-05 | AC-L3-15, BR-L3-18, FR-L3-17 | `POST /api/users/:id/deactivate` for a user with an active session | 200; `isActive: false`; that user's session row(s) deleted in the same transaction; a subsequent authenticated request with their old cookie returns 401 | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| USER-06 | — | `POST /api/users/:id/deactivate` called twice | Idempotent; second call still 200, no error | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| USER-07 | BR-L3-01 | `PATCH /api/users/:id` attempting to set a role to something other than the three valid enum values | 400; role remains a single value, never an array or multi-value field | `server/tests/lab-03/users-admin.api.test.ts` | Planned |

### Migration (Issue 14)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| MIG-01 | AC-L3-17 | DevRequester → User migration run against seeded Lab 2 data | Every pre-existing Ticket's requester resolves correctly to the migrated User row | `server/tests/lab-03/data-model.migration.test.ts` | Pass |
| MIG-02 | — | Seed script run twice | Idempotent; seed minimums (≥4 active+1 inactive Requester, ≥3 active+1 inactive IT Staff, ≥1 Administrator) hold after either run, no duplicate rows | `server/tests/lab-03/data-model.migration.test.ts` | Pass |

### Security Sweep (Issue 21)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| SEC-01 | BR-L3-20 | Attachment path-containment guard re-run post-migration | Behaves identically to Lab 2's `API-*` attachment tests; no regression from the auth migration | `server/tests/lab-03/security-audit.api.test.ts` | Planned |
| SEC-02 | BR-L3-21 | Static/guard check: no `child_process`/`exec`/`spawn` import anywhere in `server/src` | Assertion fails loudly if one is ever added, keeping command injection surface at zero | `server/tests/lab-03/security-audit.api.test.ts` | Planned |
| SEC-03 | — | Consolidated IDOR sweep: every Lab 3 resource type (Ticket, Comment, Note, User, Session) probed cross-role/cross-owner in one file | Every probe returns 403/401 as specified, none leaks data | `server/tests/lab-03/security-audit.api.test.ts` | Planned |
| SEC-04 | BR-L3-12 | CSP header present on API responses | `Content-Security-Policy` header set via `helmet` | `server/tests/lab-03/security-audit.api.test.ts` | Planned |

### UI Component

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| UI-L3-01 | AC-L3-02 | Login with invalid credentials | Generic inline error shown; password field cleared, email retained | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-L3-02 | — | Login success | Redirects to the role-appropriate screen | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-L3-03 | AC-L3-03 | `mustChangePassword` true | App redirects to Change Password from any route attempt | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-L3-04 | — | Change Password field mismatch | Field-level validation blocks submit | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-L3-05 | AC-L3-09 | Ticket Queue renders tickets from multiple requesters | Requester column shows varying names, not scoped to one | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-L3-06 | — | Ticket Queue filter controls | Changing a filter re-requests with the correct query params | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-L3-07 | AC-L3-12 | Staff Ticket Detail status control | Only shows transitions valid from the current state (matches `api-spec.md` §4 table) | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-L3-08 | — | Staff Ticket Detail Internal Notes panel vs. Public Comments panel | Distinct visual treatment (different container class/background), both render independently | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-L3-09 | AC-L3-13 | Comment containing HTML-like text rendered in the panel | Displayed as literal text, not executed/injected as markup | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-L3-10 | AC-L3-14 | User Management Create User success | Initial password shown once in the confirmation panel | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-L3-11 | — | User Management Deactivate action | Requires confirmation before firing; confirmation text mentions ending active sessions | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-L3-12 | — | User Management filters | Search/Role/Active filters re-request the list with correct params | `client/tests/lab-03/UserManagement.test.tsx` | Planned |

### Responsive / Visual

| Test ID | Requirement/AC | What It Tests | Expected Result | Method | Final |
|---|---|---|---|---|---|
| VIS-L3-01 | AC-L3-18 | Login/Change Password at 375/768/1280px | No clipping/overlap/horizontal scroll | Manual browser verification | Pass |
| VIS-L3-02 | AC-L3-18 | Ticket Queue at 375/768/1280px | Table→card transition, filters remain usable | Manual browser verification | Planned |
| VIS-L3-03 | AC-L3-18 | Staff Ticket Detail at 375/768/1280px | Internal Notes panel stays visually distinct at every width, Comments/Notes remain usable | Manual browser verification | Planned |
| VIS-L3-04 | AC-L3-18 | User Management at 375/768/1280px | List/card transition, Create/Edit forms usable at all widths | Manual browser verification | Planned |

### E2E (built incrementally, per temp.md gotcha #4)

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| E2E-L3-01 | AC-L3-01, AC-L3-03 | Login → forced Change Password → land on role home screen | Mandatory password change is enforced end to end before any other action succeeds | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-L3-02 | AC-L3-09, AC-L3-10, AC-L3-12 | Login as IT Staff → open Queue → claim a ticket → change its status → post a comment and an internal note | Full staff workflow completes and each change is reflected back in the Queue | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-L3-03 | AC-L3-14, AC-L3-15 | Login as Administrator → create a user → deactivate a user with an active session in another browser context | Created user's password shown once; deactivated user's session immediately rejected | `e2e/lab-03/user-administration.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-L3-01 | AUTH-01, UI-L3-02, E2E-L3-01 |
| AC-L3-02 | AUTH-02, UI-L3-01 |
| AC-L3-03 | AUTH-06, UI-L3-03, E2E-L3-01 |
| AC-L3-04 | AUTH-09 |
| AC-L3-05 | AUTHZ-01, AUTHZ-02 |
| AC-L3-06 | AUTH-04 |
| AC-L3-07 | AUTHZ-03, CN-02 |
| AC-L3-08 | CN-05 |
| AC-L3-09 | QUEUE-01, UI-L3-05, E2E-L3-02 |
| AC-L3-10 | STAFF-01, E2E-L3-02 |
| AC-L3-11 | STAFF-05 |
| AC-L3-12 | STAFF-06, UI-L3-07, E2E-L3-02 |
| AC-L3-13 | CN-03, UI-L3-09 |
| AC-L3-14 | USER-02, UI-L3-10, E2E-L3-03 |
| AC-L3-15 | USER-05, UI-L3-11, E2E-L3-03 |
| AC-L3-16 | AUTH-10 |
| AC-L3-17 | MIG-01 |
| AC-L3-18 | VIS-L3-01, VIS-L3-02, VIS-L3-03, VIS-L3-04 |

## 4. Responsive and Visual Checklist

Tracks `ui-spec.md` §9, updated as each screen ships (not backfilled):

- [ ] Login / Change Password — pending Issue 15
- [ ] Ticket Queue — pending Issue 18
- [ ] IT Staff Ticket Detail (incl. Internal Notes distinctness) — pending Issue 19
- [ ] User Management — pending Issue 20

## 5. Test Commands

Unchanged from Lab 2 — server (`npm test` from `server/`), client
(`npm test` from `client/`), E2E (`npx playwright test` from the repo
root). No new tooling introduced.

## 6. Final Results

Not yet run — implementation has not started as of this document's first
commit (Issue 13). This section is filled in during Issue 21/22 the same
way `docs/lab-02/tests.md` §6 was, once every planned test file above
exists and passes.

## 7. Known Limitations or Deferred Tests (anticipated)

- **AUTHZ-01/02 test `requireRole` against a minimal test-only app, not a
  real IT-Staff-only/Administrator-only endpoint.** No such endpoint exists
  yet in Issue 16 (Ticket Queue lands in Issue 18, User Management in Issue
  20); a small role-gated route mounted in the test file itself proves the
  middleware works and will be re-exercised for real once those endpoints
  exist, the same way Issue 15's AUTH-06 tested `requirePasswordAlreadyChanged`
  before any real route needed it.
- **AUTHZ-04 tests the generalized `OwnershipResult<T>`/`respondOwnershipFailure`
  primitive directly, not a concrete User or Session resolver.** No route
  needs to resolve ownership of a User or Session by id yet (Sessions are
  only ever read via their own cookie, not a client-supplied id; User
  ownership checks arrive with Issue 20's admin endpoints). Extending the
  type into its own shared module in this issue is what makes reusing it
  for Comments/Notes (Issue 17/19) and Users (Issue 20) require no further
  refactor — a placeholder resolver with no caller was deliberately not
  added just to have something resource-specific to test now.
- E2E again covers golden paths only (per file, one flow each), matching
  Lab 2's documented scope decision — not a gap to fix, a repeated
  trade-off recorded up front this time instead of discovered at the end.
- Lockout timing (AUTH-04) is tested against a short test-only window, not
  the production window value, to keep the test suite fast — the
  mechanism is proven, not the exact production duration.
- No dedicated unit test file for `RoleNavigationFactory`,
  `TicketDetailMediator`, or the Singleton/Facade auth classes in
  isolation beyond what the API-level auth/staff tests already exercise
  through them — they are covered indirectly, consistent with Lab 2's
  precedent of not writing a redundant isolated test for every internal
  collaborator when the integration test already exercises the real path.
