# Lab 1 Automated Tests

Test File | Tool | Test Description
--- | --- | ---
`server/tests/lab-01/health.test.ts` (API-01) | Supertest | `GET /api/health` returns 200 and `{ status: "ok", service: "TokTickIT API" }`
`server/tests/lab-01/categories.test.ts` (API-02) | Supertest | `GET /api/categories` returns the four seeded categories in ID order
`client/tests/lab-01/heading.test.tsx` (UI-01) | Vitest | TokTickIT heading renders
`client/tests/lab-01/category-list.test.tsx` (UI-02) | Vitest | Loading state changes to the rendered category list after `Check System` is clicked
`client/tests/lab-01/error-state.test.tsx` (UI-03) | Vitest | API failure displays a useful error message

## Running the tests

Server tests (from `server/`):

```bash
npm test
```

Client tests (from `client/`):

```bash
npm test
```
