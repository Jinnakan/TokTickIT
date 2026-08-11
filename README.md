# TokTickIT

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
4. Install dependencies:

   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

5. Generate Prisma Client and apply the tracked initial migration:

   ```bash
   npm run prisma:generate
   npx prisma migrate deploy
   ```

## Run the applications

In separate terminals:

```bash
cd client && npm run dev
cd server && npm run dev
```

The frontend runs at `http://localhost:5173` and displays Bootstrap styling. The API health endpoint is available at `http://localhost:3000/api/health`.

## Verification commands

```bash
cd client && npm run build
cd server && npm run typecheck && npm test
cd server && npm run db:check
```

`db:check` confirms that the PostgreSQL database in `server/.env` is reachable.

To stop the local database while retaining its data, run:

```bash
docker compose stop
```
