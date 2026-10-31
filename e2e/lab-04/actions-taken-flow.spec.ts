import { expect, test, type Page } from '@playwright/test'

// E2E4-01 (AC-L4-01, AC-L4-05, AC-L4-07): one staff member adds an Action, a
// different staff member completes it with a follow-up, the Requester reads it.
// Uses seeded accounts only to log in; the Ticket and Actions are created here.

async function login(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email *').fill(email)
  await page.getByLabel('Password *').fill('DevPass123!')
  await page.getByRole('button', { name: 'Login' }).click()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
}

async function openQueueTicket(page: Page, summary: string) {
  await page.getByRole('button', { name: 'Ticket Queue' }).click()
  await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
  await page.getByPlaceholder('Search by ticket number or summary…').fill(summary)
  await page.getByText(summary).first().click()
  await expect(page.getByRole('heading', { name: /Ticket TKT-/ })).toBeVisible()
}

test.describe('Actions Taken flow', () => {
  test('add, complete with a follow-up by another staff member, Requester reads it', async ({ page }) => {
    const summary = `Actions E2E check ${Date.now()}`

    // Requester creates a Ticket.
    await login(page, 'sarah.johnson@toktickit.test')
    await page.getByRole('button', { name: 'Create Ticket' }).first().click()
    await page.locator('#ticket-category').selectOption({ label: 'Hardware' })
    await page.locator('#ticket-related-system').selectOption({ label: 'Corporate Laptop' })
    await page.locator('#ticket-priority').selectOption({ label: 'Medium' })
    await page.locator('#ticket-summary').fill(summary)
    await page.locator('#ticket-description').fill('Created by the Lab 4 Actions Taken E2E spec.')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText(/Your official Ticket Number is/)).toBeVisible()
    await logout(page)

    // Alex adds a Planned Action.
    await login(page, 'alex.rivera@toktickit.test')
    await openQueueTicket(page, summary)
    await expect(page.getByText('No actions recorded yet.')).toBeVisible()
    await page.getByRole('button', { name: 'Add action' }).click()
    await page.getByLabel('Description *').fill('Replace the docking station firmware.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'Actions Taken (1)' })).toBeVisible()
    await expect(page.getByText('Replace the docking station firmware.')).toBeVisible()
    await logout(page)

    // Priya (not the owner) starts it, then completes it with a follow-up.
    await login(page, 'priya.nair@toktickit.test')
    await openQueueTicket(page, summary)
    await page.getByRole('button', { name: 'Start' }).click()
    const actionCard = page.getByRole('listitem').filter({ hasText: 'Replace the docking station firmware.' })
    await expect(actionCard.getByText('In Progress')).toBeVisible()
    await page.getByRole('button', { name: 'Complete' }).click()
    await page.getByLabel('Result *').fill('Dock detected after reboot.')
    await page.getByLabel('Follow-up required').check()
    await page.getByLabel('Follow-up note *').fill('Check again on Friday.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Dock detected after reboot.')).toBeVisible()
    await expect(page.getByText(/Follow-up needed: Check again on Friday\./)).toBeVisible()
    await page.getByRole('button', { name: 'Mark follow-up done' }).click()
    await expect(page.getByText(/Done /).first()).toBeVisible()
    await logout(page)

    // The Requester reads it with no controls.
    await login(page, 'sarah.johnson@toktickit.test')
    await page.getByRole('button', { name: 'My Tickets' }).first().click()
    await page.getByText(summary).first().click()
    await expect(page.getByRole('heading', { name: 'Actions Taken (1)' })).toBeVisible()
    await expect(page.getByText('Dock detected after reboot.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add action' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0)
  })
})
