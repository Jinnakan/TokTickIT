# Lab 01 API tests

## Health endpoint

`GET /api/health` must respond with status `200` and this JSON body:

```json
{ "status": "ok" }
```

## Categories endpoint

`GET /api/categories` must respond with status `200` and a list of starter
categories. Lab 01 uses in-memory data, so the endpoint does not need a
PostgreSQL connection. A later lab can replace this list with Prisma queries.

Run the automated tests from `server/`:

```bash
npm test
```
