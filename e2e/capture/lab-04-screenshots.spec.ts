import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'

// Produces the Lab 4 screenshots and INDEX.md. Not a test of behavior: the behavior is covered by
// the suites. Run with `npm run screenshots` after `npm run prisma:seed` and `npm run prisma:seed:demo`.

const OUT = 'artifacts/lab-04/screenshots'
const ORIGIN = 'http://localhost:5173'
const PASSWORD = 'DevPass123!'
const SIZES = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]
const TWO_SIZES = [SIZES[0], SIZES[2]]

type Row = { file: string; what: string; source: 'live' | 'mocked' }
const index: Row[] = []

async function shoot(page: Page, group: string, scene: string, what: string, source: Row['source'], sizes = SIZES) {
  mkdirSync(`${OUT}/${group}`, { recursive: true })
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.waitForTimeout(300)
    // Part 9: no horizontal overflow at any width, checked at the moment of every shot.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow in ${group}/${scene} at ${size.width}px`).toBeLessThanOrEqual(0)
    const file = `${group}/${scene}-${size.name}.png`
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true })
    index.push({ file, what: `${what} (${size.width}px)`, source })
  }
  // Later steps click in the desktop layout, so always finish there.
  await page.setViewportSize({ width: SIZES[0].width, height: SIZES[0].height })
}

async function login(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email *').fill(email)
  await page.getByLabel('Password *').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

const nav = (page: Page, name: string) => page.locator('header').getByRole('button', { name, exact: true })

/** A signed-in browser context plus API helpers that send the Origin header the server requires. */
async function session(browser: Browser, email: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, email)
  const call = (method: 'post' | 'patch', url: string, data?: object) =>
    page.request[method](url, { data, headers: { Origin: ORIGIN } })
  return { context, page, call }
}

async function createTicket(requester: Awaited<ReturnType<typeof session>>, summary: string) {
  const categories = (await (await requester.page.request.get('/api/categories')).json()) as Array<{ id: number }>
  const systems = (await (await requester.page.request.get('/api/related-systems')).json()) as Array<{ id: number }>
  const response = await requester.call('post', '/api/tickets', {
    categoryId: categories[0].id, relatedSystemId: systems[0].id, requestedPriority: 'HIGH', summary,
    description: 'Created by the Lab 4 screenshot script so the screens show realistic content.',
  })
  return (await response.json()) as { id: number; ticketNumber: string }
}

