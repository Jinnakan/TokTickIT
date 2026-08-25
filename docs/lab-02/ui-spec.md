# Lab 2 UI Specification — Zen Green Theme

Applies to every screen in this sprint and is the reusable baseline later
sprints must extend rather than replace.

## 1. Color Tokens

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#006B3C` | App header, primary buttons, strong emphasis |
| `--color-secondary` | `#0B7A46` | Active tabs, focus accents, links, hover states |
| `--color-pale-green` | `#EAF6EF` | Selected/success backgrounds, subtle section emphasis |
| `--color-page-bg` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards/panels, subtle border + restrained shadow |
| `--color-text` | dark charcoal-green (`#1B2B24`) | Body text — never pure black |
| `--color-field-editable-bg` | `#FFFFFF` | Editable field background, neutral border |
| `--color-field-readonly-bg` | soft gray-green (`#EEF2F0`) | Read-only field background, visibly distinct from editable |
| `--color-error` | dark red (`#8A1F11`) | Error text/border |
| `--color-warning` | amber | Warning callout/badge only, never decorative |
| `--color-success` | `--color-secondary` on `--color-pale-green` | Success confirmation, paired with text, not color alone |

## 2. Typography & Spacing

- One base font stack across the app; headings use the same family as body text at heavier weight.
- Labels: 13–14px, medium weight, positioned directly above their control (never inline-right).
- Base spacing unit: 8px; form field vertical rhythm is 16px (2 units) between fields, 24px (3 units) between field groups.
- All interactive controls (inputs, selects, buttons) share one consistent height (40px) except multiline Description, which may grow but must not break the surrounding layout.

## 3. Field States

| State | Rule |
|---|---|
| Editable | White background, 1px neutral border, visible focus ring on keyboard focus |
| Read-only | `--color-field-readonly-bg` background, no focus ring, `aria-readonly="true"` |
| Required | Red asterisk directly after the label text; the asterisk is a visual cue only — it never replaces a validation message |
| Invalid | Red border + red message directly below the specific field (never a single banner at the top only) |
| Disabled | Reduced-opacity styling, `cursor: not-allowed`, `aria-disabled="true"`; disabled controls are never clickable/focusable via Tab |
| Focused | A visible focus outline at all times for keyboard users — never suppressed with `outline: none` without a replacement |

## 4. Buttons

| Role | Style |
|---|---|
| Primary (Submit, Continue) | Solid `--color-primary` background, white text |
| Secondary (Cancel, Change Requester) | White background, `--color-primary` border/text |
| Tertiary (Clear Filters, text links) | No border/background, `--color-secondary` text |
| Destructive (Remove Attachment) | Red text/border, confirmation required before the action fires |
| Disabled | Same rule as disabled fields above |
| Busy | Spinner + unchanged label text (e.g. "Submitting…"), button disabled while busy, never relabeled to just an icon |

Every button shows visible text; an icon may accompany text but never
replaces it. Any icon-only control (e.g. a table-row overflow menu) must
carry an `aria-label` and a tooltip.

## 5. Screens

### 5.1 Application Shell

- Header: TokTickIT wordmark/icon (left), My Tickets / Create Ticket nav (center-left), current Requester name + "Change Requester" (right).
- Active nav item is visually distinct (underline + `--color-secondary` text) and marked `aria-current="page"`.
- Below 768px width, primary nav collapses into a menu; the current-Requester display and Change Requester action remain reachable without opening a submenu.

### 5.2 Development Requester Selection

Reference: labsheet Figure (§8.1). Required elements, top to bottom:

1. TokTickIT title
2. One sentence explaining this is a Lab 2 testing mechanism, not login
3. "Development Requester" labeled dropdown (required, no default selection)
4. Info callout: "Only active development requesters are shown."
5. Secondary callout: "Authentication coming in Lab 3."
6. Cancel (secondary) / Continue (primary) buttons — Continue disabled until a Requester is chosen

States:

- **Loading**: dropdown replaced by a skeleton/spinner while `GET /api/dev-requesters` is in flight.
- **Empty** (zero active Requesters): dropdown area replaced by a message explaining none are available; Continue stays disabled (AC-16).
- **API failure**: safe error message + a Retry button; no raw error text (AC-15).
- On Continue: selection is stored (see §6), the shell updates to show the Requester's name, and the user lands on My Tickets.
- Change Requester (from the shell) reopens this screen; choosing a different Requester reloads all Requester-scoped data.

### 5.3 Create Ticket

Layout order (desktop, single scroll, grouped sections):

