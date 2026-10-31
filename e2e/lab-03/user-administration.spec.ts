import { expect, test } from '@playwright/test'

// End-to-end golden path (E2E-L3-03, AC-L3-14, AC-L3-15): Administrator
// creates a user (initial password shown once), that user signs in elsewhere,
// and deactivating them rejects the existing session at once. Runs against the
// real dev servers and database. The user who gets deactivated is the one this
// test creates, so it never changes a seeded account.

test.describe('Administrator user management', () => {
  test('create a user (password shown once) and deactivate a user with an active session', async ({ page, context }) => {
    const stamp = Date.now()
    const uniqueEmail = `e2e-admin-check-${stamp}@toktickit.test`

    await page.goto('/')
    await page.getByLabel('Email *').fill('morgan.kim@toktickit.test')
    await page.getByLabel('Password *').fill('DevPass123!')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

    // --- Create a user, confirm the password is shown once ---
    await page.getByLabel('Name').fill('E2E Admin Check')
    await page.getByLabel('Email').fill(uniqueEmail)
    await page.locator('form button[type="submit"]', { hasText: 'Create User' }).click()
    await expect(page.getByText(`Initial password for ${uniqueEmail}:`)).toBeVisible()
    await expect(page.getByText('This will not be shown again.')).toBeVisible()
    const initialPassword = (await page.locator('code').first().innerText()).trim()

    // --- The new user signs in somewhere else and holds a live session ---
    const otherContext = await context.browser()!.newContext()
    const otherPage = await otherContext.newPage()
    await otherPage.goto('/')
    await otherPage.getByLabel('Email *').fill(uniqueEmail)
    await otherPage.getByLabel('Password *').fill(initialPassword)
    await otherPage.getByRole('button', { name: 'Login' }).click()
    await expect(otherPage.getByRole('heading', { name: 'Change Password' })).toBeVisible()

    // --- Deactivate that user ---
    await page.getByLabel('Search users').fill(uniqueEmail)
    await expect(page.getByRole('row', { name: /E2E Admin Check/ })).toBeVisible()
    await page.getByRole('row', { name: /E2E Admin Check/ }).getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('end all of their active sessions')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('row', { name: /E2E Admin Check/ }).getByText('Inactive')).toBeVisible()

    // --- The existing session is now rejected ---
    await otherPage.reload()
    await expect(otherPage.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
    await expect(otherPage.getByLabel('Email *')).toBeVisible()
    await otherContext.close()
  })
})