async function openTicketByNumber(page: Page, listScreen: string, ticketNumber: string) {
  await nav(page, listScreen).click()
  await page.getByPlaceholder('Search by ticket number or summary…').fill(ticketNumber)
  await page.waitForLoadState('networkidle')
  await page.locator(`text=${ticketNumber}`).locator('visible=true').first().click()
  await expect(page.getByRole('heading', { name: new RegExp(ticketNumber) })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Actions Taken \(\d+\)$/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test.describe.configure({ mode: 'serial' })

let sarah: Awaited<ReturnType<typeof session>>
let alex: Awaited<ReturnType<typeof session>>
let priya: Awaited<ReturnType<typeof session>>
let morgan: Awaited<ReturnType<typeof session>>
let busy: { id: number; ticketNumber: string }
let blocked: { id: number; ticketNumber: string }
let closed: { id: number; ticketNumber: string }

test.beforeAll(async ({ browser }) => {
  ;[sarah, alex, priya, morgan] = await Promise.all([
    session(browser, 'sarah.johnson@toktickit.test'),
    session(browser, 'alex.rivera@toktickit.test'),
    session(browser, 'priya.nair@toktickit.test'),
    session(browser, 'morgan.kim@toktickit.test'),
  ])

  // One Ticket with different Actions Taken (handout part 6: "different Actions Taken on one Ticket").
  busy = await createTicket(sarah, 'Docking station is not detected after sleep')
  await alex.call('post', `/api/tickets/${busy.id}/claim`)
  const completed = await (await alex.call('post', `/api/tickets/${busy.id}/actions`, {
    description: 'Updated the docking station firmware.', status: 'COMPLETED', result: 'The dock is detected after a reboot.',
    followUpRequired: true, followUpNote: 'Check again on Friday.',
  })).json()
  await alex.call('post', `/api/tickets/${busy.id}/actions`, {
    description: 'Test the dock with a second laptop.', status: 'IN_PROGRESS', assigneeId: undefined,
  })
  await priya.call('post', `/api/tickets/${busy.id}/actions`, { description: 'Replace the dock if the firmware does not help.', status: 'PLANNED' })
  const cancelled = await (await alex.call('post', `/api/tickets/${busy.id}/actions`, { description: 'Visit the desk (not needed any more).' })).json()
  await alex.call('patch', `/api/tickets/${busy.id}/actions/${cancelled.id}`, { version: cancelled.version, status: 'CANCELLED' })
  void completed

  // A Ticket whose resolution is blocked, and one that is closed.
  blocked = await createTicket(sarah, 'Printer on floor 2 keeps going offline')
  await alex.call('post', `/api/tickets/${blocked.id}/claim`)
  for (const status of ['OPEN', 'IN_PROGRESS']) {
    const current = await (await alex.page.request.get(`/api/tickets/${blocked.id}`)).json()
    await alex.call('patch', `/api/tickets/${blocked.id}/status`, { status, expectedVersion: current.version })
  }
  await alex.call('post', `/api/tickets/${blocked.id}/actions`, { description: 'Check the print server queue.', status: 'PLANNED' })

  closed = await createTicket(sarah, 'Old request closed last week')
  for (const status of ['OPEN', 'IN_PROGRESS']) {
    const current = await (await alex.page.request.get(`/api/tickets/${closed.id}`)).json()
    await alex.call('patch', `/api/tickets/${closed.id}/status`, { status, expectedVersion: current.version })
  }
  await alex.call('post', `/api/tickets/${closed.id}/actions`, { description: 'Reset the account.', status: 'COMPLETED', result: 'Account works again.' })
  for (const status of ['RESOLVED', 'CLOSED']) {
    const current = await (await alex.page.request.get(`/api/tickets/${closed.id}`)).json()
    await alex.call('patch', `/api/tickets/${closed.id}/status`, { status, expectedVersion: current.version })
  }
})

test.afterAll(async () => {
  const rows = index.map((row) => `| ${row.file} | ${row.what} | ${row.source} |`).join('\n')
  writeFileSync(
    `${OUT}/INDEX.md`,
    `# Lab 4 screenshots\n\nGenerated by \`npm run screenshots\` (\`e2e/capture/lab-04-screenshots.spec.ts\`). "mocked" means the server response was replaced to show a state live data cannot show; the real behavior of that state is covered by the named tests.\n\n| File | What it shows | Source |\n|---|---|---|\n${rows}\n`,
  )
  await Promise.all([sarah, alex, priya, morgan].map((s) => s.context.close()))
})

test('staff dashboard', async () => {
  const { page } = alex
  await page.goto('/')
  await nav(page, 'Dashboard').click()
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await shoot(page, 'staff-dashboard', 'loaded', 'IT Staff dashboard with live counts', 'live')

  await page.getByRole('link', { name: /^Unassigned, / }).click()
  await expect(page.getByText(/^Showing: /)).toBeVisible()
  await page.waitForLoadState('networkidle')
  await shoot(page, 'staff-dashboard', 'drilldown', 'Ticket Queue opened from the Unassigned card, filter shown', 'live')

  await nav(page, 'Dashboard').click()
  await page.route('**/api/dashboard/staff', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(), windowDays: 7,
        cards: [
          { key: 'unassigned', label: 'Unassigned', count: 0, drillDown: { view: 'ticket-queue', query: { unassignedOnly: 'true', statusGroup: 'active' } } },
          { key: 'mine', label: 'Owned by me', count: 0, drillDown: { view: 'ticket-queue', query: { ticketOwnerId: '1', statusGroup: 'active' } } },
          { key: 'reported-resolved', label: 'Reported resolved by Requester', count: 0, drillDown: { view: 'ticket-queue', query: { requesterReportedResolved: 'true', statusGroup: 'active' } } },
          { key: 'my-open-actions', label: 'My open actions', count: 0, drillDown: null },
        ],
        byStatus: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'].map((status) => ({ status, count: 0, drillDown: { view: 'ticket-queue', query: { currentStatus: status } } })),
        byItPriority: ['LOW', 'MEDIUM', 'HIGH'].map((priority) => ({ priority, count: 0, drillDown: { view: 'ticket-queue', query: { itPriority: priority, statusGroup: 'active' } } })),
        myActions: [], recentlyUpdated: [],
      }),
    })
  })
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.getByText('Nothing planned for you.')).toBeVisible()
  await shoot(page, 'staff-dashboard', 'zero', 'Staff dashboard with every count at zero and empty lists', 'mocked')
  await page.unroute('**/api/dashboard/staff')

  // Loading: a slow answer, seen on a fresh load so no earlier data is on screen.
  await page.route('**/api/dashboard/staff', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000))
    await route.continue().catch(() => {})
  })
  await page.reload()
  await expect(page.getByText('Loading dashboard…')).toBeVisible()
  await shoot(page, 'staff-dashboard', 'loading', 'Loading state while the dashboard request is in flight', 'mocked')
  await page.unroute('**/api/dashboard/staff')

  // Failure: set the failing answer first, then load fresh, so the alert is not shown over old numbers.
  await page.route('**/api/dashboard/staff', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"INTERNAL_ERROR"}' }))
  await page.reload()
  await expect(page.getByText('Unable to load the dashboard.')).toBeVisible()
  await shoot(page, 'staff-dashboard', 'failure', 'Safe failure message with Retry, no technical detail', 'mocked')
  await page.unroute('**/api/dashboard/staff')

  const admin = morgan.page
  await nav(admin, 'Dashboard').click()
  await page.waitForLoadState('networkidle')
  await expect(admin.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  await shoot(admin, 'staff-dashboard', 'admin', 'Administrator view with the user counts strip', 'live')
})

