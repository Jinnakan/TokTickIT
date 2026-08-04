# TokTickIT

## Requirements

- Node.js 20 or later
- PostgreSQL 15 or later

## Initial setup

1. Create local environment files:

   ```bash
   cp .env.example server/.env
   ```

2. Set `DATABASE_URL` in `server/.env` for your local PostgreSQL database.
3. Install dependencies:

   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

4. Create the database schema:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
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
