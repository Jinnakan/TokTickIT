# Architecture

How TokTickIT is put together, and where to put new code. Written at the end of
Lab 4; the contract documents for each lab stay under `docs/lab-0N/`.

## Layout

| Folder | What belongs there |
|---|---|
| `server/` | Express 5 API, Prisma schema and migrations, seeds, server tests |
| `client/` | React 19 app (Vite), client tests |
| `packages/shared/` | Rules both sides use: statuses, limits, validation (`action-rules.ts`, `ticket-rules.ts`) |
| `e2e/` | Playwright specs that drive the real app and database |
| `scripts/` | Repo-level helper scripts (for example the ten-run test proof) |
| `docs/` | Lab contracts, this file, decision records in `docs/adr/` |

`server/src`:

| Folder | What belongs there |
|---|---|
| `http/` | Things every route shares: `parseId`, `guardFor` role chains, JSON error and not-found handlers |
| `auth/` | Sessions, passwords, the Origin check |
| `authorization/` | Role and ownership rules (`require-role`, `ticket-access`, `ticket-ownership`) |
| `tickets/` | Ticket routes, comments, notes, the workflow facade, the resolution gate, the State classes, the list query builder |
| `actions/` | Actions Taken service and router |
| `attachments/` | Attachment routes and file storage |
| `dashboard/` | Dashboard metric classes, service, router |
| `users/` | User administration, assignable users, events |

`client/src`:

| Folder | What belongs there |
|---|---|
| `api/` | One module per resource; plain `fetch` wrappers and their error messages |
| `components/<area>/` | Screens and panels, grouped by area (`auth`, `shell`, `tickets`, `actions`, `dashboard`, `admin`, `common`) |
| `nav/` | The role navigation factory and the navigation reducer |
| `actions/`, `workflow/` | Pure logic for the Action form and for blocker wording (no React) |
| `staff/` | The Ticket Detail mediator (one refresh point for the staff panels) |
| `lib/` | Small shared helpers: date format, single-flight guard |
| `types/` | Shapes of API responses |

## Request flow

`app.ts` → a guard chain from `http/guards.ts` (valid session and Origin, forced
password change, role) → a router, which reads input and calls a service → the
service does the work in one transaction, locking the Ticket row when a rule
reads other rows → Prisma → JSON. Anything thrown goes to
`http/error-handlers.ts`, which answers a stable code and logs the cause on the
server only.

## Patterns in use

State (`tickets/ticket-state`), Facade (`tickets/ticket-workflow-service.ts`),
Strategy (`dashboard/metrics`), Builder (`tickets/ticket-query-builder.ts`),
Factory (`nav/role-navigation-factory.ts`), Mediator (`staff/ticket-detail-mediator.ts`),
Observer (`users/user-events.ts`). Use the existing one before adding a new one.

## Rules that must keep holding

- **The server decides, the client explains.** The UI reads `allowedStatuses` and
  `resolution` from the API; it never copies the transition table or the gate.
- **A version plus a row lock for any rule that reads other rows** (see ADR 0001).
- **Request bodies are read through an allowlist.** Unknown and protected fields
  are ignored.
- **Errors are `{ "error": "CODE" }` only.** No messages from thrown errors, no stack.
- **One date format** (`lib/format.ts`) and **one single-flight guard per mutating
  control** (`lib/useSingleFlight.ts`).
- **Tests create their own data.** Never pick a seeded account by position.

## Adding a feature

1. Add the spec rows to the lab's `tests.md` first.
2. Route behind `guardFor(...)`; parse ids with `parseId`.
3. Put anything that spans rows in a service with a transaction; lock the Ticket
   row (`tickets/lock-ticket.ts`) if a rule reads other rows.
4. Put validation both sides need in `packages/shared`.
5. Write the failing test, then the code. Server tests use the helpers in
   `server/tests/helpers`; client tests stub `fetch`.
6. Add a Playwright path when a user journey changed, and run it after
   `npm run prisma:seed`.
7. Run `npm run check`.

## Known limits, and the seam for each

- **Search** is a case-insensitive `contains` on number and summary. It scans the
  table; for very large data add a trigram index or move to full-text search
  behind `TicketQueryBuilder.withSearch`.
- **Login lockout** is kept in the server process. With several server processes,
  move `auth/login-rate-limiter.ts` to a shared store.
- **Attachments** are files on local disk. `attachments/attachment-storage.ts` is
  the seam for object storage.
- **Navigation** is a reducer, not URLs, so a page cannot be bookmarked. A router
  would replace `nav/app-navigation.ts` (see ADR 0003).
- **Remaining advisory:** `prisma` → `@prisma/config` → `deepmerge-ts` (3 high)
  can only be cleared by moving to a Prisma 8 release candidate; revisit when 8
  is stable.

## Commands

```bash
npm run check          # typecheck, all tests, build
npm run test:repeat    # the server suite ten times, with a log in artifacts/lab-04/regression/
npm run test:e2e       # run `npm run prisma:seed` in server/ first (one test uses up a seeded password)
```

Server tests run in their own schema (`test_suite`) that is rebuilt on every run,
so they never touch the development data (ADR 0004).
