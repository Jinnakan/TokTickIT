# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests were planned from `specification.md` before each Issue's implementation,
following red → green → refactor. Every Acceptance Criterion in
`specification.md` §9 maps to at least one row below, and every automated row
names its real test file. Paths below were corrected during PR #19 review
(a reviewer flagged the original plan's `client/.../lab-02 tests/*` paths —
a literal space before "tests" — as a typo; this revision fixes that and
also updates every file name to match what was actually implemented, since
component names changed during development, e.g. `CreateTicket.test.tsx` in
the original plan became `CreateTicketForm.test.tsx`).

## 2. Planned Tests

### API

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| API-01 | AC-01 | `POST /api/tickets` valid body | 201; one Ticket saved; `ticketNumber` present and matches `TKT-YYYY-NNNNNN` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-02 | AC-04 | `POST /api/tickets` missing `summary` | 400; `fields.summary` message; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | AC-05 | `POST /api/tickets` `summary` length 2 and length 151 | 400 for both; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-04 | AC-06 | `POST /api/tickets` unknown `categoryId` | 400; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-05 | — | `POST /api/tickets` with no Requester context | 400 `DEV_REQUESTER_REQUIRED` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-06 | AC-03, BR-12 | `GET /api/tickets` as Requester B | Requester A's tickets never appear in `data` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-07 | AC-10 | `GET /api/tickets?search=` with zero matches | 200; `data: []`, `meta.totalItems: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-08 | — | `GET /api/tickets?search=` partial, case-insensitive match | Ticket found by partial summary text | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-09 | AC-11 | `GET /api/tickets?page=1&pageSize=2` | Correct page slice; `meta.totalPages` matches | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-10 | BR-15 | `GET /api/tickets?pageSize=999` | `pageSize` clamped to 50 | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-11 | — | `GET /api/tickets?sortBy=not-a-field` | 400 `VALIDATION_FAILED`, `fields.sortBy` present | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-12 | BR-14 | `GET /api/tickets?sortBy=summary&sortDir=asc` | Rows returned in ascending summary order | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-13 | AC-12 | `GET /api/tickets/:id` owned Ticket | 200; full read-only field set | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-14 | AC-03 | `GET /api/tickets/:id` not-owned Ticket | 403 `TICKET_FORBIDDEN` (not 404) | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-15 | — | `GET /api/tickets/:id` unknown / non-numeric id | 404 `TICKET_NOT_FOUND` for both | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-16 | AC-01 | `POST /api/tickets/:id/attachments` valid JPEG | 201; `isRemoved: false` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-17 | AC-09 | Upload with correct extension/MIME but bytes that don't match (magic-byte check) | 400 `UNSUPPORTED_FILE_TYPE` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-18 | AC-09 | Upload disallowed extension (`.exe`) | 400 `UNSUPPORTED_FILE_TYPE` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-19 | BR-17 | Upload file > 5 MB | 400 `FILE_TOO_LARGE` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-20 | — | Upload with no file in the request | 400 `FILE_REQUIRED` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-21 | AC-03 | Upload to a Ticket owned by a different Requester | 403 `TICKET_FORBIDDEN` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-22 | AC-08 | Upload a 6th attachment sequentially | 400 `ATTACHMENT_LIMIT_REACHED`; exactly 5 remain | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-23 | AC-08 | 8 concurrent uploads to the same Ticket | Exactly 5 succeed, 3 rejected, DB count is 5 (real race, `FOR UPDATE` lock) | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-24 | AC-12 | `GET /api/tickets/:id/attachments` owned vs. not owned | 200 with metadata list / 403 `TICKET_FORBIDDEN` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-25 | — | `GET /api/attachments/:id/download` active attachment | 200; correct bytes, `Content-Disposition`, `X-Content-Type-Options: nosniff` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-26 | AC-03 | `GET /api/attachments/:id/download` not owned | 403 `ATTACHMENT_FORBIDDEN` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-27 | AC-13, BR-20 | `GET /api/attachments/:id/download` on a removed attachment | 410 `ATTACHMENT_REMOVED` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-28 | AC-13 | `DELETE /api/attachments/:id` with a valid reason | 200; `isRemoved: true`, metadata retained | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-29 | AC-14 | `DELETE /api/attachments/:id` missing/too-short reason | 400 `REASON_REQUIRED` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-30 | — | `DELETE /api/attachments/:id` already removed | 400 `ALREADY_REMOVED` (atomic check-and-set) | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-31 | AC-03 | `DELETE /api/attachments/:id` not owned | 403 `ATTACHMENT_FORBIDDEN` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-32 | BR-11 | `GET /api/dev-requesters` | Only active Requesters returned; seeded inactive one absent | `server/tests/lab-02/dev-requesters.api.test.ts` | Pass |
| API-33 | BR-22 | `X-Dev-Requester-Id` header missing / non-numeric / unknown / inactive | 400 `DEV_REQUESTER_REQUIRED` / `DEV_REQUESTER_INVALID` as appropriate | `server/tests/lab-02/dev-requester-context.middleware.test.ts` | Pass |
| API-34 | — | Valid active `X-Dev-Requester-Id` | Middleware calls `next()`, sets `res.locals.devRequesterId` | `server/tests/lab-02/dev-requester-context.middleware.test.ts` | Pass |

