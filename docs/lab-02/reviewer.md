# Lab 2 Reviewer Log

**Reviewer identity for this repository:** Jinnakan (owner/author). Peer
review came from two outside collaborators reviewing across repos —
**Bank848** and **N0M3KM** — plus continuous AI-assisted review from an
Claude Code session throughout implementation (see `ai-use.md`).

All pull requests below target `lab2-staging`, except PR #19 which targets
`main` (Issue 1 — the specification predates `lab2-staging`'s creation).

## Pull Requests Reviewed

| PR | Title | Branch | Reviewer(s) | Outcome |
|---|---|---|---|---|
| [#18](https://github.com/Jinnakan/TokTickIT/pull/18) | Data model & seed | `feature/6-lab2-schema-seed` | Bank848, N0M3KM | Approved, merged by Bank848 |
| [#19](https://github.com/Jinnakan/TokTickIT/pull/19) | Sprint specification & test plan | `feature/5-lab2-specification` | Bank848 | Approved, merged |
| [#20](https://github.com/Jinnakan/TokTickIT/pull/20) | Development Requester context | `feature/7-dev-requester-context` | Bank848 | Approved, merged |
| [#21](https://github.com/Jinnakan/TokTickIT/pull/21) | Create Ticket (API + UI) | `feature/8-create-ticket` | N0M3KM | Changes requested → addressed → approved, merged |
| [#22](https://github.com/Jinnakan/TokTickIT/pull/22) | My Tickets (list API + UI) | `feature/9-my-tickets` | N0M3KM | Changes requested → addressed → approved, merged |
| [#23](https://github.com/Jinnakan/TokTickIT/pull/23) | Ticket Detail + attachment lifecycle | `feature/10-ticket-detail-attachments` | N0M3KM | Approved, merged |

## Comments Given and Received, With Responses

### PR #18 — Data model & seed

**Received (Bank848 and N0M3KM, independently):** the compound index
`@@index([ticketId, isRemoved])` on `Attachment` already covers lookups on
`ticketId` alone via the B-tree leftmost-prefix rule, so the separate
`@@index([ticketId])` was pure write overhead with no query benefit.

**Response:** agreed, removed the redundant index before merge.

### PR #19 — Sprint specification & test plan

**Received (Bank848):** two Markdown table rows (BR-23, AC-18) in
`specification.md` were missing a trailing pipe and weren't rendering as
table rows; the client test file paths in `tests.md` used a literal space
before "tests" (`lab-02 tests/`) instead of a path separator — unclear if
intentional.

**Response:** confirmed both were typos. The pipe issue was fixed
immediately. The `tests.md` path typo was *not* actually fixed at the time
— re-discovered during Issue 7's release-readiness pass, where `tests.md`
was rewritten to use the real, final test file paths (which had also
diverged further from the plan as components were renamed during
development — see `tests.md` §1 for the fix).

### PR #20 — Development Requester context

**Received (Bank848):** non-blocking question — should
`SystemStatusCheck` (the Lab 1 health-check panel) stay reachable
somewhere in the shell, since it's now only rendered in tests?

**Response:** explained that `ui-spec.md`'s app shell replaces the Lab 1
root view entirely and has no health-check panel in its required screen
set; the component was intentionally relocated out of the default flow
(kept only for its existing Lab 1 test coverage), not deleted.

### PR #21 — Create Ticket (API + UI)

**Received (N0M3KM):** four issues — (1) validation rules (length bounds,
priority enum) were duplicated between client and server with no shared
source of truth; (2) required fields were missing `aria-required`; (3)
invalid fields were missing `aria-invalid`/`aria-describedby`; (4) the busy
state during submission only disabled the Submit button, leaving the rest
of the form editable while a request was in flight.

**Response:** extracted validation rules and constants into
`packages/shared/src/ticket-rules.ts`, consumed by both client and server;
added the missing ARIA attributes to all five required fields; wrapped the
form fields in a `<fieldset disabled={isSubmitting}>` so the whole form —
not just Submit — is non-interactive during a request. Verified live in
the browser (`:disabled` matching on a field mid-submit) since the
`fieldset`-inherited disable doesn't show up on a child's raw `.disabled`
IDL property per spec, only on its actual interactive behavior.

**Follow-up (N0M3KM):** the cross-package relative import this fix
introduced (`../../../server/src/ticket-rules.js` from client code) was
flagged as a real risk — it works only because that file happens to have
no server-only dependencies today, and nothing stops that from changing
later and silently breaking or bloating the client bundle.

**Response:** agreed the critique was correct — this was a known tradeoff
made under time pressure, not an oversight. Restructured into a proper npm
workspace (`packages/shared`, root `package.json` with `"workspaces"`),
consumed as `@toktickit/shared` by both `client` and `server` through real
package resolution rather than a relative reach-through across the
package boundary.

### PR #22 — My Tickets (list API + UI)

Same reviewer, same category of feedback as PR #21 (this PR landed before
#21's fixes were merged forward, so it briefly reintroduced the same
gaps). Addressed identically once the shared-package and ARIA fixes from
#21 were merged into this branch.

### PR #23 — Ticket Detail + attachment lifecycle

**Received (N0M3KM):** "The code is clean. Everything seems to be
functioning correctly. Nice job :)" — no changes requested.

## Approvals

All six PRs above carry at least one explicit approval before merge.
None were merged without review.