1. **System-generated fields** (read-only styling, populated only after successful submit): Ticket Number, Ticket Date, Requester (the selected Requester's name).
2. **Classification group**: Category (select), Related System (select), Requested Priority (select — no default).
3. **Content group**: Ticket Summary (single-line, required, 150 char limit shown as a counter), Description (multiline, resizable vertically only, required).
4. **Attachments**: file picker, list of staged files with name/size, per-file remove-before-submit control, inline note of allowed types/size/count.
5. **Actions**: Cancel (secondary, returns to My Tickets) and Submit (primary).

Rules:

- Before submission, the system-generated fields are shown as empty/placeholder read-only fields ("Assigned after submission"), not hidden — the layout position doesn't jump on success.
- Validation messages appear beneath each field the moment it fails, and again as a summary is **not** required (per-field is sufficient — no single mystery top banner).
- Submit shows the busy state described in §4 and is disabled while the request(s) are in flight.
- On success: the read-only Ticket Number field populates with the real value, a success banner confirms creation, and a "View Ticket" / "Back to My Tickets" action appears. If any attachment failed (BR-21), the success banner is replaced by a partial-success variant naming the failed file(s) and linking to Ticket Detail to retry.
- On failure (validation or API): the form retains every value the user entered; nothing is cleared.

### 5.4 My Tickets

- Header row: page title, "Clear Filters" (tertiary) and "Create Ticket" (primary) actions.
- Filter row: search input (placeholder "Search by ticket number or summary…"), Category / Requested Priority / Current Status selects — all optional.
- **Desktop (≥992px)**: table with sortable columns (click header toggles `sortDir`, shows a sort-direction indicator) — Ticket No., Created Date, Summary, Category, Requested Priority, Current Status, Last Updated. Row click opens Ticket Detail.
- **Tablet (768–991px)**: same table with reduced column set (Ticket No., Summary, Requested Priority, Current Status) or horizontally-safe condensed columns — no page-level horizontal scroll.
- **Mobile (<768px)**: one card per Ticket (Ticket No. + Summary as the card title, Requested Priority/Current Status as badges, Created Date as meta text); tapping the card opens Ticket Detail.
- Pagination control below the list: Previous/Next + page numbers, current page visually distinct, matching the `meta` from the API.
- **Loading**: skeleton rows/cards while the request is in flight.
- **Empty** (Requester has zero Tickets ever): illustration/message + a prominent Create Ticket action.
- **No-results** (filters/search active, zero matches): distinct message ("No tickets match your filters") + a "Clear Filters" action — never the same empty-state graphic as a true empty list (AC-10).
- **Failure**: safe error message + Retry; previous page's data is not left on screen looking current (AC-18).

### 5.5 Requester Ticket Detail

Reference: labsheet Figure 1, minus Public Comments / Internal Notes /
Service Actions / Event Log / status controls (excluded from Lab 2 scope).

- Breadcrumb: "My Tickets > Ticket Detail", with a "Back to My Tickets" action.
- Read-only field grid: Ticket No., Ticket Date, Category, Related System, Requester, Requested Priority (badge), Current Status (badge), Summary, Description — all styled per the read-only field rule (§3).
- **Attachments section**, clearly separated from the read-only fields above it:
  - Active attachments: filename, size, uploaded date, Download action, Remove action (opens a confirmation requiring a reason, per BR-19/AC-14).
  - Removed attachments: same metadata, visually muted/struck-through state, Download disabled with a tooltip explaining removal, no Remove action.
  - Add-attachment control identical to the Create Ticket picker, subject to the same type/size/count rules and limit messaging.
- No comment box, internal notes, service actions, or event log — this screen only reads and manages the Ticket and its Attachments.

## 6. Requester Selection Storage

The selected Requester id is kept in `sessionStorage` (cleared when the tab
closes, consistent with "testing only, not a real session"). On app load,
the shell reads it; if absent or if `GET /api/dev-requesters` no longer
lists that id as active, the user is routed to the Selection screen (AC-02,
BR-11). Every Requester-scoped API call reads this value and sends it as
the `X-Dev-Requester-Id` header (see `api-spec.md` §0).

## 7. Responsive Rules

| Viewport | Behavior |
|---|---|
| Desktop ≥992px | Multi-column layout as specified per screen; content centered with a sensible max width (1140px) |
| Tablet 768–991px | Two-column layout where practical; Summary/Description keep enough width to be usable |
| Mobile <768px | Fields stack vertically; buttons remain touch-friendly (min 44px tap target); no horizontal page scrolling |
| All sizes | No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names |

## 8. Badges

Requested Priority and Current Status render as pill badges with both color
and text (never color alone):

| Priority | Style |
|---|---|
| LOW | Pale green background, `--color-secondary` text |
| MEDIUM | Amber background, dark amber text |
| HIGH | Light red background, `--color-error` text |

| Status | Style |
|---|---|
| NEW | Pale green background, `--color-secondary` text (only status possible in Lab 2) |

## 9. Accessibility

- Every form control has a programmatically associated `<label>`.
- Tab order follows visual order; focus is never trapped.
- Icon-only controls carry `aria-label` + visible tooltip (§4).
- Error messages are associated with their field via `aria-describedby`.
- Color is never the only signal (badges pair color with text; errors pair color with an icon + message).

## 10. Visual Checklist (used for §8.8 UI Style Checking evidence)

- [ ] No clipped labels at any breakpoint
- [ ] No overlapping controls/messages at any breakpoint
- [ ] No unintended horizontal scroll at any breakpoint
- [ ] Editable vs. read-only fields are visually distinguishable at a glance
- [ ] Required-field asterisks present and validation messages still shown even when the asterisk is visible
- [ ] Button hierarchy (primary/secondary/tertiary/destructive) visually consistent across all three screens
- [ ] Badge colors consistent between My Tickets and Ticket Detail
- [ ] Loading/empty/no-results/failure states each visually distinct from one another

## 11. Screenshot Paths (for submission evidence)

- `artifacts/lab-02/screenshots/create-ticket/` — initial, validation-failure, submitting, success, partial-attachment-failure, desktop/tablet/mobile
- `artifacts/lab-02/screenshots/my-tickets/` — loaded, empty, no-results, failure, desktop/tablet/mobile
- `artifacts/lab-02/screenshots/ticket-detail/` — loaded, attachment-removed state, unauthorized-access-blocked, desktop/tablet/mobile
