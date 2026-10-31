# Lab 4 Reviewer Log

**Reviewer identity for this repository.** Jinnakan is the author. Peer review came from
**N0M3KM** on GitHub, who approved and merged the pull requests below. A second kind of
review came from Claude Code: a fresh read-only agent checked each implementation plan
against the real code before any code was written. That is AI-assisted review, kept
separate from the peer reviews in this document and labelled as such.

All feature pull requests below target `lab4-staging`. The release pull request into
`main` is listed in the last section of the table once it exists.

## Pull requests reviewed

| PR | Title | Branch | Reviewer | Outcome |
|---|---|---|---|---|
| [#58](https://github.com/Jinnakan/TokTickIT/pull/58) | Sprint 4 engineering contract | `feature/23-Sprint-4-engineering-contract` | N0M3KM | Approved, merged |
| [#59](https://github.com/Jinnakan/TokTickIT/pull/59) | Lab 3 carry-overs | `feature/24-Lab3-carry-overs` | none | Merged without a review (see the notes below) |
| [#60](https://github.com/Jinnakan/TokTickIT/pull/60) | Actions Taken foundation | `feature/25-Actions-Taken-foundation` | N0M3KM | Approved, merged |
| [#61](https://github.com/Jinnakan/TokTickIT/pull/61) | Actions Taken UI | `feature/26-Actions-Taken-UI` | N0M3KM | Approved, merged |
| [#62](https://github.com/Jinnakan/TokTickIT/pull/62) | Ticket workflow and resolution gate | `feature/27-Ticket-workflow-resolution-gate` | N0M3KM | Approved, merged |
| [#63](https://github.com/Jinnakan/TokTickIT/pull/63) | Role dashboards | `feature/28-Role-dashboards` | N0M3KM | Approved, merged |
| [#64](https://github.com/Jinnakan/TokTickIT/pull/64) | Final hardening | `feature/29-Final-hardening` | N0M3KM | Approved, merged |

The merge times are in `artifacts/lab-04/evidence/pr-timeline.txt`. The contract (#58) was
merged on 2026-10-31 at 10:21 UTC, before every implementation pull request: #60 at 10:45,
#61 at 12:01, #62 at 12:19, #63 at 12:41 and #64 at 13:54.

## Comments given and received, with responses

Every review on these pull requests is a short approval. No reviewer asked for a change.

| PR | Received from N0M3KM (verbatim) | Response from Jinnakan |
|---|---|---|
| #58 | "Lgtm! ready to merge" | "thank you" |
| #59 | no review, no comment | none |
| #60 | "lgtm ready to merge" | "thank you very much good sir" |
| #61 | "Look good to me" | "thank you" |
| #62 | "lgtm" | "Thank you for very supportive comment." |
| #63 | "Approve look great to me!!" | "Nice. Thank you very much." |
| #64 | "lgtm" | "Thank you" |

These approvals say little about the code, and I do not claim they found anything. The
defects that were found before merge came from the tests, the end-to-end specs and the
plan reviews described below.

## Notes on the process

- **PR #59 was merged without a review.** It was opened at 10:03:48 UTC on 2026-10-31,
  immediately after #58, and merged at 10:22:12, 33 seconds after #58. GitHub shows no review
  and no comment on it. The same carry-over code was covered by the tests in later pull
  requests, but it did not get a human review of its own.
- **The first attempt at the contract and the carry-overs was discarded on purpose.**
  PR [#54](https://github.com/Jinnakan/TokTickIT/pull/54) (contract, into `main`) and PR
  [#55](https://github.com/Jinnakan/TokTickIT/pull/55) (carry-overs, into `lab4-staging`) were
  approved by N0M3KM and merged on 2026-10-30. I then judged the plan too loose, reset both
  branches to the end of Lab 3 (`aa262af`), and redid the work. The two pages stay on GitHub but
  their commits are not in the current history of `main` or `lab4-staging`. The redone contract
  and carry-overs are #58 and #59.
- **Two pull requests were closed without merging.**
  [#56](https://github.com/Jinnakan/TokTickIT/pull/56) (feature 25 into `main`) targeted the wrong
  branch, and [#57](https://github.com/Jinnakan/TokTickIT/pull/57) (feature 25 into `lab4-staging`)
  conflicted with the discarded history. Feature 25 was opened again as #60.
- **N0M3KM also merged the pull requests.** GitHub shows `mergedBy` as N0M3KM for every pull
  request in the table.

## AI-assisted review of the plans (not peer review)

For features 25 to 30 a fresh read-only agent reviewed the written plan against the real code
before implementation started. These are catches that were acted on. Each can be seen in the
plan file named, or in the code it led to.

| Feature | What the plan review caught | Where the result shows |
|---|---|---|
| 25 Actions foundation | Tasks planned to run in parallel would have broken the "whole suite green" gate between batches, and a step ran the demo seed against the database the tests share, which would have changed test counts | Plan `2026-10-31-feature-25-actions-foundation.html`; the seed is only exercised in a throwaway schema in `migration.test.ts` |
| 26 Actions UI | A test looked for the label `Result` but the label reads `Result *` when the status is Completed, so it could never pass; the stale-update test never proved the retry used the new version | Plan `...feature-26-actions-ui.html` (`Result *`, `bumpOnConflict`); `client/tests/lab-04/ActionsTaken.test.tsx` |
| 27 Ticket workflow | The plan's client tasks needed feature 26's files, which were not yet on the branch; the stale-update alert would have stayed on screen after a successful Reload | Plan `...feature-27-ticket-workflow.html`; `ServiceActionsPanel.tsx` clears the alert on Reload |
| 28 Dashboards | Keeping the lists mounted but hidden would make end-to-end locators match invisible rows (confirmed later by three failing E2E specs); `getByRole('button', { name: 'My Tickets' })` would match two buttons once the dashboard existed | Plan `...feature-28-dashboards.html`; `e2e/lab-03/authentication.spec.ts` uses `exact: true`; lists now unmount and restore from a snapshot |
| 29 Hardening | `db-check.ts` uses raw SQL and would fail the static guard; the formatting script would have mangled an exported function; the import-rewrite script would have skipped `.tsx` files | `server/tests/lab-04/security.api.test.ts` allowlist; `DashboardParts.tsx` re-export; the client move script handles `.ts` and `.tsx` |
| 30 Release | The evidence script would not find `@prisma/client` from `scripts/`; the plan implied PRs #54 and #55 had never merged, when they merged and were then reset | `server/evidence/dashboard-vs-database.mts`; this document's notes above |

The reviews did not find everything. Three defects reached the code and were found by running
it: a refactor that moved the uploads folder (found from a count of staged files, then pinned by
`server/tests/lab-04/storage-root.unit.test.ts`), a header contrast failure, and a mobile queue
card that grew wider than the screen when a ticket carried the "Requester reports resolved"
badge (found by the width check in `e2e/capture/lab-04-screenshots.spec.ts`, fixed in
`StaffTicketQueue.tsx`).

One review agent also tried to write to GitHub by mistake: it ran `gh api` with a `-f` flag, which
sends a POST. GitHub rejected the request (422, no title), and I checked afterwards that no issue
had been created. From then on those agents were limited to read-only commands.

## Reviews given

I asked Claude Code to review a pull request from N0M3KM's own repository
(`N0M3KM/TokTickIT`, pull 48) while implementing feature 25. It was delivered to me as plain text
and nothing was posted on GitHub.
