import { expect, test, type Page } from '@playwright/test'

// E2E4-02 (AC-L4-12, AC-L4-16, AC-L4-17): resolve is blocked, the blockers are
// cleared, the Requester reports it, staff resolve and reopen, history shows each step.

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
  await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
  await page.getByPlaceholder('Search by ticket number or summary…').fill(summary)
  await page.getByText(summary).first().click()
  await expect(page.getByRole('heading', { name: /Ticket TKT-/ })).toBeVisible()
}

test.describe('Ticket resolution flow', () => {
  test('blocked, cleared, reported by the Requester, resolved, reopened, with history', async ({ page }) => {
    const summary = `Resolution E2E check ${Date.now()}`

    await login(page, 'sarah.johnson@toktickit.test')
    await page.getByRole('button', { name: 'Create Ticket' }).first().click()
    await page.locator('#ticket-category').selectOption({ label: 'Hardware' })
    await page.locator('#ticket-related-system').selectOption({ label: 'Corporate Laptop' })
    await page.locator('#ticket-priority').selectOption({ label: 'Medium' })
    await page.locator('#ticket-summary').fill(summary)
    await page.locator('#ticket-description').fill('Created by the Lab 4 resolution E2E spec.')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText(/Your official Ticket Number is/)).toBeVisible()
    await logout(page)

    // Staff: claim, move to In Progress, and see why Resolved is blocked.
    await login(page, 'alex.rivera@toktickit.test')
    await openQueueTicket(page, summary)
    await page.getByRole('button', { name: 'Claim Ticket' }).click()
    await expect(page.getByText('Alex Rivera (you)')).toBeVisible()
    await page.getByLabel('Current Status').selectOption('OPEN')
    await expect(page.getByLabel('Current Status')).toContainText('Open — change to…')
    await page.getByLabel('Current Status').selectOption('IN_PROGRESS')
    await expect(page.getByText('Add a completed action')).toBeVisible()

    // Add a Planned action: the blocker changes. Then complete it: blockers clear.
    await page.getByRole('button', { name: 'Add action' }).click()
    await page.getByLabel('Description *').fill('Reseat the battery connector.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('1 action is still planned or in progress')).toBeVisible()
    await page.getByRole('button', { name: 'Complete' }).click()
    await page.getByLabel('Result *').fill('Battery now charges.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Battery now charges.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Why this ticket cannot be resolved yet' })).toHaveCount(0)
    await logout(page)

    // Requester says it looks fixed; status stays In Progress.
    await login(page, 'sarah.johnson@toktickit.test')
    await page.getByRole('button', { name: 'My Tickets' }).first().click()
    await page.getByText(summary).first().click()
    await page.getByRole('button', { name: 'Problem appears resolved' }).click()
    await expect(page.getByText(/You told us this appears resolved on/)).toBeVisible()
    await expect(page.getByText('In Progress').first()).toBeVisible()
    await logout(page)

    // Staff see the badge, resolve, then reopen; the badge goes away.
    await login(page, 'alex.rivera@toktickit.test')
    await openQueueTicket(page, summary)
    await expect(page.getByText('Requester reports resolved')).toBeVisible()
    await page.getByLabel('Current Status').selectOption('RESOLVED')
    await expect(page.getByLabel('Current Status')).toContainText('Resolved — change to…')
    await page.getByLabel('Current Status').selectOption('REOPENED')
    await expect(page.getByLabel('Current Status')).toContainText('Reopened — change to…')
    await expect(page.getByText('Requester reports resolved')).toHaveCount(0)

    await page.getByText('History', { exact: true }).click()
    const history = page.locator('details').filter({ hasText: 'History' })
    for (const step of ['Created as New', 'New → Open', 'Open → In Progress', 'In Progress → Resolved', 'Resolved → Reopened']) {
      await expect(history.getByText(step)).toBeVisible()
    }
  })
})