### UI Component

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| UI-01 | AC-15 | Requester Selection API failure | Safe error message + Retry shown, no crash | `client/tests/lab-02/DevRequesterSelection.test.tsx` | Pass |
| UI-02 | AC-16 | Requester Selection with zero active Requesters | Empty-state message shown | `client/tests/lab-02/DevRequesterSelection.test.tsx` | Pass |
| UI-03 | AC-02 | No Requester selected | App shows the Selection screen instead of My Tickets/Create Ticket | `client/tests/lab-02/DevRequesterSelection.test.tsx` | Pass |
| UI-04 | — | Selecting a Requester and continuing | Reaches the app shell; `sessionStorage` set | `client/tests/lab-02/DevRequesterSelection.test.tsx` | Pass |
| UI-05 | — | Stored selection restored on load | Shell shows the previously-selected Requester without re-picking | `client/tests/lab-02/AppShell.test.tsx` | Pass |
| UI-06 | BR-11 | Stored id for a no-longer-active Requester | Treated as no selection; Selection screen shown | `client/tests/lab-02/AppShell.test.tsx` | Pass |
| UI-07 | — | Change Requester | Clears selection and `sessionStorage`, returns to Selection screen | `client/tests/lab-02/AppShell.test.tsx` | Pass |
| UI-08 | AC-04 | Create Ticket submit without Summary | Field-level message shown; `POST /api/tickets` not called | `client/tests/lab-02/CreateTicketForm.test.tsx` | Pass |
| UI-09 | §4 busy state | Create Ticket submit in flight | Submit shows busy state; whole form (`fieldset`) disabled, not just Submit | `client/tests/lab-02/CreateTicketForm.test.tsx` | Pass |
| UI-10 | AC-01 | Create Ticket successful submit | Success state renders the returned Ticket Number | `client/tests/lab-02/CreateTicketForm.test.tsx` | Pass |
| UI-11 | AC-06 | Server-side field errors returned after submission | Field-level message rendered from the API response | `client/tests/lab-02/CreateTicketForm.test.tsx` | Pass |
| UI-12 | AC-10 | My Tickets zero-total vs. zero-matching-filter | Two visually distinct states (`role="status"` text differs) | `client/tests/lab-02/MyTicketsList.test.tsx` | Pass |
| UI-13 | AC-11 | My Tickets pagination controls | Page controls reflect `meta`; Next requests and renders the next page | `client/tests/lab-02/MyTicketsList.test.tsx` | Pass |
| UI-14 | AC-18 | My Tickets API failure | Failure state shown; no stale data presented as current | `client/tests/lab-02/MyTicketsList.test.tsx` | Pass |
| UI-15 | — | My Tickets row click | Calls `onOpenTicket` with the clicked row's ticket id | `client/tests/lab-02/MyTicketsList.test.tsx` | Pass |
| UI-16 | — | My Tickets renders badges | Priority/Status badges render with correct text in the desktop table | `client/tests/lab-02/MyTicketsList.test.tsx` | Pass |
| UI-17 | AC-12 | Requester Ticket Detail render | All fields read-only; no comment/notes/status controls present | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| UI-18 | — | Ticket Detail not-found / forbidden | Distinct messages for 404 vs. 403, each with a Back action | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| UI-19 | AC-14 | Attachment removal without reason | Client blocks submission until a reason is entered | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-20 | AC-13 | Removed attachment row | Download control absent; metadata (reason, date) still visible | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-21 | AC-09 | Disallowed file type selected client-side | Blocked before any upload request is sent | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |

### Responsive / Visual

| Test ID | Requirement/AC | What It Tests | Expected Result | Method | Final |
|---|---|---|---|---|---|
| VIS-01 | AC-17 | Create Ticket at 375 / 768 / 1280px | No clipping/overlap/horizontal scroll; system-generated fields visibly distinct | Manual browser verification (desktop/tablet/mobile viewports) | Pass |
| VIS-02 | AC-17 | My Tickets at 375 / 768 / 1280px | Table→card transition at <768px; filters/pagination remain usable | Manual browser verification | Pass |
| VIS-03 | AC-17 | Ticket Detail at 375 / 768 / 1280px | Field grid and Attachments section remain usable at all sizes | Manual browser verification | Pass |

