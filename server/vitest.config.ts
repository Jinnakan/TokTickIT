import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // These are integration tests against one shared Postgres database, not
    // isolated unit tests -- running test files in parallel (Vitest's
    // default) lets them race each other's inserts/counts. Sequential file
    // execution trades some wall-clock time for a suite that isn't flaky.
    fileParallelism: false,
  },
})
