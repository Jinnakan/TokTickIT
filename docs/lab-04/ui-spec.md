# Lab 4 UI Specification: Zen Green Theme (extends Labs 2 and 3)

Tokens, field states, buttons, badges, cards, tables, spacing, and breakpoints
from `docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md` remain in force.
This document adds only what Lab 4 needs and removes what Lab 4 makes
obsolete. Desktop is 1280px, tablet 768px, mobile 390px.

## 1. Application Shell and Navigation

| Role | Nav items (in order) | Landing page |
|---|---|---|
| Requester | Dashboard, My Tickets, Create Ticket | Dashboard |
| IT Staff | Dashboard, Ticket Queue | Dashboard |
| Administrator | Dashboard, Ticket Queue, User Management | Dashboard |

- The active nav item is shown with an underline plus `aria-current="page"`,
  not by color alone.
- The nav list stays generated from the role-navigation factory.
- Cleanup carried into this sprint: remove any leftover Lab 2 or Lab 3
  placeholder, duplicate heading, or unreachable component (for example the
  health-check panel if it is no longer reachable).

## 2. Requester Dashboard

Purpose: show the Requester what needs attention and link into My Tickets.

- **Header:** "Welcome, {first name}" and a Refresh button (secondary).
- **Cards (4):** Open tickets, In progress, Waiting for you, Resolved. Each
  card is one link containing the label, a large count, and a "View all"
  text. The whole card is the click target.
- **Recently updated:** up to 5 rows: ticket number, summary, status badge,
  updated time; each row opens Ticket Detail. A "View all" link opens My Tickets.
- **Recently resolved:** up to 5 rows, same shape, with the resolved time.
- **Quick actions:** Create Ticket and View My Tickets buttons.

Layout: cards 4 across at desktop, 2 by 2 at tablet, 1 column at mobile. Lists
sit in two columns at desktop, stacked below tablet width.

## 3. IT Staff Dashboard (Administrator reuses it)

- **Cards:** Unassigned, Owned by me, Reported resolved by Requester, My
  planned actions. The first three are links; "My planned actions" is not a
  link and instead points down to its list.
- **By status:** a compact list of all 8 statuses with counts, each row a link
  into the queue, using the existing status badge so the label carries
  meaning, not color.
- **By IT Priority:** three rows (High, Medium, Low) with counts, each a link.
- **My planned actions:** up to 5 rows: ticket number, first 80 characters of
  the description, planned time; each opens that Ticket Detail.
- **Recently updated:** up to 5 active Tickets: number, summary, status, owner,
  time; rows open Ticket Detail.
- **Administrator only:** a "Users" strip: active, inactive, and a count per
  role, with a link to User Management.

Layout: cards 4 across, then two columns of lists at desktop; 2 by 2 at
tablet; single column at mobile with cards 1 or 2 per row.

### Dashboard feedback states

| State | Behavior |
|---|---|
| Loading | Skeleton cards or "Loading dashboard..." text with `role="status"`; layout does not jump when data arrives |
| Zero metric | Count shows `0`; the card still renders and stays a link |
| Empty list | Muted message in the list: "No recent tickets yet." / "Nothing planned for you." |
| Forbidden | The dashboard route is not offered; a direct call shows "You do not have access to this page." |
| Safe failure | Alert: "Unable to load the dashboard." with a Retry button; no technical detail |
| Refresh | Button disables while loading; the result is announced politely through a live region |

Drill-down opens the target list with the filter already applied and shows the
active filter, with Clear Filters available (the existing control).

## 4. Actions Taken on Ticket Detail

Placed on IT Staff Ticket Detail between Service Actions and Comments, and on
the Requester Ticket Detail as a read-only list.

### 4.1 List

- Each Action is a card: status badge (Planned, Completed, Cancelled), action
  date and time, description, result, "Performed by {name}", "Assigned to
  {name}", follow-up line, attachment notes.
- Follow-up line: "Follow-up needed: {note}" with an "Open" or "Done {date}"
  indicator, written as text.
- Ordered oldest first (stable), with a count in the heading, "Actions Taken (3)".
- Empty: "No actions recorded yet." For IT Staff the Add action button remains visible.

### 4.2 Create and edit modes (IT Staff and Administrator)

One form used for both modes, opened inline below the list ("Add action") or
in place of a card ("Edit"):

| Field | Control | Rule shown to the user |
|---|---|---|
| Description | textarea, required | up to 2000 characters, with remaining count |
| Status | select | Planned or Completed on create; allowed moves only on edit |
| Result | textarea | required once status is Completed |
| Action date and time | datetime input | defaults to now |
| Assigned to | select from the assignable list | defaults to the current user |
| Follow-up required | checkbox | |
| Follow-up note | textarea | appears and is required when the checkbox is checked |
| Attachment notes | text input | "Which file to look at" helper text |

- Read-only fields (Performed by, created time) show in the muted
  read-only style, not as inputs.
- Validation messages sit under the field, tied with `aria-describedby`;
  invalid fields set `aria-invalid`; focus moves to the first invalid field.
- Save disables while the request is pending and shows "Saving...". A repeat
  click sends nothing; the client also sends one `requestId` per form open so
  a retry cannot duplicate.
- A recoverable failure (network error, 409 stale update) keeps every entered
  value in the form and shows the message above the form.
- A cancelled Action renders read-only with no Edit button; a completed one
  shows Edit with only the follow-up and attachment-note fields enabled and
  the rest in read-only style.
