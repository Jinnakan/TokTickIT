import { expect, test } from '@playwright/test'

// End-to-end golden path (labsheet §9.2 example, AC-01, AC-05): a Requester
// selects themself, creates a Ticket, finds it in My Tickets, and opens its
// read-only Ticket Detail. Runs against the real dev servers and database
// (see playwright.config.ts) — nothing here is mocked.

test.describe('Requester Ticket flow', () => {
  test('select Requester, create a Ticket, find it in My Tickets, open Ticket Detail', async ({ page }) => {
    const uniqueSummary = `E2E golden path check ${Date.now()}`

    await page.goto('/')

    // --- Development Requester Selection ---
    await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
    await page.getByLabel('Development Requester').selectOption({ label: 'Jennifer Anderson' })
    await page.getByRole('button', { name: 'Continue' }).click()

    // --- Create Ticket ---
    // Two "Create Ticket" buttons exist on this screen (the header nav item
    // and My Tickets' own shortcut button) — either reaches the same form.
    await page.getByRole('button', { name: 'Create Ticket' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create Ticket' })).toBeVisible()

    // System-generated fields are read-only and populated before submission.
    // "Jennifer Anderson" also appears in the header nav — .last() targets
    // the read-only Requester field inside the form itself.
    await expect(page.getByText('Jennifer Anderson').last()).toBeVisible()

    await page.locator('#ticket-category').selectOption({ label: 'Hardware' })
    await page.locator('#ticket-related-system').selectOption({ label: 'Corporate Laptop' })
    await page.locator('#ticket-priority').selectOption({ label: 'Medium' })
    await page.locator('#ticket-summary').fill(uniqueSummary)
    await page.locator('#ticket-description').fill('Created by the Lab 2 E2E golden-path spec.')

    await page.getByRole('button', { name: 'Submit' }).click()

    // Confirmation shows the official, server-assigned Ticket Number.
    const confirmation = page.getByText(/Your official Ticket Number is/)
    await expect(confirmation).toBeVisible()
    const ticketNumberMatch = await confirmation.textContent()
    const ticketNumber = ticketNumberMatch?.match(/TKT-\d{4}-\d{6}/)?.[0]
    expect(ticketNumber).toBeTruthy()

    // --- Find it in My Tickets ---
    await page.getByRole('button', { name: 'Back to My Tickets' }).click()
    await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible()

    // The desktop table and mobile card are both rendered in the DOM at
    // once (CSS-hidden by breakpoint, per ui-spec.md); .first() pins this
    // to the desktop row since the default viewport here is desktop-sized.
    await page.getByPlaceholder('Search by ticket number or summary…').fill(uniqueSummary)
    await expect(page.getByText(uniqueSummary).first()).toBeVisible()
    await expect(page.getByText(ticketNumber!).first()).toBeVisible()

    // --- Open Ticket Detail ---
    await page.getByText(uniqueSummary).first().click()
    await expect(page.getByText(ticketNumber!).first()).toBeVisible()
    await expect(page.getByText('Created by the Lab 2 E2E golden-path spec.')).toBeVisible()

    // Ticket Detail is read-only for a Requester: no comment/status controls.
    await expect(page.getByRole('button', { name: /Submit/ })).toHaveCount(0)
  })
})
