# TokTickIT

An IT support ticketing app with three roles.

- **Requesters** create tickets, follow them, comment, attach files, see the
  Actions Taken on their tickets and the status history, and can say "problem
  appears resolved" without changing the status.
- **IT Staff** work a shared queue: claim, reassign and prioritize tickets, record
  Actions Taken (planned, in progress, completed, cancelled, with follow-ups), and
  move tickets through their lifecycle. A ticket cannot be resolved while work is
  unfinished (the resolution gate), and stale or simultaneous edits are rejected.
- **Administrators** manage user accounts and can do everything IT Staff can.

Every role lands on a Dashboard with counts that link to the matching list.
`docs/architecture.md` explains how the code is organized and where new code goes.

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

3. Set `DATABASE_URL` in `server/.env` if your PostgreSQL credentials differ from the supplied Docker defaults. The server checks `DATABASE_URL`, `PORT` and `APP_ORIGIN` at startup and names anything that is wrong.
4. Install dependencies. This is an npm workspace (`client`, `server`, `packages/shared`), so run install **once from the repo root**; running it inside `client/` or `server/` does not link `packages/shared`.

   ```bash
   npm install
   ```

5. Generate Prisma Client, apply the migrations, and seed the base data, from `server/`:

   ```bash
   cd server
   npm run prisma:generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```

   `prisma:seed` is idempotent. It seeds the 4 Categories, 7 Related Systems and
   users in every role, including inactive accounts and one account that must
   change its password on first login.

Optional demo data (realistic tickets, comments, notes, Actions Taken with
follow-ups, and a Requester with no tickets), safe to re-run and never
overwriting an edit:

```bash
npm run prisma:seed:demo
```

## Logging in

All seeded accounts share the password `DevPass123!` (development only; see
`server/prisma/seed-data.ts` for the account list). Starting points:

- Requester: `jennifer.anderson@toktickit.test`
- IT Staff: `alex.rivera@toktickit.test`
- Administrator: `morgan.kim@toktickit.test`

Accounts created by an Administrator get a generated one-time password shown once.

## Run the applications

In separate terminals, from the repo root:

```bash
cd client && npm run dev
cd server && npm run dev
```

The app is at `http://localhost:5173` and the API health check at
`http://localhost:3000/api/health`. Uploaded files are stored under
`server/uploads/` (not committed) and are only served through the
access-checked download endpoint.

## Checks

From the repo root:

```bash
npm run check          # typecheck, all server and client tests, build
npm run test:repeat    # the server suite ten times; log in artifacts/lab-04/regression/
npm run prisma:seed --workspace server   # before the end-to-end specs
npm run test:e2e       # Playwright; starts both dev servers if they are not running
```

Server tests are integration tests against the real PostgreSQL. They run in their
own schema (`test_suite`), rebuilt every run, so they never touch your development
data. End-to-end specs use the development database and run one at a time.

To stop the local database while keeping its data: `docker compose stop`.

## Documentation

- `docs/architecture.md`: code layout, request flow, patterns, how to add a feature, known limits
- `docs/adr/`: short decision records
- `docs/lab-04/`: the current contract: `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`
- `docs/lab-03/`, `docs/lab-02/`: earlier labs, kept for reference; Lab 4 supersedes
  them wherever they differ
