# AI Use and Reflection — Lab 2

I used Claude Code (Claude Sonnet 5) as an AI coding assistant throughout
this sprint, across all seven Issues from specification through release
readiness. I reviewed every generated diff, ran the real test suites and
migrations myself (or had the assistant run them and reported the actual
output), and treated the labsheet PDF as the authoritative source — the
assistant was told to re-read specific sections directly from the PDF
rather than work from its own summary whenever a requirement was unclear.

## Work completed by branch

| Branch | AI-assisted work completed |
| --- | --- |
| `feature/5-lab2-specification` | Drafted `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` from the labsheet's stakeholder request — numbered FRs/BRs/ACs, the data model, REST API contract, and Zen Green UI spec. Resolved three explicit design decisions with the team (ownership status codes, Requester-context header, attachment storage) via direct questions rather than silent defaults. |
| `feature/6-lab2-schema-seed` | Added `DevRequester`, `Ticket`, `Attachment`, `RelatedSystem` Prisma models plus `Category.isActive`, generated and applied the migration, wrote the idempotent seed (4 categories, 7 related systems, 4 active + 1 inactive Requester), verified via the actual running database, not just a schema diff. |
| `feature/7-dev-requester-context` | Built `GET /api/dev-requesters`, the Requester Selection screen, `sessionStorage`-based selection persistence with stale-id self-healing, the app shell, and Change Requester — verified live in the browser end to end. |
| `feature/8-create-ticket` | Built `POST /api/tickets` and the Create Ticket form. Found and fixed a real race condition (React StrictMode double-invoking effects could let a stale aborted-fetch rejection overwrite a later successful state update) during manual browser verification, not from a test failure. |
| `feature/9-my-tickets` | Built `GET /api/tickets` (search/filter/sort/pagination) and the My Tickets list/table UI. Found and fixed a real regression during implementation: making My Tickets the default shell view broke two of Issue 3's existing tests, whose fetch mocks weren't URL-routed. |
| `feature/10-ticket-detail-attachments` | Built `GET /api/tickets/:id`, the read-only Ticket Detail screen, and the full attachment lifecycle (upload/list/download/soft-remove) with an explicit security pass: magic-byte file-content sniffing (not just extension/MIME), a `SELECT ... FOR UPDATE` row lock closing a real concurrent-upload race on the 5-attachment limit (proven with an 8-way concurrency test), path-containment checks, and orphaned-file cleanup on transaction failure. Also found and fixed a pre-existing flaky test (an unscoped `prisma.ticket.count()` racing against other test files) and disabled Vitest's default file-level parallelism, since these are integration tests against one shared database. |
| `feature/11-lab2-release-docs` | Wrote this file, `reviewer.md`, and updated `tests.md` to match real file paths and final results. Ran a full Zen Green theming audit and found two real bugs live in the browser: the priority/status badges had no background fill at all (`text-bg-*-subtle` isn't a real Bootstrap class — the correct pairing is `bg-*-subtle` + `text-*-emphasis`), and every button was still Bootstrap's default blue because `.btn-*` classes bake in literal hex colors at Bootstrap's compile time rather than referencing the CSS custom properties I'd overridden. Added the missing system-generated fields section to Create Ticket (Ticket Number/Date/Requester, shown read-only before submission) per `ui-spec.md` §5.3, which had been missed entirely. Restructured the `ticket-rules.ts` cross-package import into a proper npm workspace (`packages/shared`) after a reviewer flagged the relative-import coupling. |

## Selected key prompts

| Prompt name | Actual prompt text | Result and reflection |
| --- | --- | --- |
| Trim the issue plan | "Make sure each issue is require pulling request for PR. If not then we can trim some of them down." | Cut the original 9-issue plan to 7 by merging two issues that wouldn't have produced a reviewable standalone diff (a standalone "add tests" issue contradicted the labsheet's own Test-DD rule; a standalone "Attachments" issue would have reopened two other issues anyway). Better than my own first draft. |
| Ticket creation, less duplication | "Now let do Ticket creation... make sure there are as less duplicate code as possible. And no spaghetti code." | Extracted shared validation into a `ticket-rules.ts` module server and client both import, instead of duplicating length/enum constants. This is the module a later reviewer comment (PR #21) flagged for the relative cross-package import risk — the DRY fix was right, the *mechanism* used to share it wasn't, and got corrected properly later. |
| My Tickets, no spaghetti | "Like the last time, make sure there are as less duplicate code as possible. And no spaghetti code." | Replaced seven near-identical query-parameter validation blocks with two small generic helpers (`parseOptionalInteger`, `parseOptionalEnum`) instead of a copy-pasted block per parameter. |
| Security + structure focus | "Now we will focus 2 things. First is cyber security and second is code redundant and structure... Let do Ticket Detail and attachment lifecycle." | Drove the magic-byte content-sniffing check, the `FOR UPDATE` row lock on the attachment-count race (verified with a real concurrency test, not just sequential calls), and centralizing 404-vs-403 ownership logic into one resolver reused by four endpoints instead of five separate implementations. |
| Apply the fix or push back | "This is our review [flagging the cross-package relative import]... if you have any reason, please let me acknowledge. If not then please fix it for me." | The critique was correct — the import worked only because that one file happened to be dependency-free, with nothing structurally preventing it from breaking the client build later. Fixed with a real npm workspace rather than defending the shortcut. |
| Make full frontend | "Make full frontend. The requirement is inside the lab2.pdf and complete the objectives." | Triggered an actual visual audit against the running app rather than trusting the code — found the app had been running on default Bootstrap blue the entire sprint (root CSS-variable overrides don't reach `.btn-*` classes, which bake in literal hex at Bootstrap's compile time) and that the badges had no background fill because of an invalid class name. Neither was caught by any automated test, since none of them assert on computed color. |
| Review a competing team's PR | "Can you give me this pull comment. In plain text first." (reviewing external PRs on request) | Reviewing other teams' PRs surfaced patterns to check for in this repo too — e.g. verifying our own ownership-status-code decision (403 vs 404) was applied consistently, and that seed data actually met the labsheet's literal minimums rather than approximate ones. |

## Reflection

The most valuable prompts were the ones that pushed past "does the code
look right" into "does the running app actually do this" — several real
bugs this sprint (the StrictMode race condition, the missing badge
background fill, the default-blue buttons, a flaky cross-file test race)
were only found by running the real dev servers, the real database, and
the real browser, not by reading the diff or trusting a green test suite.
None of those four bugs would have been caught by the automated tests
alone. The security-focused pass on attachments was also more thorough
for being asked explicitly — the concurrency test for the upload-limit
race, and the magic-byte check beyond extension/MIME, came from being
told to focus on that dimension specifically rather than from a generic
"implement this endpoint" prompt. Reviewer feedback from teammates (PR
#21's ARIA/duplication findings, and the later cross-package-import
critique) was treated as something to verify and act on, not rubber-stamp
— the import critique in particular was accepted and fixed with a real
architectural change (an npm workspace) rather than a superficial patch.
