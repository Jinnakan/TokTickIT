import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

// Run on demand with `npm run screenshots`. Same servers and browser as the tests, but only the capture spec.
export default defineConfig({
  ...base,
  testDir: './e2e/capture',
  testIgnore: [],
  timeout: 180_000,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
