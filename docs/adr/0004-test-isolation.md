# 0004. Server tests run in their own database schema

## Context
The server tests are integration tests against the real PostgreSQL. They used the
development schema, so every run added Tickets and users: it had grown to about 33,000
Tickets, which buried the demo seed and made counts depend on history.

## Decision
A Vitest `globalSetup` (`server/tests/setup/global-setup.ts`) drops and recreates a
schema called `test_suite`, applies the migrations, runs the base seed, and points
`DATABASE_URL` at it before the workers start. The development schema is never touched.

## Consequences
- A run starts clean, so tests cannot depend on what an earlier run left behind.
- A run takes about 15 seconds longer (migrate and seed).
- Tried and accepted on 2026-10-31: the whole suite passed three times in a row and
  the Ticket count in the development schema did not change.
- End-to-end specs still use the development server and database; seed first
  (`npm run prisma:seed` in `server/`) because one spec uses up a seeded password.

## Alternatives considered
- A cleanup script that deletes test rows by pattern: fragile, and it needs to know every table.
- A separate database: needs another connection string for every contributor.
