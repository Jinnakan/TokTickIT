# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests are planned from `specification.md` before implementation, per Issue,
following red → green → refactor. No test is written after the fact to
match whatever the coding agent produced. Coverage spans unit, API,
UI-component, responsive/visual, and E2E levels; every Acceptance Criterion
in `specification.md` §9 maps to at least one row below, and every
automated row names its real test file. The `Final` column starts as
`Pending` and is updated to `Pass`/`Fail` as each Issue's PR lands — it is
not filled in speculatively.

## 2. Planned Tests

### Unit

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| UNIT-01 | BR-04 | Ticket Number generator | Given ticket id 42 in 2026, returns `TKT-2026-000042` | `server/tests/lab-02/ticket-number.unit.test.ts` | Pending |
| UNIT-02 | BR-16, BR-17 | Attachment file validator (type/size) | Rejects disallowed extension/MIME and files > 5MB; accepts JPG/PNG/WEBP/PDF ≤ 5MB | `server/tests/lab-02/attachment-validation.unit.test.ts` | Pending |
| UNIT-03 | Attachment storage decision (§11) | Safe stored-filename generator | Original filename with path separators/traversal characters is never used as the stored path; generated name is unique | `server/tests/lab-02/attachment-storage.unit.test.ts` | Pending |

### API

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| API-01 | AC-01 | `POST /api/tickets` valid body | 201; one Ticket saved; `ticketNumber` present and unique | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-02 | AC-04 | `POST /api/tickets` missing `summary` | 400; `fields.summary` message; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-03 | AC-05 | `POST /api/tickets` `summary` length 4 and length 151 | 400 for both; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-04 | AC-06 | `POST /api/tickets` inactive/unknown `categoryId` | 400; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-05 | AC-03, BR-12 | `GET /api/tickets` as Requester B | Requester A's tickets never appear in `data` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-06 | AC-10 | `GET /api/tickets?search=` with zero matches | 200; `data: []`, `meta.totalItems: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-07 | AC-11 | `GET /api/tickets?page=2` | Second page returns the correct slice per `meta` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-08 | BR-14 | `GET /api/tickets` default sort | Rows ordered `createdAt desc, id desc` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-09 | BR-15 | `GET /api/tickets?pageSize=999` and `?page=0` | `pageSize` clamped to 50; `page` clamped to 1 | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-10 | BR-22 | `GET /api/tickets` without `X-Dev-Requester-Id` | 400 `DEV_REQUESTER_REQUIRED` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-11 | AC-12 | `GET /api/tickets/:id` owned Ticket | 200; full read-only field set | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-12 | AC-03 | `GET /api/tickets/:id` not-owned Ticket | 403 `TICKET_FORBIDDEN` | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-13 | AC-01, BR-16 | `POST /api/tickets/:id/attachments` valid file | 201; Attachment saved, `isRemoved: false` | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-14 | AC-09 | Upload disallowed type (`.exe`) | 400 `UNSUPPORTED_FILE_TYPE` | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-15 | BR-17 | Upload 6MB file | 400 `FILE_TOO_LARGE` | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-16 | AC-08 | Upload 6th active attachment | 400 `ATTACHMENT_LIMIT_REACHED`; no row created | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-17 | AC-14 | `DELETE /api/attachments/:id` without `reason` | 400 `REASON_REQUIRED`; attachment still active | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-18 | AC-13 | `DELETE /api/attachments/:id` with valid reason | 200; `isRemoved: true`, metadata retained | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-19 | AC-13, BR-20 | `GET /api/attachments/:id/download` on removed attachment | 410 `ATTACHMENT_REMOVED` | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-20 | AC-03 | `GET /api/attachments/:id/download` not owned | 403 `ATTACHMENT_FORBIDDEN` | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-21 | BR-11 | `GET /api/dev-requesters` | Only active Requesters returned; seeded inactive one absent | `server/tests/lab-02/dev-requesters.api.test.ts` | Pending |
| API-22 | BR-08 | `GET /api/categories`, `GET /api/related-systems` | Only active rows returned | `server/tests/lab-02/reference-data.api.test.ts` | Pending |

