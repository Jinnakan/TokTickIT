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

- The active item is shown with an underline plus `aria-current="page"`,
  not by color alone.
- Items come from the role-navigation factory.
- One piece of app state decides what is on screen: the current view, the
  filters to apply, and the open Ticket. A dashboard card or row therefore
  opens a filtered list or a Ticket Detail directly, and Back returns to the
  place it came from. The Ticket Queue no longer keeps its own open-Ticket
  state.
- Cleanup carried into this sprint: remove any placeholder, duplicate
  heading, or unreachable component left from earlier labs (for example the
  health-check panel if nothing reaches it).

## 2. Requester Dashboard

Purpose: show the Requester what needs attention and link into My Tickets.

- **Header:** "Welcome, {first name}" and a Refresh button (secondary).
- **Cards (4):** Open tickets, In progress, Waiting for you, Resolved. Each card
  is one link holding the label, a large count, and "View all". The whole card
  is the click target.
- **Recently updated:** up to 5 rows (ticket number, summary, status badge,
  updated time); each row opens Ticket Detail. A "View all" link opens My Tickets.
- **Recently resolved:** up to 5 rows of the same shape, with the resolved time.
- **Quick actions:** Create Ticket and View My Tickets buttons.

Cards sit 4 across on desktop, 2 by 2 on tablet, one column on mobile. The two
lists sit side by side on desktop and stack below tablet width.

## 3. IT Staff Dashboard (Administrator reuses it)

- **Cards:** Unassigned, Owned by me, Reported resolved by Requester, My open
  actions. The first three are links; "My open actions" is not, and points down
  to its list.
- **By status:** all 8 statuses with counts, each row a link into the queue,
  shown with the existing status badge so the text carries the meaning.
- **By IT Priority:** High, Medium, Low with counts, each a link.
- **My open actions:** up to 5 rows (ticket number, first 80 characters of the
  description, action status badge, planned time); each opens that Ticket Detail.
- **Recently updated:** up to 5 active Tickets (number, summary, status, owner,
  time); rows open Ticket Detail.
- **Administrator only:** a Users strip with active, inactive, and a count per
  role, linking to User Management.

Cards sit 4 across on desktop, 2 by 2 on tablet, one or two columns on mobile;
the list sections stack in the same order everywhere.

### Dashboard feedback states

| State | Behavior |
|---|---|
| Loading | Skeleton cards or "Loading dashboard..." with `role="status"`; the layout does not jump when data arrives |
| Zero metric | The count shows `0`; the card still renders and stays a link |
| Empty list | A muted message: "No recent tickets yet." / "Nothing planned for you." |
| Forbidden | The route is not offered; a direct call shows "You do not have access to this page." |
| Safe failure | Alert "Unable to load the dashboard." with a Retry button, no technical detail |
| Refresh | The button disables while loading; the result is announced politely |

A drill-down opens the target list with the filter already applied, shows the
active filter, and offers the existing Clear Filters control.

## 4. Actions Taken on Ticket Detail

Placed on IT Staff Ticket Detail between Service Actions and Comments, and on
the Requester Ticket Detail as a read-only list.

### 4.1 List

- Each Action is a card: status badge (Planned, In Progress, Completed,
  Cancelled), action date and time, description, result, "Performed by {name}",
  "Assigned to {name}", the follow-up line, attachment notes.
- Follow-up line, written as text: "Follow-up needed: {note}" with "Open" or
  "Done {date}".
- Oldest first (stable), with a count in the heading, "Actions Taken (3)".
- Empty: "No actions recorded yet." IT Staff still see Add action.

### 4.2 Create and edit modes (IT Staff and Administrator)

One form serves both, opened inline below the list ("Add action") or in place
of a card ("Edit"):

| Field | Control | Rule shown to the user |
|---|---|---|
| Description | textarea, required | up to 2000 characters with a remaining count |
| Status | select | Planned, In Progress, or Completed on create; only allowed moves on edit |
| Result | textarea | required once status is Completed |
| Action date and time | datetime input | defaults to now |
| Assigned to | select from the backend list | defaults to the current user |
| Follow-up required | checkbox | |
| Follow-up note | textarea | appears and is required when the checkbox is checked |
| Attachment notes | text input | helper text: "Which file to look at" |

- Read-only values (Performed by, created time) use the muted read-only style,
  not an input.
- Card buttons: **Start** (Planned to In Progress), **Complete** (opens the
  Result field), **Cancel action** (asks to confirm), and **Mark follow-up done**.
  Only the buttons for allowed moves appear.
- Validation messages sit under the field, tied with `aria-describedby`; invalid
  fields set `aria-invalid`; focus moves to the first invalid field.
- Save disables while the request is pending and shows "Saving...". A repeat
  click sends nothing, and one `requestId` is generated each time the form
  opens, so a retry cannot duplicate.
- A recoverable failure (network, or a 409 stale update) keeps every entered
  value and shows the message above the form.
- A Cancelled Action shows no Edit. A Completed one shows Edit with only the
  follow-up and attachment-note fields enabled, the rest in read-only style.

### 4.3 Requester view