test('requester dashboard', async ({ browser }) => {
  const { page } = sarah
  await nav(page, 'Dashboard').click()
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await shoot(page, 'requester-dashboard', 'loaded', 'Requester dashboard with live counts and lists', 'live')

  await page.getByRole('link', { name: /^Open tickets, / }).click()
  await expect(page.getByText(/^Showing: /)).toBeVisible()
  await page.waitForLoadState('networkidle')
  await shoot(page, 'requester-dashboard', 'drilldown', 'My Tickets opened from the Open tickets card, filter shown', 'live')

  await nav(page, 'Dashboard').click()
  await page.route('**/api/dashboard/requester', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000))
    await route.continue().catch(() => {})
  })
  await page.reload()
  await expect(page.getByText('Loading dashboard…')).toBeVisible()
  await shoot(page, 'requester-dashboard', 'loading', 'Loading state while the dashboard request is in flight', 'mocked')
  await page.unroute('**/api/dashboard/requester')

  await page.route('**/api/dashboard/requester', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"INTERNAL_ERROR"}' }))
  await page.reload()
  await expect(page.getByText('Unable to load the dashboard.')).toBeVisible()
  await shoot(page, 'requester-dashboard', 'failure', 'Safe failure message with Retry, no technical detail', 'mocked')
  await page.unroute('**/api/dashboard/requester')

  const empty = await session(browser, 'nina.brooks@toktickit.test')
  await expect(empty.page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  await shoot(empty.page, 'requester-dashboard', 'zero', 'Requester with no Tickets: zero counts and empty lists', 'live')
  await empty.context.close()
})