- Mark follow-up done is a button on the card, not a form field.

### 4.3 Requester view

Same cards, no Add or Edit controls and no Assigned-to selector. Internal
Notes remain invisible (unchanged from Lab 3).

### 4.4 Feedback states

| State | Behavior |
|---|---|
| Loading | "Loading actions..." status line |
| Empty | "No actions recorded yet." |
| Validation | field-level messages as above |
| Success | the new or updated card appears and is announced ("Action saved") |
| Forbidden | the form is not rendered for Requesters; a direct API refusal shows "You cannot change actions on this ticket." |
| Conflict (409 stale) | "This action was changed by someone else. Reload to see the latest." with a Reload button, form values kept |
| Locked ticket | the Add button is replaced by "This ticket is closed, so actions can no longer be changed." |
| Safe failure | "Unable to save the action. Your text is still here." |

## 5. Ticket Workflow Controls

- The status control lists only the permitted next statuses from the
  backend's `allowedStatuses`.
- When `resolution.canResolve` is false, Resolved is still listed but the
  control shows a blocker panel next to it, as plain text, one line per
  blocker: "Add a completed action", "2 planned actions are still open",
  "1 follow-up is still open". Choosing Resolved anyway shows the same
  messages from the 409 response.
- Cancel asks for confirmation (inline alert dialog) that says remaining
  planned actions will be cancelled.
- A stale update shows "This ticket changed since you opened it." with a
  Reload button; nothing is silently overwritten.
- A success refreshes the Ticket summary, the status control, the Actions
  list, and the status history through the existing refresh point.
- **Status history** is a collapsed "History" list on Ticket Detail, newest
  last: from, to, who, when. Read only. Legacy rows read "Status recorded as {status}".
- **Requester indication:** on the Requester's own Ticket in an allowed status,
  a "Problem appears resolved" button; once used it becomes the text
  "You told us this appears resolved on {date}." and the Ticket status is
  unchanged. IT Staff see a "Requester reports resolved" badge in the Ticket
  Detail header, the queue row, and the dashboard card.

## 6. Carry-over Changes

- **Reassign:** a select of assignable users beside the owner, with a
  Reassign button, shown only to IT Staff and Administrators.
- **User edit:** Email becomes an editable field (it was read-only).
- **Specific messages:** duplicate email, "You cannot deactivate your own
  account.", "At least one active Administrator must remain.", stale update,
  and blocked resolution each use their own message instead of "Request failed."
- **Attachments:** IT Staff and Administrators see the list and Download only;
  Add attachment and Remove appear for the owning Requester only.

## 7. Badges (additions)

| Badge | Values | Rule |
|---|---|---|
| Action status | Planned, Completed, Cancelled | text label always shown; Planned uses the pale neutral fill, Completed the pale green fill, Cancelled neutral with strikethrough |
| Requester reports resolved | single badge | outlined pale green with text; never color-only |

Ticket status and priority badges are unchanged.

## 8. Accessibility and Responsive Requirements

- Every interactive element is reachable by keyboard in a logical order and
  shows a visible focus ring from the existing tokens.
- Cards that are links expose a single accessible name that includes the
  label and the count ("Unassigned, 7 tickets").
- Status, priority, follow-up state, and active page are conveyed by text or
  an `aria` attribute as well as by color.
- Dialogs are inline `role="alertdialog"` blocks with focus moved to the
  safe action and Escape to cancel; there are no pop-up overlays that can trap focus.
- Dynamic results (save, refresh, errors) are announced through
  `role="status"` or `role="alert"`.
- No horizontal page scroll, clipped label, or overlapping control at 1280,
  768, or 390px. Tables become cards below tablet width, as in Lab 3.
- No console errors, broken links, or placeholder text on any screen.

## 9. Visual and Accessibility Checklist (completed in Issue 29)

- [ ] Role navigation shows the right items and the active page is clear
- [ ] Requester Dashboard: cards, lists, empty and zero states, desktop/tablet/mobile
- [ ] Staff Dashboard: cards, breakdowns, my actions, Administrator user strip
- [ ] Every dashboard count opens a list with the same number of rows
- [ ] Actions Taken: list, create, edit, locked, read-only (Requester) modes
- [ ] Validation messages sit under their fields; focus lands on the first error
- [ ] Failed save keeps typed text; repeated Save clicks send one request
- [ ] Workflow control shows only permitted transitions and readable blockers
- [ ] Planned, Completed, Cancelled, and all 8 status badges stay legible and distinct
- [ ] Read-only versus editable fields are visibly different
- [ ] Keyboard-only walk-through of each new screen, focus ring always visible
- [ ] No clipped text, overlap, or horizontal scroll at three widths
- [ ] Loading, empty, forbidden, conflict, and failure states visible on each new screen
- [ ] No console errors, placeholders, or obsolete elements left from Labs 1 to 3

## 10. Screenshot Paths

- `artifacts/lab-04/screenshots/staff-dashboard/`: loaded, zero/empty,
  drill-down result, Administrator view, failure, desktop/tablet/mobile
- `artifacts/lab-04/screenshots/requester-dashboard/`: loaded, zero/empty,
  drill-down result, failure, desktop/tablet/mobile
- `artifacts/lab-04/screenshots/actions-taken/`: list with several actions,
  create, edit, validation, inactive assignee rejected, conflict, locked,
  Requester read-only, resolution blocked, desktop/tablet/mobile
