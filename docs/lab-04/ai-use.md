# AI Use and Reflection: Lab 4

I used Claude Code (Claude Sonnet 5.5) as the coding assistant for all eight Issues of this
sprint, from the engineering contract to release readiness. The pattern stayed the same as
Lab 3: a "plan" turn first (process and testing, no code touched), then a separate "Ready for
feature N" turn that implemented, tested and staged the work. I read each staged diff and
committed it myself. Pushes, pull requests, merges, branch creation, closing Issues and the
Kanban board stayed with me. From feature 25 onward each plan was an HTML document that a
second, read-only agent checked against the real code before I approved it.

## Work completed by branch

| Branch | AI-assisted work completed |
| --- | --- |
| `feature/23-Sprint-4-engineering-contract` | Drafted `specification.md`, `api-spec.md`, `ui-spec.md` and `tests.md` for Lab 4, with the FR, BR and AC numbering that every later Issue and test points back to. |
| `feature/24-Lab3-carry-overs` | Closed the Lab 3 gaps: the reassign selector, the Requester "Problem appears resolved" button, editable email on user edit, specific error messages, and no attachment controls for IT Staff. During this Issue the server suite started failing about 4 runs in 30. The assistant bisected it and found the cause was random-port collisions with other apps on my machine, not the code. The fix was binding the test server to 127.0.0.1. Its first two theories (the refactor, Node 24) were wrong, and the A/B run on the Lab 3 code showed the same failure rate before any Lab 4 change. |
| `feature/25-Actions-Taken-foundation` | Added the Action model and migration, the Actions API (create, edit, start, complete, cancel, history) with a version column and a row lock for concurrent edits, and the server rules for assignee and result. |
| `feature/26-Actions-Taken-UI` | Built the Actions Taken panel on the Ticket detail page: list, add and edit form, validation, the confirm step for cancelling, and the stale-update message with Reload. |
| `feature/27-Ticket-workflow-resolution-gate` | Added the resolution gate as a pure function (a Ticket cannot be Resolved while an Action is open or has no result), the Requester "Problem Appears Resolved" report, and the status options that follow from the gate. |
| `feature/28-Role-dashboards` | Built the Staff and Requester dashboards with a Strategy per metric, clickable cards that open the matching list, and list snapshots so going back restores the filter and scroll. |
| `feature/29-Final-hardening` | Moved the server and client code into feature folders, unified the error responses, added startup configuration checks, and wrote the security and error-contract tests. The move silently changed the uploads folder; I caught it from an unexpectedly large staged-file count (264 files), and a test now pins the path. |
| `feature/30-Release-readiness-lab4` | This file, `reviewer.md`, the release gate script (`npm run verify:release`), a Playwright capture spec that produced 94 screenshots at three widths, evidence scripts that compare dashboard numbers with database counts, and the README update. The capture run found a real defect: a mobile queue card overflowed the screen when it carried the "Requester reports resolved" badge. |

## Selected key prompts

| # | Prompt name | Actual prompt text | Result and reflection |
| --- | --- | --- | --- |
| 1 | Start from the sheet | "New lab. Can you help me with this?" (with the Lab 4 sheet attached) | A short prompt on purpose: the sheet was the source of truth. The assistant produced the issue list, branch names and feature split from it, and I then asked for the Issue text separately so each Issue had its own objective and required files. |
| 2 | Throw the first attempt away | "Let do this again from lab 3 again. Reverse the branch to finished lab 3 and plan lab 4 again. This time, take your time, understand the code and what to interact with them." | My first plan was written before the assistant had read the Lab 3 code, and it showed in the details. Restarting from the finished Lab 3 commit cost a day and a history reset on GitHub, but the second plan named real files and real functions to extend. This is the prompt that changed the quality of everything after it. |
| 3 | Ask for a judgement, not an action | "What is your read? Fix it here now to make sure no issue later or finish the work then dubug." | The suite had started failing at random. Asking for a recommendation made the assistant explain the risk of each path first, and it advised fixing the flake before more features were built on top of it. |
| 4 | Authorize an experiment | "go ahead and bisect it", then "go ahead and run it on Lab 3", then "Fix the flake now, then commit" | Three short approvals, each for a defined step. The A/B on the old Lab 3 code is what showed the failure was environmental and not caused by my refactor. Without it I would have spent the sprint hunting a bug that was not there. |
| 5 | Plan, then implement | "Plan feature 25 now." followed by "Ready for feature 25" | The two-turn pattern for every Issue. From here the plan was an HTML file reviewed by a separate agent, which caught problems such as a test looking for the label `Result` when the field is labelled `Result *`. |
| 6 | Ask why when GitHub looks wrong | "Why is this happen. I though we just go back to finish sprint 3. I shouldn't effect main right?" | After I pushed feature 25 the pull request showed conflicts. The assistant read the remote state and found my first-attempt pull requests had already merged into `main` and `lab4-staging`, so resetting my local branches had not reset GitHub. Resetting the remote branches and recreating features 26 to 29 from `lab4-staging` fixed it. The assistant only read GitHub; I made every change there. |
| 7 | Plan beyond the sheet | "I pushed it. Lets plan the final hardening. Since I am not sure what is the next sprint is about. It would be nice to make our code scalable and flexable." | The sheet does not ask for refactoring, so this was my choice. It produced feature 29: feature folders, shared ID parsing and guards, one error format, and tests that fail if someone adds raw SQL or a hard-coded uploads path. It was also the riskiest feature, which is where the uploads folder slip happened. |
| 8 | Keep a long run alive | "sorry. Please finish ten-run proof." | I had interrupted a command that was part of the ten-run repeat of the server suite. The assistant restarted the run from run 1 and left it alone until it finished with 0 failures in 10. I would give the same instruction again: do not break up a long proof half way. |

## My Reflection

**Specification-agent use.** In Lab 3 I found missing requirements only at the end. This time
the sheet was checked against `specification.md` in both directions during the contract Issue,
and every later Issue pointed back to numbered requirements, so `tests.md` ended with every
row passing and no unticked checklist boxes. The weak spot was the first plan. I let the
assistant plan before it had read the existing code, and the result looked complete while
being generic. Prompt 2 is the correction, and I should have asked for "read the code first"
in the first prompt of the sprint.

**Coding-agent use.** The review of each plan by a second agent caught real mistakes before
any code existed (listed in `reviewer.md`), and the E2E and capture runs caught the ones that
slipped through. The two mistakes that cost me most were not in the product code. One was the
flaky test server, where the assistant's first two explanations were wrong and only a
controlled A/B run gave a trustworthy answer. The other was the GitHub history: the work I
thought I had undone was still merged on the remote, and I only saw it when a pull request
conflicted. The staged-file count and the overflow check each caught a defect that a green
test suite did not. What I would change is the review side. Every peer approval I received was
one line long, and one pull request merged without any review, so the checks that protected
this sprint were the automated ones and the plan review by an agent, not a person reading the
diff.
