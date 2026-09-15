# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Replace the Lab 2 Development Requester selector with real email/password
authentication and three server-enforced roles (Requester, IT Staff,
Administrator). Deliver an IT Staff Ticket Queue and Ticket Detail workflow
with status transitions, Public Comments and Internal Notes, a minimal
Administrator user-management screen, and a security hardening pass across
the whole application — all traceable back to this document the way Lab 2
traced back to its own specification.

## 2. Stakeholder Request Interpretation

The IT department wants the Lab 2 prototype to become usable by real staff:
Requesters log in instead of picking a fake identity, IT Staff can see and
work a shared queue of tickets, and an Administrator can manage who has
accounts. Authorization must be real and server-enforced, not a UI-only
convenience, since Lab 3 is also the point where the application first
becomes a plausible target for the OWASP-class attacks named in the
labsheet (XSS, CSRF, IDOR, SQL injection, brute-force, broken
authentication). Ticket workflow automation (SLAs, notifications, approval
chains) remains out of scope; this sprint is about who can do what, and
proving it.

## 3. Scope

### Included

- Real authentication: email + password login/logout, session-based (not
  JWT), mandatory password change on first login
- Three roles: `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`, one role per user
- Server-side authorization on every endpoint (never hidden-UI-only)
- Migration of Lab 2's DevRequester rows into real User rows
- Lab 2 Requester screens continuing to work under real auth (regression)
- Public Comments (Requester and IT Staff) and Internal Notes (IT Staff
  only) on a Ticket
- IT Staff Ticket Queue: search/filter/sort/paginate across all tickets
- IT Staff Ticket Detail: claim/reassign, set IT Priority, change status
  through the full 8-value state machine, read/write comments and notes
- Administrator user management: list/search/filter, create, edit,
  activate/deactivate, reset password
- Security hardening: XSS, CSRF, IDOR, SQL injection, brute-force, broken
  authentication, file-inclusion regression, command-injection guard

### Excluded (labsheet §4.2 and course-scope decisions)

- Email delivery of any kind (invitations, password resets, notifications)
- MFA, social login, SSO, self-registration
- Actions Taken / Event Log (deferred to Lab 4)
- SLA tracking, escalation, dashboards/KPIs beyond simple counts
- Multi-tenant organizations, multiple roles per user
- User deletion, bulk operations, import/export, account-history screens
- Account-unlocking workflows (lockout is time-based auto-clear, not
  admin-unlock — see §5 BR-L3-09)
- Approval workflows, mandatory pagination/multi-sort/multi-filter on the
  Administrator user list
- SSRF and command-injection mitigation beyond a guard test — neither
  vulnerability class has a real attack surface in this codebase (no
  outbound URL-fetching feature, no shell execution); see §9 Security
  Requirements for why these are proven absent rather than "fixed"

## 4. Functional Requirements

- **FR-L3-01** The system shall let a user log in with email and password
  and establish a server-side session on success.
- **FR-L3-02** The system shall force a password change before any other
  action when `mustChangePassword` is true for the logged-in user.
- **FR-L3-03** The system shall let a logged-in user log out, deleting
  their session server-side (not merely clearing a client cookie).
- **FR-L3-04** The system shall reject every protected endpoint for a
  request without a valid session, independent of what the UI shows.
- **FR-L3-05** The system shall restrict each endpoint to the roles
  permitted to use it, returning 403 (not merely hiding the button) for a
  logged-in user of the wrong role.
- **FR-L3-06** The system shall let a Requester perform every Lab 2
  Requester action (create ticket, list own tickets, view own ticket
  detail, manage own attachments) under real authentication instead of the
  Development Requester header.
- **FR-L3-07** The system shall let a Requester or IT Staff member post a
  Public Comment on a Ticket they can access.
- **FR-L3-08** The system shall let IT Staff post an Internal Note on a
  Ticket, invisible to Requesters.
