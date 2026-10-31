import { expect, test, type Page } from '@playwright/test'

const ACCOUNTS = {
  requester: 'sarah.johnson@toktickit.test',
  staff: 'alex.rivera@toktickit.test',
  admin: 'morgan.kim@toktickit.test',
}

async function login(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email *').fill(email)
  await page.getByLabel('Password *').fill('DevPass123!')
  await page.getByRole('button', { name: 'Login' }).click()
}

/** Click a card and return the list total the server reported for the drill-down. */
async function openCardAndReadTotal(page: Page, name: RegExp): Promise<{ count: number; total: number }> {
  const card = page.getByRole('link', { name })
  const label = (await card.getAttribute('aria-label')) ?? ''
  const count = Number(label.match(/, (\d+) tickets?$/)?.[1])
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/tickets?') && r.request().method() === 'GET'),
    card.click(),
  ])
  const body = (await response.json()) as { meta: { totalItems: number } }
  return { count, total: body.meta.totalItems }
}

test.describe('Dashboards', () => {
  test('E2E4-03 each role lands on its Dashboard and a card opens a list as long as its count', async ({ page }) => {
    await login(page, ACCOUNTS.requester)
    await expect(page.getByRole('heading', { name: 'Welcome, Sarah' })).toBeVisible()
    const requesterCard = await openCardAndReadTotal(page, /^Open tickets, \d+ tickets?$/)
    expect(requesterCard.total).toBe(requesterCard.count)
    await expect(page.getByText('Showing: Active tickets')).toBeVisible()
    await page.getByRole('button', { name: 'Logout' }).click()

    await login(page, ACCOUNTS.staff)
    await expect(page.getByRole('heading', { name: 'Welcome, Alex' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    const staffCard = await openCardAndReadTotal(page, /^Unassigned, \d+ tickets?$/)
    expect(staffCard.total).toBe(staffCard.count)
    await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
    await page.getByRole('button', { name: 'Logout' }).click()

    await login(page, ACCOUNTS.admin)
    await expect(page.getByRole('heading', { name: 'Welcome, Morgan' })).toBeVisible()
    await expect(page.getByRole('button', { name: /active · \d+ inactive/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ticket Queue' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'User Management' })).toBeVisible()
  })

  test('E2E4-04 walking every screen of every role shows no console errors or failed requests', async ({ page }) => {
    const problems: string[] = []
    page.on('console', (message) => {
      // Chrome logs the expected 401 from the pre-login session check as a console error too.
      if (message.type() === 'error' && !message.location().url.endsWith('/api/auth/me')) {
        problems.push(`console: ${message.text()}`)
      }
    })
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
    page.on('response', (response) => {
      const url = response.url()
      // The login screen asks /api/auth/me before there is a session, so one 401 there is expected.
      if (response.status() >= 400 && !(url.endsWith('/api/auth/me') && response.status() === 401)) {
        problems.push(`${response.status()} ${url}`)
      }
    })

    const screens: Record<string, string[]> = {
      [ACCOUNTS.requester]: ['Dashboard', 'My Tickets', 'Create Ticket'],
      [ACCOUNTS.staff]: ['Dashboard', 'Ticket Queue'],
      [ACCOUNTS.admin]: ['Dashboard', 'Ticket Queue', 'User Management'],
    }
    for (const [email, items] of Object.entries(screens)) {
      await login(page, email)
      for (const item of items) {
        await page.getByRole('button', { name: item, exact: true }).first().click()
        await page.waitForLoadState('networkidle')
      }
      await page.getByRole('button', { name: 'Logout' }).click()
      await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
    }

    expect(problems).toEqual([])
  })
})