The same cards with no Add, Edit, buttons, or assignee selector. Internal Notes
stay invisible, as in Lab 3.

### 4.4 Feedback states

| State | Behavior |
|---|---|
| Loading | "Loading actions..." status line |
| Empty | "No actions recorded yet." |
| Validation | field-level messages |
| Success | the new or updated card appears and is announced ("Action saved") |
| Forbidden | the form is never rendered for Requesters; a direct refusal shows "You cannot change actions on this ticket." |
| Conflict (409 stale) | "This action was changed by someone else. Reload to see the latest." with a Reload button, entered values kept |
| Locked ticket | Add is replaced by "This ticket is closed, so actions can no longer be changed." |
| Safe failure | "Unable to save the action. Your text is still here." |

## 5. Ticket Workflow Controls

- The status control lists only the permitted next statuses (the backend's
  `allowedStatuses`).
- When `resolution.canResolve` is false, Resolved is still listed and a blocker
  panel sits beside the control as plain text, one line per blocker: "Add a
  completed action", "2 actions are still planned or in progress", "1
  follow-up is still open". Choosing Resolved anyway shows the same lines from
  the 409 response.
- Cancel asks for confirmation (an inline alert dialog) that says remaining
  planned and in-progress actions will be cancelled.
- A stale update shows "This ticket changed since you opened it." with a Reload
  button; nothing is overwritten silently.
- A success refreshes the Ticket summary, the status control, the Actions list,
  and the history through the existing refresh point.
- **History:** a collapsed "History" list on Ticket Detail, oldest first: from,
  to, who, when. Read only.
- **Requester indication:** on the Requester's own Ticket in an allowed status,
  a "Problem appears resolved" button; once used it is replaced by "You told us
  this appears resolved on {date}." and the status is unchanged. IT Staff see a
  "Requester reports resolved" badge in the Ticket Detail header, the queue
  row, and the dashboard card.

## 6. Carry-over Changes

- **Reassign:** a select of assignable users beside the owner and a Reassign
  button, shown only to IT Staff and Administrators.
- **User edit:** Email becomes an editable field (it was read-only).
- **Specific messages:** duplicate email, "You cannot deactivate your own
  account.", "At least one active Administrator must remain.", stale update,
  and blocked resolution each use their own message instead of "Request failed."
- **Attachments:** IT Staff and Administrators see the list and Download only;
  Add attachment and Remove appear for the owning Requester only.

## 7. Badges (additions)

| Badge | Values | Rule |
|---|---|---|
| Action status | Planned, In Progress, Completed, Cancelled | text label always shown; four distinct fills, Cancelled struck through |
| Requester reports resolved | one badge | outlined pale green with text, never color alone |

Ticket status and priority badges are unchanged.

## 8. Accessibility and Responsive Requirements

- Every interactive element is reachable by keyboard in a logical order and
  shows a visible focus ring from the existing tokens.
- A card that is a link has one accessible name containing the label and the
  count ("Unassigned, 7 tickets").
- Status, priority, follow-up state, and the active page are conveyed by text or
  an `aria` attribute as well as by color.
- Dialogs are inline `role="alertdialog"` blocks with focus moved to the safe
  action and Escape to cancel; no overlay can trap focus.
- Dynamic results (save, refresh, errors) are announced through `role="status"`
  or `role="alert"`.
- No horizontal page scroll, clipped label, or overlapping control at 1280, 768,
  or 390px. Tables become cards below tablet width, as in Lab 3.
- No console errors, broken links, or placeholder text on any screen.

## 9. Visual and Accessibility Checklist (completed in the hardening Issue)

- [ ] Role navigation shows the right items and the active page is clear
- [ ] Requester Dashboard: cards, lists, empty and zero states, three widths
- [ ] Staff Dashboard: cards, breakdowns, my actions, Administrator user strip
- [ ] Every dashboard count opens a list with the same number of rows
- [ ] Actions Taken: list, create, edit, locked, and read-only (Requester) modes
- [ ] Validation messages sit under their fields; focus lands on the first error
- [ ] A failed save keeps typed text; repeated Save clicks send one request
- [ ] The workflow control shows only permitted transitions and readable blockers
- [ ] All four Action badges and all 8 status badges stay legible and distinct
- [ ] Read-only and editable fields look different
- [ ] Keyboard-only walk-through of each new screen, focus ring always visible
- [ ] No clipped text, overlap, or horizontal scroll at three widths
- [ ] Loading, empty, forbidden, conflict, and failure states exist on each new screen
- [ ] No console errors, placeholders, or obsolete elements left from Labs 1 to 3

## 10. Screenshot Paths

- `artifacts/lab-04/screenshots/staff-dashboard/`: loaded, zero, drill-down
  result, Administrator view, failure, at three widths
- `artifacts/lab-04/screenshots/requester-dashboard/`: loaded, zero, drill-down
  result, failure, at three widths
- `artifacts/lab-04/screenshots/actions-taken/`: list with several actions,
  create, edit, validation, inactive assignee rejected, conflict, locked,
  Requester read-only, resolution blocked, at three widths