- **FR-L3-09** The system shall let IT Staff retrieve a paginated,
  searchable, filterable, sortable queue of all Tickets (not scoped to one
  requester).
- **FR-L3-10** The system shall let IT Staff claim an unassigned Ticket or
  reassign a Ticket already assigned to another IT Staff member.
- **FR-L3-11** The system shall let IT Staff set or change a Ticket's IT
  Priority, independent of the Requester's original Requested Priority.
- **FR-L3-12** The system shall let IT Staff transition a Ticket's status
  only along the paths allowed by the state machine in §5 BR-L3-13,
  rejecting any other transition.
- **FR-L3-13** The system shall let an Administrator list, search, and
  filter Users.
- **FR-L3-14** The system shall let an Administrator create a User with an
  email, name, role, and system-generated initial password shown once
  on-screen.
- **FR-L3-15** The system shall let an Administrator edit a User's name,
  role, and active status.
- **FR-L3-16** The system shall let an Administrator reset a User's
  password to a new system-generated value, shown once on-screen, and set
  `mustChangePassword` true.
- **FR-L3-17** The system shall invalidate every active session belonging
  to a User the instant that User is deactivated.
- **FR-L3-18** The system shall lock out login attempts for an
  email+IP combination after repeated failures, clearing automatically
  after a fixed time window (no administrator unlock action exists).

## 5. Business Rules

| BR ID | Rule |
|---|---|
| BR-L3-01 | A User has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. There is no multi-role assignment. |
| BR-L3-02 | Passwords are hashed with bcrypt before storage; the plaintext password is never persisted or logged. |
| BR-L3-03 | A session is a database row (`Session`), not a stateless token, specifically so deactivating a User can revoke every session that User holds (FR-L3-17). |
| BR-L3-04 | The session cookie is `httpOnly`, `SameSite=Lax`, and marked `Secure` in production. |
| BR-L3-05 | Login failure returns one generic message ("Invalid email or password") regardless of whether the email exists, the password is wrong, or the account is inactive — this prevents user enumeration. |
| BR-L3-06 | On successful login, the session id is regenerated (never reuses a pre-login session id), preventing session fixation. |
| BR-L3-07 | A User created by an Administrator has `mustChangePassword = true`; the very next successful login must be followed by a password change before any other authenticated action succeeds. |
| BR-L3-08 | Rate limiting on `POST /api/auth/login` is keyed by (email, IP): a fixed number of failures within a rolling window triggers a temporary lockout; the window then clears on its own. No administrator action can lift a lockout early, since that workflow is explicitly out of scope (§3). |
| BR-L3-09 | Mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) are rejected if their `Origin` (or `Referer` when `Origin` is absent) does not match the application's own origin, as defense-in-depth alongside the `SameSite=Lax` cookie (CSRF). |
| BR-L3-10 | Ownership/authorization checks run server-side for every resource type introduced in Lab 3 (Users, Sessions, Comments, Notes) using the same `OwnershipResult<T>` discriminated-union pattern Lab 2 established for Tickets/Attachments — never a client-side-only check. |
| BR-L3-11 | All database access continues to go through Prisma's query builder; `$queryRaw`/`$executeRaw` are not used anywhere in Lab 3 code (SQL injection). |
| BR-L3-12 | Any field that accepts free text a Requester or IT Staff will later read back (Comment body, Note body, Ticket Summary/Description) is rendered exclusively through React's default JSX text interpolation; `dangerouslySetInnerHTML` is never used on user-supplied content (XSS). |
| BR-L3-13 | Ticket status is one of `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`. Allowed transitions and the roles permitted to make them are defined per-state in the `TicketState` implementation and documented in `api-spec.md` §4. |
| BR-L3-14 | A Ticket's `itPriority` starts equal to its `requestedPriority` at creation and is changed only by IT Staff/Administrator afterward; a Requester never sees or edits `itPriority` directly. |
| BR-L3-15 | Public Comments and Internal Notes are stored in two separate tables (`PublicComment`, `InternalNote`), not one polymorphic table with a visibility flag — chosen so a query-level mistake can leak a flag value but cannot leak the wrong table's rows. |
| BR-L3-16 | Both Comments and Notes are append-only in Lab 3: no edit or delete endpoint exists for either. |
| BR-L3-17 | A Requester who requests an Internal Note (directly, by id, or via any endpoint that would expose one) receives 403, not 404 — the Ticket exists and they can see it, just not this sub-resource, matching the Lab 2 cross-role convention (`ticket-ownership.ts`). |
| BR-L3-18 | Deactivating a User is idempotent, sets `isActive = false`, and synchronously deletes every `Session` row belonging to that User in the same transaction — not via a background job or a check performed only at next request time. |
| BR-L3-19 | Administrator-issued passwords (creation and reset) are generated server-side with sufficient entropy and shown exactly once in the API response and UI; they are never emailed (§3 exclusion) and never retrievable again after that first display. |
| BR-L3-20 | The Lab 2 attachment path-containment guard (`attachment-storage.ts`) is unchanged in Lab 3; Issue 21 re-proves it with a regression test rather than re-implementing it (file inclusion). |
| BR-L3-21 | No code path in `server/src` invokes `child_process`, `exec`, `spawn`, or any shell command construction from request data; a guard test asserts this remains true (command injection — no real feature requires it). |
| BR-L3-22 | No feature in Lab 3 fetches a URL supplied by request data (no webhook, no link preview, no outbound integration); SSRF mitigation is therefore "the surface doesn't exist," documented here rather than invented defensively. |