test('actions taken', async ({ browser }) => {
  const { page } = alex
  await openTicketByNumber(page, 'Ticket Queue', busy.ticketNumber)
  const section = page.getByRole('heading', { name: /^Actions Taken/ })
  await section.scrollIntoViewIfNeeded()
  await shoot(page, 'actions-taken', 'list', 'Four Actions on one Ticket: completed with follow-up, in progress, planned, cancelled', 'live')

  await page.getByRole('button', { name: 'Add action' }).click()
  await expect(page.getByRole('form', { name: 'Add action' })).toBeVisible()
  await shoot(page, 'actions-taken', 'create', 'Add action form', 'live')

  // An assignee chosen in the form (a different staff member from the creator).
  await page.getByLabel('Assigned to').selectOption({ label: 'Priya Nair' })
  await shoot(page, 'actions-taken', 'create-assigned', 'Add action form with another staff member chosen as assignee', 'live')

  await page.getByRole('form', { name: 'Add action' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Description must be 1-2000 characters.')).toBeVisible()
  await shoot(page, 'actions-taken', 'validation', 'Validation message under the field, focus on the first invalid field', 'live')

  await page.getByLabel('Description *').fill('Ask the vendor about the firmware.')
  await page.route('**/api/tickets/*/actions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    return route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ error: 'VALIDATION_FAILED', fields: { assigneeId: 'Assignee must be an active IT Staff or Administrator.' } }),
    })
  })
  await page.getByRole('form', { name: 'Add action' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Assignee must be an active IT Staff or Administrator.')).toBeVisible()
  await shoot(page, 'actions-taken', 'inactive-assignee', 'An inactive assignee is rejected with its message (server response replaced; ACT-03 proves the API)', 'mocked')
  await page.unroute('**/api/tickets/*/actions')
  await page.getByRole('form', { name: 'Add action' }).getByRole('button', { name: 'Cancel' }).click()

  // Start and Complete: a Planned Action is started, then completed (a Result is required).
  const plannedText = 'Replace the dock if the firmware does not help.'
  await page.getByRole('listitem').filter({ hasText: plannedText }).getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: plannedText }).getByText('In Progress')).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: plannedText }).getByRole('button', { name: 'Complete' }).click()
  await expect(page.getByLabel('Result *')).toBeVisible()
  await shoot(page, 'actions-taken', 'start-complete', 'Complete opens the form with Completed chosen and a required Result', 'live')
  await page.getByRole('form', { name: 'Edit action' }).getByRole('button', { name: 'Cancel' }).click()

  // Cancel asks for confirmation first.
  await page.getByRole('listitem').filter({ hasText: 'Test the dock with a second laptop.' }).getByRole('button', { name: 'Cancel action' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await shoot(page, 'actions-taken', 'cancel-confirm', 'Cancel action asks for confirmation before anything is sent', 'live')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keep action' }).click()

  // Edit, and a real conflict: Priya changes the same Action first through her own session.
  const card = page.getByRole('listitem').filter({ hasText: 'Test the dock with a second laptop.' })
  await card.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('form', { name: 'Edit action' })).toBeVisible()
  await shoot(page, 'actions-taken', 'edit', 'Edit action form for an In Progress Action', 'live')

  const actions = (await (await priya.page.request.get(`/api/tickets/${busy.id}/actions`)).json()) as Array<{ id: number; version: number; description: string }>
  const target = actions.find((action) => action.description.startsWith('Test the dock'))!
  await priya.call('patch', `/api/tickets/${busy.id}/actions/${target.id}`, { version: target.version, description: 'Test the dock with a second laptop and a spare cable.' })
  await page.getByLabel('Description *').fill('My edit made at the same time.')
  await page.getByRole('form', { name: 'Edit action' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('This action was changed by someone else. Reload to see the latest.')).toBeVisible()
  await shoot(page, 'actions-taken', 'conflict', 'Stale edit: conflict message with Reload, typed text kept', 'live')

  await openTicketByNumber(page, 'Ticket Queue', blocked.ticketNumber)
  await page.getByLabel('Current Status').selectOption('RESOLVED')
  await expect(page.getByText('This ticket cannot be resolved yet.')).toBeVisible()
  await shoot(page, 'actions-taken', 'resolution-blocked', 'Resolve refused while an Action is still planned, blocker lines shown', 'live')

  // Allowed next statuses and the append-only History, for staff and for the Requester (handout part 7).
  await page.getByLabel('Current Status').focus()
  await shoot(page, 'actions-taken', 'status-options', 'Only the permitted next statuses are offered', 'live')
  await page.getByText('History', { exact: true }).click()
  await expect(page.getByText('Created as New')).toBeVisible()
  await shoot(page, 'actions-taken', 'history-staff', 'History list, oldest first, with who and when', 'live')

  await openTicketByNumber(page, 'Ticket Queue', closed.ticketNumber)
  await expect(page.getByText('This ticket is closed, so actions can no longer be changed.')).toBeVisible()
  await shoot(page, 'actions-taken', 'locked', 'Closed Ticket: Actions can no longer be changed', 'live')

  const requester = sarah.page
  await openTicketByNumber(requester, 'My Tickets', busy.ticketNumber)
  await expect(requester.getByRole('button', { name: 'Add action' })).toHaveCount(0)
  await shoot(requester, 'actions-taken', 'requester-readonly', 'Requester sees the same Actions with no controls', 'live')
  await requester.getByText('History', { exact: true }).click()
  await shoot(requester, 'actions-taken', 'history-requester', 'The Requester can read the History of their own Ticket', 'live')
  void browser
})

