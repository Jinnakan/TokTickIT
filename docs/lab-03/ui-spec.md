# Lab 3 UI Specification — Zen Green Theme (extends Lab 2)

Reuses every token, field-state rule, button rule, and responsive rule from
`docs/lab-02/ui-spec.md` §1–4 and §7–9 unchanged. This document covers only
what Lab 3 adds or changes: new screens, the role-aware shell, and two new
badge/status sets.

## 1. Application Shell Changes

- Replaces "current Requester name + Change Requester" with "current user
  name (role) + Logout".
- Nav items are role-specific, produced by `RoleNavigationFactory`:
  - Requester: My Tickets, Create Ticket (unchanged from Lab 2)
  - IT Staff: Ticket Queue
  - Administrator: User Management
- If `mustChangePassword` is true for the logged-in user, every route
  except Change Password redirects there; the nav still renders (so the
  user isn't confused about who they are) but its links are inert until
  the password is changed.

## 2. Login

Replaces Lab 2's Development Requester Selection screen at the same
entry point.

1. TokTickIT title
2. Email field, Password field (masked, with a show/hide toggle)
3. Login (primary) button, busy state per Lab 2 §4
4. Inline error region directly below the form (not a top banner) showing
   the generic invalid-credentials message (spec §11 AC-L3-02) or the
   lockout message, never which part was wrong
5. No "forgot password" link — email-based reset is out of scope (§3)

States: **Submitting** (busy button, form disabled), **Invalid credentials**
(inline error, password field cleared, email retained), **Locked out**
(inline error naming that attempts are temporarily blocked, no retry timer
countdown required), **API failure** (safe error message + Retry).

## 3. Change Password

Reached automatically when `mustChangePassword` is true; also reachable
voluntarily from the user menu.

1. One sentence explaining a password change is required before
   continuing (only shown in the mandatory case)
2. Current Password, New Password, Confirm New Password fields
3. Cancel (secondary, only present in the voluntary case — the mandatory
   case has no way to skip) / Save (primary)
4. Field-level validation (mismatch between New/Confirm, complexity rule)
   per the Lab 2 field-state rules

On success: redirect to the screen appropriate to the user's role.

## 4. Requester Screens

Create Ticket, My Tickets, and Ticket Detail carry over from
`docs/lab-02/ui-spec.md` §5.3–5.5 unchanged, with one addition:

### 4.1 Ticket Detail — Public Comments panel (new)

- Added below the Attachments section, clearly separated by a heading
  ("Comments").
- List of existing comments (author name, timestamp, body as plain text),
  oldest first.
- A single-line-growing textarea + Post button at the bottom of the list.
- Empty state: "No comments yet." — not the same empty-state graphic used
  for My Tickets (per the Lab 2 convention of distinct empty states).
- No edit/delete control on any comment (append-only, BR-L3-16).

## 5. IT Staff Ticket Queue

New screen, reachable only to `IT_STAFF`/`ADMINISTRATOR`.

- Header row: page title, "Clear Filters" (tertiary).
- Filter row: search input, Category / Requested Priority / IT Priority /
  Current Status / Assigned To selects, an "Unassigned only" toggle — all
  optional, matching the minimal-filter posture of Lab 2's My Tickets, not
  over-built (temp.md gotcha #10 applies to Users, but the same restraint
  applies here: filters exist because the queue needs them to be usable at
  scale, not decoratively).
- **Desktop (≥992px)**: table — Ticket No., Requester, Summary, Category,
  Requested Priority, IT Priority, Current Status, Assigned To, Last
  Updated. Sortable columns per Lab 2's convention.
- **Tablet (768–991px)**: condensed columns (Ticket No., Summary, IT
  Priority, Current Status, Assigned To), no page-level horizontal scroll.
- **Mobile (<768px)**: one card per Ticket (Ticket No. + Summary as title,
  IT Priority/Current Status as badges, Assigned To + Requester as meta
  text).
- Row/card click opens IT Staff Ticket Detail.
- Loading/empty/no-results/failure states follow the same rules as Lab
  2's My Tickets §5.4.

## 6. IT Staff Ticket Detail

New screen. Reference: labsheet Figure 1 in full (Lab 2's Requester Ticket
Detail deliberately omitted Public Comments/Internal Notes/Service
Actions/status controls — this screen is where those become real).

Layout order:

1. **Breadcrumb**: "Ticket Queue > Ticket Detail".
2. **Read-only Requester-submitted fields**: same field grid as Lab 2's
   Requester Ticket Detail (Ticket No., Ticket Date, Category, Related
   System, Requester, Requested Priority, Summary, Description).
3. **Service Actions** group (this is the Lab 2 mockup's "Service Actions"
   tab — not new scope, just where existing controls live visually, per
   temp.md gotcha #2): Claim/Reassign control, IT Priority select, Current
   Status control showing only the transitions valid from the current
   state (per `api-spec.md` §4's transition table — an invalid option is
   never shown as selectable, not just rejected server-side).
4. **Attachments section**: identical to Lab 2's, Requester's attachments
   remain visible/downloadable, IT Staff cannot remove a Requester's
   attachment (removal stays a Requester-only action, unchanged from Lab
   2).
5. **Public Comments panel**: identical layout to §4.1 above, IT Staff can
   also post.
6. **Internal Notes panel**: visually distinct background
   (`--color-pale-green` tinted differently, with a persistent "Internal
   Staff Notes — not visible to the Requester" label) so an IT Staff member
   can never mistake which panel a Requester will see. Same post-only,
   no-edit-no-delete behavior as Comments.

States: claim/reassign/priority/status controls each show the busy state
from Lab 2 §4 while their request is in flight; a failed status transition
shows an inline error naming the rejection reason without discarding any
other in-progress edit on the page.

## 7. Administrator User Management

New screen, reachable only to `ADMINISTRATOR`.

- Header row: page title, "Create User" (primary).
- Filter row: search input, Role select, Active/Inactive select — no
  mandatory pagination/multi-sort/multi-filter (§3 exclusion, temp.md
  gotcha #10 — kept intentionally minimal).
- List (table on desktop, cards on mobile/tablet per the same breakpoint
  rule as My Tickets/Ticket Queue): Name, Email, Role (badge), Active
  status (badge), Actions (Edit, Reset Password, Activate/Deactivate).
- **Create User form**: Name, Email, Role select. The mockup's "Send
  password reset email" checkbox is **not implemented** — email delivery
  is out of scope (§3, temp.md gotcha #1). Instead: on success, a
  confirmation panel shows the generated initial password once, with a
  visible warning that it will not be shown again.
- **Edit User form**: Name, Role, Active toggle — no password field (use
  Reset Password instead).
- **Reset Password** action: confirmation dialog, then the same
  once-only password display as Create User.
- **Deactivate** action: confirmation dialog explaining this immediately
  ends that user's active sessions (BR-L3-18), matching the destructive
  Button rule from Lab 2 §4.
- Loading/empty/no-results/failure states follow the same rules as Lab
  2's My Tickets §5.4.

## 8. Badges (additions to Lab 2 §8)

Current Status grows from the Lab 2 single-value badge to the full set:

| Status | Style |
|---|---|
| NEW | Pale green background, `--color-secondary` text (unchanged from Lab 2) |
| OPEN | `--color-secondary` background tint, white text |
| IN_PROGRESS | Amber background, dark amber text |
| WAITING_FOR_REQUESTER | Light gray-blue background, dark blue-gray text |
| RESOLVED | `--color-pale-green` background, `--color-primary` text |
| CLOSED | Neutral gray background, dark gray text |
| REOPENED | Light red background, `--color-error` text |
| CANCELLED | Neutral gray background, struck-through text style |

IT Priority reuses the exact Priority badge styles from Lab 2 §8
(LOW/MEDIUM/HIGH) — same visual language, different field.

Role badges (User Management, Ticket Queue's Requester/Assigned columns):

| Role | Style |
|---|---|
| REQUESTER | Neutral gray background |
| IT_STAFF | `--color-secondary` background tint |
| ADMINISTRATOR | `--color-primary` background tint, white text |

## 9. Visual Checklist (used for §9 grading item — Zen Green + Responsive)

- [ ] No clipped labels at any breakpoint, on every new screen (Login,
  Change Password, Ticket Queue, IT Staff Ticket Detail, User Management)
- [ ] No overlapping controls/messages at any breakpoint
- [ ] No unintended horizontal scroll at any breakpoint
- [ ] Internal Notes panel is visually distinguishable from Public
  Comments at a glance, not just by a label
- [ ] Status badges (8 values) remain legible and distinct from one
  another, not just distinct from the 3-value Priority badges
- [ ] Button hierarchy consistent with Lab 2's established styles across
  every new screen
- [ ] Loading/empty/no-results/failure states each visually distinct, on
  every new screen

Verified against the running app per-issue (Issues 15/16/18/19/20), not
backfilled at the end — see `tests.md` §4 for the same checklist with
notes on when each screen was verified.

## 10. Screenshot Paths (for submission evidence)

- `artifacts/lab-03/screenshots/authentication/` — login, invalid-credentials,
  locked-out, change-password, desktop/tablet/mobile
- `artifacts/lab-03/screenshots/staff-queue/` — loaded, filtered, empty,
  no-results, failure, desktop/tablet/mobile
- `artifacts/lab-03/screenshots/staff-ticket-detail/` — loaded, claimed,
  status-transition, internal-notes-visible, comments, desktop/tablet/mobile
- `artifacts/lab-03/screenshots/user-management/` — list, create-success
  (password shown), edit, deactivated, desktop/tablet/mobile
