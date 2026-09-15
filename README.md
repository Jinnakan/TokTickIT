# TokTickIT

An IT support ticketing app. Lab 2 delivered the Requester-facing MVP with
a temporary Development Requester selector standing in for login. Lab 3
replaces that with real session-based authentication, three roles
(Requester, IT Staff, Administrator), and the workflows each role needs:
Requesters create and track their own tickets and comment on them; IT
Staff work a shared ticket queue, claim/reassign/prioritize/transition
tickets through their full status lifecycle, and leave Internal Notes not
visible to Requesters; Administrators manage user accounts. See
`docs/lab-03/specification.md` for the full engineering contract.

## Requirements

- Node.js 20 or later
- Docker Desktop (recommended for the provided PostgreSQL 15 service), or PostgreSQL 15 or later

## Initial setup

1. Start PostgreSQL. With Docker Desktop running, use the included configuration:

   ```bash
   docker compose up -d
   ```

   If you use a separately installed PostgreSQL instance, create a `toktickit` database and use its credentials in the next step.

2. Create the local environment file:

   ```bash
   cp .env.example server/.env
   ```

3. Set `DATABASE_URL` in `server/.env` if your PostgreSQL credentials differ from the supplied Docker defaults.
4. Install dependencies. This is an npm workspace (`client`, `server`, and `packages/shared`), so run install **once from the repo root** — this also links `packages/shared` into both `client` and `server`. Running `npm install` inside `client/` or `server/` individually will not create that link.

   ```bash
   npm install
   ```

5. Generate Prisma Client and apply the tracked migrations, from `server/`:

   ```bash
   cd server
   npm run prisma:generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```

   `prisma:seed` is idempotent — running it again does not create
   duplicates or reset the shared dev password below. It seeds the 4
   required Categories, 7 Related Systems, and a set of Users across all
   three roles (active and inactive/deactivated accounts, plus one account
   with a pending forced password change, to exercise every login-path
   edge case).

## Logging in

All seeded accounts share the password `DevPass123!` (dev/course use
only — see `server/prisma/seed-data.ts` for the full account list and
their roles). A few starting points:

- Requester: `jennifer.anderson@toktickit.test`
- IT Staff: `alex.rivera@toktickit.test`
- Administrator: `morgan.kim@toktickit.test`

Real Administrator-created accounts never use this shared password — an
Administrator creating or resetting a user's password gets a
system-generated one-time password shown exactly once in the response,
per `docs/lab-03/specification.md` BR-L3-19.

## Run the applications

In separate terminals, from the repo root:

```bash
cd client && npm run dev
cd server && npm run dev
```

The frontend runs at `http://localhost:5173`. On first load it shows the
Login screen; the app shell, navigation, and default view after login
depend on the signed-in user's role (see `docs/lab-03/ui-spec.md` §1 for
the per-role shell and §4–7 for the Requester, IT Staff, and Administrator
screens). The API health endpoint is available at
`http://localhost:3000/api/health`.

Uploaded attachments are stored on the local filesystem under
`server/uploads/` (gitignored — metadata lives in Postgres, not git). That
directory is created automatically on first upload and is never served
statically; the only way to retrieve a file is through the
access-checked `GET /api/attachments/:id/download` endpoint.

## Verification commands

```bash
cd server && npm run typecheck && npm test
cd client && npx tsc -b --noEmit && npm test && npm run build
cd server && npm run db:check
```

End-to-end (from the repo root; starts both dev servers itself via
Playwright's `webServer` config if they aren't already running — Postgres
must already be up and seeded):

```bash
npx playwright test
```

`db:check` confirms that the PostgreSQL database in `server/.env` is
reachable. Server tests are integration tests against the real database
configured above (not mocked) and run with Vitest's file-level parallelism
disabled, since parallel test files would otherwise race each other's
inserts against the one shared database — see `docs/lab-03/tests.md` §6
for current pass counts.

To stop the local database while retaining its data, run:

```bash
docker compose stop
```

## Documentation

- `docs/lab-03/specification.md` — functional requirements, business
  rules, data model, security requirements, and Definition of Done
- `docs/lab-03/api-spec.md` — full REST API contract
- `docs/lab-03/ui-spec.md` — Zen Green theme tokens and per-screen UI spec
- `docs/lab-03/tests.md` — test plan, acceptance-criterion traceability, and results
- `docs/lab-03/reviewer.md` — PR review log
- `docs/lab-03/ai-use.md` — AI-assistant use and reflection

Lab 2's equivalent documents remain under `docs/lab-02/` for reference;
Lab 3 supersedes them for anything session/role/staff/admin-related.
