import { expect, test } from '@playwright/test'

// End-to-end golden path for AC-L3-01 and AC-L3-03: a user with a
// mandatory first-login password change logs in, is forced through
// Change Password before reaching anything else, and lands on the app
// after saving a new password. Runs against the real dev servers and
// database (see playwright.config.ts) with the seed already applied --
// "New Hire" is always re-seeded with mustChangePassword: true, so this
// spec is safe to re-run without manual DB reset (prisma/seed-data.ts).

test.describe('Authentication', () => {
  test('login forces a password change on first login, then reaches the app', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
    await page.getByLabel('Email *').fill('new.hire@toktickit.test')
    await page.getByLabel('Password *').fill('DevPass123!')
    await page.getByRole('button', { name: 'Login' }).click()

    // Forced to Change Password rather than the app (AC-L3-03).
    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible()
    await expect(page.getByText('You must set a new password before continuing.')).toBeVisible()

    const newPassword = `NewHirePass${Date.now()}!`
    await page.getByLabel('Current Password *').fill('DevPass123!')
    await page.getByLabel('New Password *', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirm New Password *').fill(newPassword)
    await page.getByRole('button', { name: 'Save' }).click()

    // Password change succeeded and the app is reachable (the existing Dev
    // Requester selector still gates the rest of the app in Lab 3 Issue 15
    // -- Issue 16/17 replace it with the real session-driven shell).
    await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
    await expect(page.getByText('Select Development Requester')).toBeVisible()
  })

  test('rejects an invalid password with a generic message and no redirect (AC-L3-02)', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email *').fill('jennifer.anderson@toktickit.test')
    await page.getByLabel('Password *').fill('definitely-wrong')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
    await expect(page).toHaveURL(/\/login$/)
  })
})
