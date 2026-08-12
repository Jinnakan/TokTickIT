# Lab 01 automated tests

## Health endpoint

`GET /api/health` must respond with status `200` and this JSON body:

```json
{ "status": "ok", "service": "TokTickIT API" }
```

## Categories endpoint

`GET /api/categories` must respond with status `200` and return the four seeded
categories from PostgreSQL through Prisma in ascending ID order.

## React category-list behavior

The client Vitest suite verifies that the app shows a loading state, renders the
categories returned by the API, and displays a useful error if the API fails.

Run the server tests from `server/`:

```bash
npm test
```

Run the client tests from `client/`:

```bash
npm test
```