test('regression screens from Labs 1 to 3', async ({ browser }) => {
  const anonymous = await browser.newContext()
  const loginPage = await anonymous.newPage()
  await loginPage.goto('/')
  await expect(loginPage.getByLabel('Email *')).toBeVisible()
  await shoot(loginPage, 'regression', 'login', 'Login screen', 'live', TWO_SIZES)
  await anonymous.close()

  const requester = sarah.page
  await nav(requester, 'My Tickets').click()
  await requester.waitForLoadState('networkidle')
  await shoot(requester, 'regression', 'my-tickets', 'My Tickets list', 'live', TWO_SIZES)
  await openTicketByNumber(requester, 'My Tickets', busy.ticketNumber)
  await shoot(requester, 'regression', 'ticket-detail', 'Requester Ticket Detail', 'live', TWO_SIZES)
  await requester.getByRole('heading', { name: 'Attachments' }).scrollIntoViewIfNeeded()
  await shoot(requester, 'regression', 'attachments', 'Attachments panel', 'live', TWO_SIZES)
  await requester.getByRole('heading', { name: 'Comments' }).scrollIntoViewIfNeeded()
  await shoot(requester, 'regression', 'comments', 'Public Comments', 'live', TWO_SIZES)

  const staff = alex.page
  await nav(staff, 'Ticket Queue').click()
  await staff.waitForLoadState('networkidle')
  await shoot(staff, 'regression', 'staff-queue', 'IT Staff Ticket Queue', 'live', TWO_SIZES)
  await openTicketByNumber(staff, 'Ticket Queue', busy.ticketNumber)
  await staff.getByRole('heading', { name: 'Internal Notes' }).scrollIntoViewIfNeeded()
  await shoot(staff, 'regression', 'internal-notes', 'Internal Notes, visible to staff only', 'live', TWO_SIZES)

  const admin = morgan.page
  await nav(admin, 'User Management').click()
  await expect(admin.getByRole('heading', { name: 'Users' })).toBeVisible()
  await shoot(admin, 'regression', 'user-management', 'Administrator user management', 'live', TWO_SIZES)
})