## 6. UI Specification Summary

Full detail lives in `ui-spec.md`. Summary:

- **Login / Change Password**: replaces the Development Requester
  Selection screen; same Zen Green shell, same field-state rules.
- **Application shell**: nav becomes role-specific (Requester keeps My
  Tickets/Create Ticket; IT Staff gets Ticket Queue; Administrator gets
  User Management), current-user display replaces "current Requester",
  Change Requester is replaced by Logout.
- **Requester screens**: Lab 2's Create Ticket / My Tickets / Ticket Detail
  carry over unchanged in layout, with a Public Comments panel added to
  Ticket Detail.
- **IT Staff Ticket Queue**: table/card list across all tickets (not
  requester-scoped), with search/filter/sort/pagination controls.
- **IT Staff Ticket Detail**: read-only Requester-submitted fields, plus
  claim/reassign, IT Priority control, status-transition control (only
  showing transitions valid from the current state), Public Comments panel,
  Internal Notes panel (visually distinct from Public Comments so IT Staff
  never confuses which one a Requester will see).
- **Administrator User Management**: list with search/role/active filters,
  Create User form, Edit User form, activate/deactivate toggle with
  confirmation, Reset Password action showing the new password once.
- All screens follow the same Zen Green color tokens, field-state rules,
  and responsive breakpoints `ui-spec.md` defined for Lab 2; Lab 3 extends
  that baseline rather than replacing it.

## 7. Data Changes

Full field list, indexes, and migration notes in the schema itself and
`api-spec.md`.

- **User** (existing stub, extended) — add `name`, `passwordHash`, `role`
  (enum `Role`: `REQUESTER`/`IT_STAFF`/`ADMINISTRATOR`), `isActive`
  (default `true`), `mustChangePassword` (default `false`).
- **Session** (new) — `id`, `userId` (FK → User), `createdAt`, `expiresAt`.
  DB-backed and revocable; not a JWT (BR-L3-03).
- **Ticket** (extended) — add `ticketOwnerId` (nullable FK → User, the
  claiming IT Staff member), `itPriority` (enum `Priority`, same enum as
  `requestedPriority`, copied at creation). `currentStatus` enum grows from
  `NEW`-only to the full 8-value set in BR-L3-13 via migration, not a
  column-type change.
