# AI Use and Reflection — Lab 3

I used Claude Code (Claude Sonnet 5) as an AI coding assistant throughout
this sprint, across all nine Issues from the engineering contract through
release readiness. The working pattern stayed the same as Lab 2: every
Issue split into a "plan" turn (process and testing, covering both
software structure and security, no code touched) followed by a separate
"ready for feature N" turn that implemented, tested, and staged the work
for my own review before I committed. I reviewed every generated diff,
ran the real test suites and E2E specs myself (or had the assistant run
them and report the actual output), and treated the labsheet PDF and this
repo's own `docs/lab-03/*.md` as the authoritative source.

## Work completed by branch

| Branch | AI-assisted work completed |
| --- | --- |
| `feature/13-Sprint-3-engineering-contract` | Drafted `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` for Lab 3 — session-based auth design (chosen over JWT specifically for immediate revocability, BR-L3-03), the three-role model, and the full FR/BR/AC numbering scheme carried through every later Issue. |
| `feature/14-data-model-migration-seed` | Added the `User`/`Session`/`Role` schema, migrated `DevRequester` records into real `User` rows (id-preserving, no guessable passwords), and expanded `TICKET_STATUSES` from Lab 2's `NEW`-only placeholder to the full 8-value BR-L3-13 state machine. Server suite went from Lab 2's baseline to 55/55 (49 regression + 6 new). |
| `feature/15-authentication-foundation` | Built the Singleton `PasswordHasher`/`SessionTokenService`, the Facade `AuthFacade`, login/logout/change-password routes, and the `Session` DB table used instead of JWT. 74/74 server tests passing (19 new auth tests). |
| `feature/16-Role-based-authorization+shell` | Built `requireRole`/`requireSession` middleware, the `OwnershipResult<T>` discriminated union centralizing every 404-vs-403 decision app-wide, and the Factory-pattern `RoleNavigationFactory` driving the per-role app shell. |
| `feature/17-Requester-regression+Public-Comments` | Migrated every Requester-facing route off Lab 2's dev-header auth onto real sessions without breaking existing behavior, and added Public Comments. |
| `feature/18-it-staff-ticket-queue` | Built the Builder-pattern `TicketQueryBuilder` and the IT Staff Ticket Queue screen. Found and fixed a real bug during implementation: a Requester hitting the same `GET /api/tickets` URL with staff-only query params still only saw their own tickets, since the role branch — not the query params — decides scope; the fix made that explicit rather than relying on the params being absent. |
| `feature/19-IT-Staff-Ticket-Detail+status-workflow` | Built the State-pattern ticket status machine (one class per status, `getTicketState`/`allowedActions`), staff actions (claim/reassign/priority/status), Internal Notes with the BR-L3-17 role-gate-before-ownership rule, and the Mediator-pattern `TicketDetailMediator` coordinating panel refresh. Found and fixed a real bug during manual browser verification: IT Staff got 403 trying to view a Requester's attachments, because the attachment GET routes were still Requester-only from Lab 2 and had never been extended for the new staff read paths. Also fixed two test-logic bugs in my own new tests, not product bugs: a migration test asserting a now-false whole-table invariant once priority became independently editable via the new endpoint, and an ID-collision false positive (Public Comments and Internal Notes have independent autoincrement sequences, so the same id legitimately exists in both tables). |
| `feature/20-Administrator-user-management` | Built the Observer-pattern session invalidation (`UserService.deactivateUser` → `userDeactivated` event → `SessionInvalidationListener`, using a custom `emitAndWait` helper so deactivation is provably synchronous from the caller's perspective, not fire-and-forget), system-generated one-time initial passwords, and User Management. Added self-deactivation and last-active-admin guards beyond the base spec, prompted directly by reviewing a gap in a collaborator's parallel implementation (see `reviewer.md`). Found and fixed a real test-isolation bug: my first version of the deactivation test used whichever seeded Requester `loginAsRequester()` returned first, permanently corrupting which account other test files' `loginAsRequester(0)` resolved to afterward, since all server tests run sequentially against one shared database. Fixed by using a dedicated throwaway account per test; confirmed stable across 3 consecutive full-suite runs. |
| `feature/21-Security-hardening&audit` | Added `helmet` for CSP headers (BR-L3-12) and wrote a consolidated security-audit test file: a command-injection static guard (recursive source scan for `child_process`/`exec`/`spawn`), a SQL-injection guard for the unsafe raw-query variants (not originally itemized in `tests.md`, added as a bonus once the command-injection scan pattern made it easy to reuse), an attachment path-traversal regression test, and a three-part IDOR sweep across tickets/comments/notes/users/sessions in one file. No new vulnerabilities were found — the six other named classes were already closed in earlier Issues, so this Issue's actual work was proving that, not fixing anything net-new. |
| `feature/22-Release-readiness-lab3` | This file, `reviewer.md`, the README rewrite for Lab 3 (login instead of Dev Requester selection, the three roles, updated doc links), a final Zen Green/responsive visual pass, `artifacts/lab-03/screenshots/`, `tests.md` §6 final results, and the real `lab3-staging` → `main` release PR that Lab 2 never opened. |

## Selected key prompts

| Prompt name | Actual prompt text | Result and reflection |
| --- | --- | --- |
| Plan-then-implement split | "Let's keep going with feature N. Plan the process and test carefully." / "Ready for feature N" | Kept as a strict two-turn pattern for every Issue this sprint, same as Lab 2's later Issues. Separating "here's what I'd do" from "now actually do it" gave a checkpoint to redirect before any code existed — used a few times to correct scope before implementation started, cheaper than correcting a diff after. |
| Security and structure as two named lenses | "Can you plan the next feature? On process and testing, both software structure and security." | Made the review checklist for Issue 21 explicit as two separate passes instead of one blended one — software structure (does the state machine/builder/observer hold up) and security (does the named vulnerability-class table in `specification.md` §10 actually stay closed). The security pass surfaced the SQL-injection-unsafe-variant guard as worth adding even though it wasn't in the original `tests.md` table, because the command-injection scan's file-walk pattern made it nearly free to extend. |
| Push back on my own gap, not just implement | (after reviewing a collaborator's Admin User Management PR and noting the admin typed the initial password) "feature 20 is ready." | Before implementing Issue 20, the review of the neighboring PR had already surfaced that admin-typed passwords were a real BR-L3-19-style gap. Rather than repeating it here, the initial-password generator and the self-deactivation/last-admin guards were built in from the start — the fix came from reviewing someone else's code, not from a defect found in this one. |
| Standing process correction | "Don't touch my github please. I will close issue myself and don't create random branch." | A direct correction to how I'd been operating (creating branches via `git checkout -b`, implicitly assuming issue-closing was mine to do). Saved as a permanent memory rather than a one-Issue instruction, since it changes how every subsequent Issue in this sprint gets implemented — I stopped creating branches and stopped touching GitHub issue state entirely from that point on. |
| Investigate before assuming a tool problem | "I cannot push feature/18 again. Can you look at it for me?" / "Now local host:3000 is error?" | Both looked like tool failures at first glance but were configuration/state issues (a missing upstream tracking branch; a dev server that had simply been stopped after prior verification, not a real error) — diagnosed with `git rev-parse --abbrev-ref ...@{upstream}` and a server status check rather than assumed and worked around blindly. |

## Reflection

The two real product bugs found this sprint (the Requester-staff query-param
scoping gap in Issue 18, the IT Staff attachment-read-403 in Issue 19) were
both caught by testing the actual role boundary directly — hitting the
same endpoint as a different role and checking the response — rather than
by reading the code and assuming the role branch was exhaustive. Neither
would have been caught by a green test suite that only exercised the
happy path per role in isolation, which is exactly why Issue 21's IDOR
sweep was written to cross roles against the same resource in one test
rather than testing each role's access separately. The test-isolation
bugs (the migration-invariant test in Issue 19, the shared-seed-pool
corruption in Issue 20) were a different category entirely — not wrong
production code, but tests that made an assumption about shared state
that stopped holding once a later Issue's own legitimate feature (editable
priority, `loginAsRequester(0)` reused across files) invalidated it. Both
were only caught by actually running the full suite repeatedly rather than
trusting a single green run, which is why Issue 20's fix was verified
against 3 consecutive full-suite runs before being considered stable
rather than accepted on the first pass. The clearest process lesson was
the mid-sprint "don't touch my github" correction: it wasn't a code
defect at all, just an assumption about scope of authority that needed
correcting once, and staying inside it for the rest of the sprint required
no further reminders — a single explicit correction, remembered, was
enough.
