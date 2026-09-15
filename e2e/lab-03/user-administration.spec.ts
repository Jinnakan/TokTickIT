import { expect, test } from '@playwright/test'

// End-to-end golden path (E2E-L3-03, AC-L3-14, AC-L3-15): Administrator
// creates a user (initial password shown once), then deactivates a user
// who has an active session elsewhere, and that session is immediately
// rejected. Runs against the real dev servers and database.

test.describe('Administrator user management', () => {
  test('create a user (password shown once) and deactivate a user with an active session', async ({ page, context }) => {
    const uniqueEmail = `e2e-admin-check-${Date.now()}@toktickit.test`

    // --- A Requester with an active session, deactivated later in this test ---
    const requesterContext = await context.browser()!.newContext()
    const requesterPage = await requesterContext.newPage()
    await requesterPage.goto('/')
    await requesterPage.getByLabel('Email *').fill('michael.brown@toktickit.test')
    await requesterPage.getByLabel('Password *').fill('DevPass123!')
    await requesterPage.getByRole('button', { name: 'Login' }).click()
    await expect(requesterPage.getByRole('heading', { name: 'My Tickets' })).toBeVisible()

    // --- Login as Administrator ---
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

    // --- Deactivate the Requester with the active session ---
    await page.getByLabel('Search users').fill('Michael Brown')
    await expect(page.getByRole('row', { name: /Michael Brown/ })).toBeVisible()
    await page.getByRole('row', { name: /Michael Brown/ }).getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('end all of their active sessions')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('row', { name: /Michael Brown/ }).getByText('Inactive')).toBeVisible()

    // --- The Requester's existing session is now rejected ---
    await requesterPage.reload()
    await expect(requesterPage.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
    await expect(requesterPage.getByLabel('Email *')).toBeVisible()
    await requesterContext.close()
  })
})