- **PublicComment** (new) — `id`, `ticketId` (FK → Ticket), `authorId` (FK
  → User), `body`, `createdAt`. Append-only.
- **InternalNote** (new) — `id`, `ticketId` (FK → Ticket), `authorId` (FK
  → User), `body`, `createdAt`. Append-only, IT Staff/Administrator only.
- **DevRequester → User migration**: every DevRequester row becomes a User
  row with `role: REQUESTER`; `Ticket.requesterId` is repointed at the new
  User id in the same migration. A migration test asserts every
  pre-existing Ticket is still owned by the correct (now-User) requester
  after the migration runs.
- Consider renaming `Ticket.requesterId` → `requesterUserId` once it points
  at `User` — decided explicitly during Issue 14 implementation, not
  silently carried over.
- Seed minimums (idempotent): ≥4 active + 1 inactive Requester, ≥3 active +
  1 inactive IT Staff, ≥1 active Administrator.

## 8. API Contract

Full request/response shapes, statuses, and error cases are in
`api-spec.md`. Endpoints introduced or changed in this sprint:

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/auth/change-password`
- `GET /api/tickets` (IT Staff variant: all tickets, not requester-scoped)
- `GET /api/tickets/:id` (IT Staff/Administrator can access any ticket;
  Requester access remains ownership-scoped as in Lab 2)
- `POST /api/tickets/:id/claim`, `POST /api/tickets/:id/reassign`
- `PATCH /api/tickets/:id/priority` (IT Priority)
- `PATCH /api/tickets/:id/status`
- `GET/POST /api/tickets/:id/comments`
- `GET/POST /api/tickets/:id/notes` (IT Staff/Administrator only)
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`
- `POST /api/users/:id/reset-password`
- `POST /api/users/:id/deactivate`, `POST /api/users/:id/activate`

Every Lab 2 endpoint that previously read `X-Dev-Requester-Id` reads the
session-derived user id instead; the header is removed entirely (BR-23 from
`docs/lab-02/specification.md`, honored as planned).

## 9. Design Patterns

Selected only where they fit a real Lab 3 need — see `temp.md` (working
notes, removed at the end of the lab) for the fuller rationale considered
during planning.

| Pattern | Lives in | Why here |
|---|---|---|
| Singleton | `server/src/auth/password-hasher.ts`, `session-token-service.ts` | One shared instance holds hashing/session-signing config; a private constructor stops a second, differently-configured instance from silently existing. |
| Facade | `server/src/auth/auth-facade.ts` | `login()/logout()/changePassword()/getCurrentUser()` hide the coordination between the hasher, the session store, and the user repo from route handlers. |
| Builder | `server/src/staff/ticket-query-builder.ts` | The IT Staff Queue's search/filter/sort/paginate combination is naturally step-by-step (`.withSearch().withStatus().withPriority().sortBy().paginate().build()`) rather than one large conditional query object. |
| Factory | client `nav/role-navigation-factory.ts` | Replaces an if/else chain choosing nav items per role with `getNavItemsForRole(role)`. |
| State | `server/src/tickets/ticket-state/*` | The 8-status transition table in BR-L3-13 is exactly the branching-logic-that-doesn't-scale case the State pattern targets; one class per status encapsulates `canTransitionTo(next, role)` and `allowedActions()`. |
| Observer | `server/src/users/user-events.ts` (Node `EventEmitter`) | `UserService.deactivateUser()` emits `userDeactivated`; a `SessionInvalidationListener` reacts by deleting that user's sessions — decouples "a user was deactivated" from "therefore invalidate sessions" so the emitter doesn't need to know who's listening. |
| Mediator | client `staff/ticket-detail-mediator.ts` | Coordinates the Public Comments, Internal Notes, and status-change panels on IT Staff Ticket Detail so they can react to each other (e.g. a status change refreshing the visible actions) without each panel holding a reference to every other panel. |

Prototype and Proxy were considered during planning and explicitly dropped
as forced fits for this codebase's actual needs.

