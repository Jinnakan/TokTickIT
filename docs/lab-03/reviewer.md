# Lab 3 Reviewer Log

**Reviewer identity for this repository:** Jinnakan (owner/author). Peer
review came from an outside collaborator reviewing across repos —
**N0M3KM** — plus continuous AI-assisted review from a Claude Code session
throughout implementation (see `ai-use.md`).

All pull requests below target `lab3-staging`.

## Pull Requests Reviewed

| PR | Title | Branch | Reviewer | Outcome |
|---|---|---|---|---|
| [#36](https://github.com/Jinnakan/TokTickIT/pull/36) | Sprint 3 engineering contract | `feature/13-Sprint-3-engineering-contract` | N0M3KM | Approved, merged |
| [#37](https://github.com/Jinnakan/TokTickIT/pull/37) | Data model migration + seed | `feature/14-data-model-migration-seed` | N0M3KM | Approved, merged |
| [#38](https://github.com/Jinnakan/TokTickIT/pull/38) | Authentication foundation | `feature/15-authentication-foundation` | N0M3KM | Approved, merged |
| [#39](https://github.com/Jinnakan/TokTickIT/pull/39) | Role-based authorization + shell | `feature/16-Role-based-authorization+shell` | N0M3KM | Approved, merged |
| [#40](https://github.com/Jinnakan/TokTickIT/pull/40) | Requester regression + Public Comments | `feature/17-Requester-regression+Public-Comments` | N0M3KM | Approved, merged |
| [#41](https://github.com/Jinnakan/TokTickIT/pull/41) | IT Staff Ticket Queue | `feature/18-it-staff-ticket-queue` | N0M3KM | Approved, merged |
| [#42](https://github.com/Jinnakan/TokTickIT/pull/42) | IT Staff Ticket Detail + status workflow | `feature/19-IT-Staff-Ticket-Detail+status-workflow` | N0M3KM | Approved, merged |
| [#43](https://github.com/Jinnakan/TokTickIT/pull/43) | Administrator user management | `feature/20-Administrator-user-management` | N0M3KM | Approved, merged |
| [#44](https://github.com/Jinnakan/TokTickIT/pull/44) | Security hardening & audit | `feature/21-Security-hardening&audit` | N0M3KM | Approved, merged |

Every Lab 3 PR carries an explicit GitHub "Approved" review before merge —
unlike Lab 2's PR #22, there was no round that only got a plain LGTM
comment without a formal Approve.

## Comments Given and Received, With Responses

### PR #36 — Sprint 3 engineering contract

**Received (N0M3KM):** "LGTM!! Ready to merge" — no changes requested.

### PR #37 — Data model migration + seed

**Received (N0M3KM):** the migration is structurally sound (safe enum
additions, correct nullable-then-NOT-NULL backfill pattern, id-preserving
`DevRequester`→`User` cutover with no guessable passwords). Two
non-blocking follow-ups: confirm the enum-then-DML ordering inside one
transaction is safe long-term, and note that re-running the seed script
will silently reset any live changes made to seeded accounts.

**Response:** both were accepted as accurate, non-blocking observations
rather than defects — the enum-then-DML ordering was already the pattern
Prisma generates and has held across every later migration in this sprint,
and the seed-script-resets-live-data behavior is intentional (the seed is
documented as a dev/test fixture, not a production migration).

### PR #38 — Authentication foundation

**Received (N0M3KM):** "LGTM :D" — no changes requested.

### PR #39 — Role-based authorization + shell

**Received (N0M3KM):** "LGTM Ready to merge :D" — no changes requested.

### PR #40 — Requester regression + Public Comments

**Received (N0M3KM):** "Looking good. Ready to merge." — no changes
requested.

### PR #41 — IT Staff Ticket Queue

**Received (N0M3KM):** "LGTM! Ready to merge ig" — no changes requested.

### PR #42 — IT Staff Ticket Detail + status workflow

**Received (N0M3KM):** "Clean and readable code. Well done :D" — no
changes requested.

### PR #43 — Administrator user management

**Received (N0M3KM):** "LGTM!!" — no changes requested.

### PR #44 — Security hardening & audit

**Received (N0M3KM):** "LGTM" — no changes requested.

## Reviews Given (external, informing decisions in this repository)

Two of N0M3KM's own PRs (in their parallel repository) were reviewed
during this sprint and fed back into decisions made here, not just
returned as isolated feedback:

- **Authentication foundation PR** — reviewed via a spawned
  security-reviewer subagent given the size of the diff. Findings were
  compared against this repo's own auth foundation (Issue 15) to confirm
  no equivalent gap existed here (session table design, bcrypt cost
  factor, cookie flags).
- **Admin User Management PR** — reviewed directly. Praised the
  server-side role enforcement and the self-deactivation/last-admin
  guards, but flagged that the admin typed the initial password rather
  than the server generating one, a deviation from the BR-L3-19-style
  best practice this repo follows. That review is the direct reason
  `initial-password.ts`'s system-generated-password design and the
  self-deactivation/last-active-admin guards in `users-router.ts` exist
  here beyond what the base spec required — a gap spotted in a
  neighboring implementation, closed pre-emptively rather than
  discovered independently later.

## Known Process Note

Unlike Lab 2, which never opened a final `lab2-staging` → `main` release
PR (documented as a gap in `docs/lab-02/reviewer.md`), Lab 3's Definition
of Done (§12) calls for exactly that PR, and Issue 22 delivers it as a
real, reviewed pull request — see the entry added to the table above once
that PR opens.
