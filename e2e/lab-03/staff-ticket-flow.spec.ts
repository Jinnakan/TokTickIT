import { expect, test } from '@playwright/test'

// End-to-end golden path for the full IT Staff workflow (E2E-L3-02,
// AC-L3-09/10/12): login as IT Staff, open the Queue, claim a ticket,
// change its status, post a Public Comment and an Internal Note, and
// confirm the Queue reflects the change. Runs against the real dev
// servers and database — nothing here is mocked.

test.describe('IT Staff ticket workflow', () => {
  test('claim a ticket, change its status, post a comment and an internal note', async ({ page, context }) => {
    const uniqueSummary = `Staff workflow E2E check ${Date.now()}`

    // --- Seed a fresh ticket as a Requester ---
    await page.goto('/')
    await page.getByLabel('Email *').fill('sarah.johnson@toktickit.test')
    await page.getByLabel('Password *').fill('DevPass123!')
    await page.getByRole('button', { name: 'Login' }).click()

    await page.getByRole('button', { name: 'Create Ticket' }).first().click()
    await page.locator('#ticket-category').selectOption({ label: 'Hardware' })
    await page.locator('#ticket-related-system').selectOption({ label: 'Corporate Laptop' })
    await page.locator('#ticket-priority').selectOption({ label: 'Medium' })
    await page.locator('#ticket-summary').fill(uniqueSummary)
    await page.locator('#ticket-description').fill('Created by the Lab 3 staff-workflow E2E spec.')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText(/Your official Ticket Number is/)).toBeVisible()

    await page.getByRole('button', { name: 'Logout' }).click()

    // --- Login as IT Staff and open the Queue ---
    await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
    await page.getByLabel('Email *').fill('alex.rivera@toktickit.test')
    await page.getByLabel('Password *').fill('DevPass123!')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()

    await page.getByPlaceholder('Search by ticket number or summary…').fill(uniqueSummary)
    await expect(page.getByText(uniqueSummary).first()).toBeVisible()
    await page.getByText(uniqueSummary).first().click()

    // --- Claim ---
    await expect(page.getByRole('heading', { name: /Ticket TKT-/ })).toBeVisible()
    await page.getByRole('button', { name: 'Claim Ticket' }).click()
    await expect(page.getByText('Alex Rivera (you)')).toBeVisible()

    // --- Status transition (NEW -> OPEN) ---
    await page.getByLabel('Current Status').selectOption('OPEN')
    await expect(page.getByText('Open').first()).toBeVisible()

    // --- Public Comment ---
    await page.getByLabel('Add a comment').fill('Looked into this, investigating further.')
    await page.locator('form:has(#new-comment) button[type="submit"]').click()
    await expect(page.getByText('Looked into this, investigating further.')).toBeVisible()

    // --- Internal Note ---
    await page.getByLabel('Add an internal note').fill('Requester mentioned this started after a firmware update.')
    await page.locator('form:has(#new-note) button[type="submit"]').click()
    await expect(page.getByText('Requester mentioned this started after a firmware update.')).toBeVisible()

    // --- Back to Queue reflects the change ---
    await page.getByRole('button', { name: '← Ticket Queue' }).click()
    await page.getByPlaceholder('Search by ticket number or summary…').fill(uniqueSummary)
    await expect(page.getByText('Alex Rivera').first()).toBeVisible()

    // --- The Requester never sees the Internal Note ---
    const requesterContext = await context.browser()!.newContext()
    const requesterPage = await requesterContext.newPage()
    await requesterPage.goto('/')
    await requesterPage.getByLabel('Email *').fill('sarah.johnson@toktickit.test')
    await requesterPage.getByLabel('Password *').fill('DevPass123!')
    await requesterPage.getByRole('button', { name: 'Login' }).click()
    await requesterPage.getByPlaceholder('Search by ticket number or summary…').fill(uniqueSummary)
    await requesterPage.getByText(uniqueSummary).first().click()
    await expect(requesterPage.getByText('Looked into this, investigating further.')).toBeVisible()
    await expect(requesterPage.getByText(/Requester mentioned this started/)).toHaveCount(0)
    await requesterContext.close()
  })
})