## 10. Security Requirements

Mapped one class to one or more issues; full mitigation detail is co-located
with the relevant endpoint in `api-spec.md` rather than duplicated here.

| Class | Primary issue | Mitigation |
|---|---|---|
| Broken authentication | 15 | bcrypt, session regeneration on login, generic invalid-credentials message, httpOnly+SameSite cookie, server-side logout (BR-L3-02, 05, 06, 04) |
| Brute-force | 15 | time-based auto-clearing lockout on `/api/auth/login`, keyed by email+IP (BR-L3-08) |
| CSRF | 15 | `SameSite=Lax` cookie plus Origin/Referer check on mutating routes (BR-L3-09) |
| IDOR | 16 (foundation), 17, 19, 20, swept again in 21 | `OwnershipResult<T>` resolver extended to Users/Sessions/Comments/Notes (BR-L3-10, 17) |
| SQL injection | 14 (rule), 18 (builder) | Prisma only, no raw SQL; Builder pattern's sort/filter fields validated against an allowlist enum (BR-L3-11) |
| XSS | 17, 19 | React default escaping, zero `dangerouslySetInnerHTML`, CSP header added in 21 (BR-L3-12) |
| File inclusion | 21 (regression only) | Lab 2's `attachment-storage.ts` path-containment untouched, re-proven post-migration (BR-L3-20) |
| Command injection | 21 (guard test) | No `child_process`/`exec`/`spawn` in `server/src`; test asserts this stays true (BR-L3-21) |
| SSRF | N/A, documented | No outbound URL-fetching feature exists; not invented to "fix" (BR-L3-22) |

## 11. Acceptance Criteria

