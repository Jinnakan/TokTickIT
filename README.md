# TokTickIT

An IT support ticketing app. Lab 2 delivers the Requester-facing MVP: pick a
Development Requester (a temporary stand-in for login — real authentication
lands in Lab 3), create a ticket with a category/related system/priority,
find it again in My Tickets with search/filter/sort/pagination, open its
read-only Ticket Detail, and manage attachments (upload, download,
soft-remove with a reason). See `docs/lab-02/specification.md` for the full
engineering contract.

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

   `prisma:seed` is idempotent — running it again does not create duplicates. It seeds the 4 required Categories, 7 Related Systems, 4 active Development Requesters, and 1 inactive Development Requester (used to verify the selector excludes inactive ones).

## Run the applications

In separate terminals, from the repo root:

```bash
cd client && npm run dev
cd server && npm run dev
```

The frontend runs at `http://localhost:5173`. On first load it shows the
Development Requester Selection screen; select any active Requester to
reach the app (My Tickets is the default view; Create Ticket is reachable
from the header nav or from My Tickets' own button). The API health
endpoint is available at `http://localhost:3000/api/health`.

Uploaded attachments are stored on the local filesystem under
`server/uploads/` (gitignored — metadata lives in Postgres, not git). That
directory is created automatically on first upload and is never served
statically; the only way to retrieve a file is through the
ownership-checked `GET /api/attachments/:id/download` endpoint.

## Verification commands

```bash
cd server && npm run typecheck && npm test
cd client && npx tsc -b --noEmit && npm test && npm run build
cd server && npm run db:check
```

`db:check` confirms that the PostgreSQL database in `server/.env` is
reachable. Server tests are integration tests against the real database
configured above (not mocked) and run with Vitest's file-level parallelism
disabled, since parallel test files would otherwise race each other's
inserts against the one shared database — see `docs/lab-02/tests.md` §6
for current pass counts.

To stop the local database while retaining its data, run:

```bash
docker compose stop
```

## Documentation

- `docs/lab-02/specification.md` — functional requirements, business
  rules, data model, and Definition of Done
- `docs/lab-02/api-spec.md` — full REST API contract
- `docs/lab-02/ui-spec.md` — Zen Green theme tokens and per-screen UI spec
- `docs/lab-02/tests.md` — test plan, acceptance-criterion traceability, and results
- `docs/lab-02/reviewer.md` — PR review log
- `docs/lab-02/ai-use.md` — AI-assistant use and reflection