`VIS-01`–`VIS-03` are **not** automated Playwright specs — no E2E tooling
was added to this project (see §7). They were verified manually via the
Claude Code browser tool at each breakpoint during Issue 7, screenshotted,
and checked against the `ui-spec.md` §10 checklist below.

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, API-16, UI-10 |
| AC-02 | UI-03 |
| AC-03 | API-06, API-14, API-21, API-26, API-31 |
| AC-04 | API-02, UI-08 |
| AC-05 | API-03 |
| AC-06 | API-04, UI-11 |
| AC-07 | *Not covered — attachment-at-creation (BR-21 partial-failure flow) is out of Lab 2 scope by explicit decision; see §7.* |
| AC-08 | API-22, API-23 |
| AC-09 | API-17, API-18, UI-21 |
| AC-10 | API-07, UI-12 |
| AC-11 | API-09, UI-13 |
| AC-12 | API-13, API-24, UI-17 |
| AC-13 | API-27, API-28, UI-20 |
| AC-14 | API-29, UI-19 |
| AC-15 | UI-01 |
| AC-16 | UI-02 |
| AC-17 | VIS-01, VIS-02, VIS-03 |
| AC-18 | UI-14 |

## 4. Responsive and Visual Checklist

Per `ui-spec.md` §10, verified manually against the running app during Issue 7:

- [x] No clipped labels at any breakpoint
- [x] No overlapping controls/messages at any breakpoint
- [x] No unintended horizontal scroll at any breakpoint
- [x] Editable vs. read-only fields are visually distinguishable (`.field-readonly` token, distinct from Bootstrap's default gray)
- [x] Required-field asterisks present and validation messages still shown even when the asterisk is visible
- [x] Button hierarchy (primary/secondary/tertiary/destructive) visually consistent across all three screens, using the actual Zen Green token values (fixed during Issue 7 — buttons and priority/status badges were rendering in Bootstrap's default blue/no-fill before this pass; see `ai-use.md`)
- [x] Badge colors consistent between My Tickets and Ticket Detail
- [x] Loading/empty/no-results/failure states each visually distinct from one another

## 5. Test Commands

Server (from `server/`):

```bash
npm test
```

Client (from `client/`):

```bash
npm test
```

There is no E2E/Playwright command — that layer was not implemented (§7).

## 6. Final Results

Run from the final `main` branch:

- **Server:** 8 test files, 45 tests, all passing. Run twice back-to-back with no flakiness (Vitest `fileParallelism: false` — these are integration tests against one shared Postgres instance, and running test files in parallel, Vitest's default, was racing them against each other; fixed during Issue 6).
- **Client:** 9 test files, 26 tests, all passing.
- **Total: 71 automated tests, 71 passing.**

## 7. Known Limitations or Deferred Tests

- **No E2E/Playwright automation.** `e2e/lab-02/` was planned but never set
  up. Responsive/visual verification (VIS-01–03) was done manually instead
  of via automated screenshot specs. The full user flow (select Requester →
  create Ticket → find in My Tickets → open Detail → manage attachments)
  was exercised manually against the real API during each Issue's
  verification pass, not via an automated E2E spec.
- **AC-07 (partial attachment-upload failure during Ticket creation) is not
  implemented or tested.** Attachment upload was scoped to Ticket creation
  and to Ticket Detail separately during planning; the team explicitly
  decided during Issue 4 to ship Ticket creation *without* attachment
  upload, and to cover all attachment upload/download/removal exclusively
  through Ticket Detail (Issue 6). `specification.md` FR-03's "optionally
  attaching files" at creation time is therefore not satisfied — a
  Requester attaches files after creating the Ticket, from Ticket Detail,
  not during the Create Ticket flow itself.
- **No standalone unit tests for ticket-number formatting or attachment
  path-safety.** These are covered by integration tests instead (API-01
  asserts the returned `ticketNumber` matches the expected format; the
  attachments API tests exercise the storage path end-to-end), but there
  is no isolated unit test for `generateTicketNumber` or
  `buildStoragePath`'s path-containment guard in isolation.
- **`GET /api/categories` / `GET /api/related-systems` active-only
  filtering (BR-08) has no negative-case test.** All seeded Categories and
  Related Systems are active, so no test proves an *inactive* one is
  excluded from these endpoints — the filter is implemented (`where:
  { isActive: true }`) but not exercised against an inactive row.
- Accessibility testing is manual (checklist in `ui-spec.md` §9/§10 and
  above), not automated with an axe-core pass.