| AC ID | Criterion |
|---|---|
| AC-L3-01 | Given valid credentials, when a user submits the Login form, then a session is created and the user lands on the screen appropriate to their role. |
| AC-L3-02 | Given invalid credentials (wrong password, unknown email, or inactive account), when login is attempted, then the same generic error message is shown in all three cases and no session is created. |
| AC-L3-03 | Given `mustChangePassword` is true, when the user logs in successfully, then every other authenticated route redirects to Change Password until it succeeds. |
| AC-L3-04 | Given a user is not logged in, when they call any protected API endpoint directly, then the API returns 401, independent of what the UI would have shown. |
| AC-L3-05 | Given a Requester is logged in, when they call an IT-Staff-only or Administrator-only endpoint directly, then the API returns 403. |
| AC-L3-06 | Given repeated failed logins for one email from one IP exceed the configured threshold, when another attempt is made within the lockout window, then the API rejects it even with the correct password, and automatically allows attempts again once the window elapses. |
| AC-L3-07 | Given a Requester is logged in, when they open a Ticket they do not own (by id, directly), then the API returns 403, matching the Lab 2 cross-role convention. |
| AC-L3-08 | Given a Requester is logged in, when they request an Internal Note on a Ticket they do own, then the API returns 403, not the note content and not 404. |
| AC-L3-09 | Given IT Staff is logged in, when they open the Ticket Queue, then Tickets from every Requester are visible, sortable, filterable, and paginated. |
| AC-L3-10 | Given an unassigned Ticket, when an IT Staff member claims it, then `ticketOwnerId` is set to that IT Staff member and the queue reflects the change. |
| AC-L3-11 | Given a Ticket in status `NEW`, when IT Staff attempts to transition it directly to `CLOSED`, then the API rejects the transition (not an allowed path in BR-L3-13) and the status is unchanged. |
| AC-L3-12 | Given a valid status transition, when IT Staff performs it, then the Ticket's `currentStatus` updates and the change is immediately visible on both Queue and Detail. |
| AC-L3-13 | Given a Requester posts a Public Comment containing HTML/script-like text, when it is later rendered on Ticket Detail, then the text renders as plain text (no script execution, no raw HTML injection). |
| AC-L3-14 | Given an Administrator creates a User, when creation succeeds, then the initial password is shown exactly once in the response/UI and cannot be retrieved again afterward. |
| AC-L3-15 | Given an Administrator deactivates a User who has an active session, when deactivation completes, then that user's next authenticated request fails as unauthenticated, not merely "the button is hidden." |
| AC-L3-16 | Given a mutating request arrives with a mismatched or missing `Origin`/`Referer`, when the request reaches the route handler, then it is rejected before any state changes. |
| AC-L3-17 | Given the DevRequester → User migration has run, when a pre-existing Lab 2 Ticket is queried by its now-User requester, then it is still correctly returned as owned by that requester. |
| AC-L3-18 | Given a user is on any Lab 3 screen at desktop, tablet, and mobile viewport widths, when the layout renders, then no labels are clipped, no controls overlap, and the page never scrolls horizontally (same standard as Lab 2's `ui-spec.md` §7). |

## 12. Definition of Done

**Product completion**

- All Functional Requirements (§4), Business Rules (§5), and Security
  Requirements (§10) are implemented as specified.
- Every Acceptance Criterion (§11) has at least one passing, traceable
  automated test (see `tests.md`).
- No required test is skipped, disabled, or commented out; full suite
  passes from documented commands on the final `main` branch.
- All screens listed in §6 conform to `ui-spec.md` and the Zen Green tokens
  at desktop/tablet/mobile.
- Authorization is enforced server-side for every role/resource
  combination (verified by tests, not only hidden client-side).
- README setup/run/test instructions are current for Lab 3.

**Course delivery**

- Each Issue implemented on its own feature branch, merged into
  `lab3-staging` via a peer-reviewed Pull Request.
- One real release Pull Request opens `lab3-staging` → `main` after
  integration testing (Issue 22) — Lab 2 never did this as its own
  reviewed PR; Lab 3 does not repeat that gap.
- `reviewer.md` and `ai-use.md` are current for Lab 3, updated per issue as
  work happens rather than reconstructed at the end.
- GitHub Kanban shows all Lab 3 Issues in `Done`.

## 13. Assumptions and Decisions

- **Session over JWT**: chosen specifically because FR-L3-17/BR-L3-03
  require a deactivated user's sessions to become invalid immediately. A
  stateless JWT would keep working until it naturally expired, unless a
  revocation list were added — at which point it is no longer meaningfully
  stateless. A DB-backed session is the simpler mechanism that actually
  satisfies the requirement (YAGNI on JWT's supposed statelessness benefit,
  which this sprint doesn't need).
- **Comments/Notes as separate tables, not a visibility flag**: a single
  polymorphic table with `isInternal: boolean` was considered and rejected.
  A missed `WHERE isInternal = false` in one Requester-facing query would
  leak Internal Notes; with two physically separate tables, the same
  mistake is a compile-time wrong-table error, not a silent authorization
  bug (BR-L3-15).
- **Time-based lockout, not admin-unlock**: the labsheet's §4.2 exclusion
  of account-unlocking workflows makes the choice explicit rather than an
  oversight — a locked-out user waits out the window instead of an
  Administrator having an unlock button.
- **Cross-role access status codes carry over from Lab 2**: 404 for an
  unknown id, 403 for one that exists but isn't accessible to the caller's
  role/ownership, including the Internal-Notes-to-Requester case
  (BR-L3-17). Same trade-off Lab 2 accepted: easier to debug during
  development, at the cost of confirming an id exists to someone who can't
  read it — still acceptable for this course's threat model.
- **SSRF and command injection are documented as absent, not "fixed"**:
  inventing a vulnerable feature just to then patch it would misrepresent
  the codebase's actual attack surface; §10 documents why no code path
  triggers either class instead.
- **`itPriority` defaults from `requestedPriority` rather than starting
  null**: gives IT Staff a sane starting point to triage from, consistent
  with §7's decision to copy rather than leave unset at ticket creation.
