# AI Use and Reflection - Lab 1

I used Codex with GPT-5 as an AI coding assistant during this lab. I reviewed
the generated code, requirements, commands, and test results before keeping
the changes. I used browser developer tools and Burp Suite for manual checks;
the automated checks below provide repeatable evidence for the API and UI.

## Work completed by branch

| Branch | AI-assisted work completed |
| --- | --- |
| `feature/1-project-foundation` | Set up the React, TypeScript, Vite, and Bootstrap client; the Node.js, Express, and TypeScript server; Prisma configuration for PostgreSQL; environment examples; Git ignores; README setup instructions; Vitest and Supertest scripts; and the initial `User` migration. |
| `feature/2-health-check` | Added `GET /api/health`, returning HTTP 200 with `{ "status": "ok", "service": "TokTickIT API" }`; added the Supertest health test; and connected the Check System UI to a real API request with a useful offline error message. |
| `feature/3-category-seed` | Added the Prisma `Category` model with ID, unique name, and creation timestamp; created the Category migration; wrote an idempotent `upsert` seed for Account and Access, Hardware, Software, and Network; and configured the local Docker PostgreSQL service. The database credentials remain in ignored `.env` files. |
| `feature/4-category-list` | Replaced the temporary category data with `GET /api/categories` through Prisma, selecting only ID and name and ordering by ID; updated the Supertest API test; made the React component testable; and added Vitest UI-01, UI-02, and UI-03 tests for the heading, loading-to-category-list flow, and API failure message. |

## Selected key prompts

| Prompt name | Actual prompt text | Result and reflection |
| --- | --- | --- |
| Read Issue 2 | "Please read Issue 2: Implement the API health check. Read requirement in page 12-15. And implement my code." | The requirements were checked against the lab sheet before the endpoint and test were changed. Being specific about the issue limited unrelated changes. |
| Add PostgreSQL | "can you get back to issue 1? PostgreSQL is reachable and Prisma is initialized. is one of the request. However, I don't have postsql file. Can you help me add it?" | This produced a Docker Compose PostgreSQL setup, Prisma configuration, migration support, and safe local environment configuration. |
| Seed categories | "The task 2 is done. Can you do the 3rd task. Read it in the lab document. Create and seed IT request categories." | The model, migration, and repeatable seed script were created. I needed a follow-up to resolve Docker Desktop authentication, which showed the value of testing the actual database connection. |
| Fix Prisma access | "There is an error when I run npx prisma migrate deploy... P1010" | The local Docker authentication rule and port configuration were corrected, then migration, seed, repeat seed, and database connection checks all passed. |
| Category-list feature | "The last feature. Issue 4: Display the IT request category list... Please read more about this task in the pdf file to understand the requirement. And implement the code for me." | The API now uses Prisma and the page renders API data with loading and error states. API and UI tests were added. |
| Check server build | "I accidentally run npm run build on server. Can you fix it for me?" | The build was confirmed safe: `server/dist` is ignored and the server build completed successfully from the correct directory. |
| Diagnose offline UI | "I run the webpage and both health and category are down. Am I missing something?" | The diagnosis separated database, server listener, proxy, and endpoint checks. This made it clear that manual UI testing should be supported by automated tests. |
| Add UI test files | "Can you go see the document again... We might have to have test file for them. Can you make it for me?" | The UI tests were placed under `client/tests/lab-01/` and named to match UI-01, UI-02, and UI-03. |

## Reflection

Small prompts tied to one lab issue were more reliable than asking for the
entire application at once. The most useful follow-ups asked the assistant to
run the real migration, seed, API tests, and UI tests rather than assuming the
first implementation worked. I learned to distinguish manual browser checks
from automated Vitest and Supertest evidence, and to keep credentials only in
ignored `.env` files. I also reviewed every generated change, especially Docker
ports, Prisma migrations, and API responses, because those details affect the
whole vertical slice.