### UI Component

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| UI-01 | AC-15 | Requester Selection API failure | Safe error message + Retry shown, no crash | `client/.../lab-02 tests/DevRequesterSelection.test.tsx` | Pending |
| UI-02 | AC-16 | Requester Selection with zero active Requesters | Empty-state message shown, Continue disabled | `client/.../lab-02 tests/DevRequesterSelection.test.tsx` | Pending |
| UI-03 | AC-02 | No Requester selected | App routes to Selection screen instead of My Tickets/Create Ticket/Detail | `client/.../lab-02 tests/DevRequesterSelection.test.tsx` | Pending |
| UI-04 | AC-04 | Create Ticket submit without Summary | Field-level message shown; `POST /api/tickets` not called | `client/.../lab-02 tests/CreateTicket.test.tsx` | Pending |
| UI-05 | §4 busy state | Create Ticket submit in flight | Submit button shows busy state and is disabled | `client/.../lab-02 tests/CreateTicket.test.tsx` | Pending |
| UI-06 | AC-01 | Create Ticket successful submit | Success state renders the returned Ticket Number | `client/.../lab-02 tests/CreateTicket.test.tsx` | Pending |
| UI-07 | AC-09 | Create Ticket disallowed attachment selected | Client blocks it with a type error; no upload request sent | `client/.../lab-02 tests/CreateTicket.test.tsx` | Pending |
| UI-08 | AC-07 | Create Ticket with one attachment upload failing | Partial-success banner names the failed file; Ticket Number still shown | `client/.../lab-02 tests/CreateTicket.test.tsx` | Pending |
| UI-09 | AC-10 | My Tickets zero-total vs. zero-matching-filter | Two visually distinct states rendered correctly for each case | `client/.../lab-02 tests/MyTickets.test.tsx` | Pending |
| UI-10 | AC-11 | My Tickets pagination controls | Page controls reflect `meta`; clicking Next requests the next page | `client/.../lab-02 tests/MyTickets.test.tsx` | Pending |
| UI-11 | AC-18 | My Tickets API failure | Failure state + Retry shown; no stale data presented as current | `client/.../lab-02 tests/MyTickets.test.tsx` | Pending |
| UI-12 | AC-12 | Requester Ticket Detail render | All fields read-only; no comment/notes/status controls present | `client/.../lab-02 tests/RequesterTicketDetail.test.tsx` | Pending |
| UI-13 | AC-14 | Attachment removal without reason | Client blocks submission until a reason is entered | `client/.../lab-02 tests/AttachmentSection.test.tsx` | Pending |
| UI-14 | AC-13 | Removed attachment row | Download control disabled/hidden; metadata still visible | `client/.../lab-02 tests/AttachmentSection.test.tsx` | Pending |

### Responsive / Visual

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| VIS-01 | AC-17 | Create Ticket at 375/834/1280px | Playwright screenshots show no clipping/overlap/h-scroll | `e2e/lab-02/visual-responsive.spec.ts` | Pending |
| VIS-02 | AC-17 | My Tickets at 375/834/1280px | Table→card transition correct; no h-scroll | `e2e/lab-02/visual-responsive.spec.ts` | Pending |
| VIS-03 | AC-17 | Ticket Detail at 375/834/1280px | Field grid and Attachments section remain usable at all sizes | `e2e/lab-02/visual-responsive.spec.ts` | Pending |

### E2E

| Test ID | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| E2E-01 | AC-01, AC-07, AC-13 | Full Requester flow: select Requester → create Ticket with attachment → find it in My Tickets → open Detail → remove the attachment | Each step succeeds and reflects the previous step's result (Ticket Number, attachment state) | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-02 | AC-02, AC-03 | Cross-Requester isolation: Requester A creates a Ticket, switch to Requester B | Requester B's My Tickets and direct Ticket Detail URL both fail to show Requester A's Ticket | `e2e/lab-02/requester-isolation.spec.ts` | Pending |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-06, E2E-01 |
| AC-02 | UI-03, E2E-02 |
| AC-03 | API-05, API-12, API-20, E2E-02 |
| AC-04 | API-02, UI-04 |
| AC-05 | API-03 |
| AC-06 | API-04 |
| AC-07 | UI-08, E2E-01 |
| AC-08 | API-16 |
| AC-09 | API-14, UI-07 |
| AC-10 | API-06, UI-09 |
| AC-11 | API-07, UI-10 |
| AC-12 | API-11, UI-12 |
| AC-13 | API-18, API-19, UI-14, E2E-01 |
| AC-14 | API-17, UI-13 |
| AC-15 | UI-01 |
| AC-16 | UI-02 |
| AC-17 | VIS-01, VIS-02, VIS-03 |
| AC-18 | UI-11 |

## 4. Responsive and Visual Checklist

See `ui-spec.md` §10 — the same checklist is completed against the
VIS-01/02/03 screenshots as part of Issue 7 (Release readiness) evidence.

## 5. Test Commands

Server (from `server/`):

```bash
npm test
```

Client (from `client/`):

```bash
npm test
```

E2E (from repo root, once Playwright is added in Issue 1's follow-up setup):

```bash
npx playwright test e2e/lab-02
```

## 6. Final Results

Populated once implementation Issues (2–7) land and the full suite runs on
`main`. Left blank in this planning document; see the submission PDF for
final pass/fail counts and command output.

## 7. Known Limitations or Deferred Tests

- Load/performance testing is out of scope for Lab 2.
- Concurrent-upload race conditions on the attachment limit (BR-18) are
  handled with a DB-level count check at write time but are not covered by
  a dedicated concurrency test in this sprint.
- Accessibility testing is manual (checklist in `ui-spec.md` §9/§10), not
  automated with an axe-core pass in Lab 2.
