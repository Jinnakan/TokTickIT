import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// RESP4-01, A11Y4-01, A11Y4-02, AC-L4-29, AC-L4-32: every role's screens at
// three widths have no horizontal overflow, no serious or critical
// accessibility violations, and no console errors; the keyboard reaches every
// control in order with a visible focus indicator.

const WIDTHS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
]

const ROLES = [
  { name: 'requester', email: 'sarah.johnson@toktickit.test', screens: ['Dashboard', 'My Tickets', 'Create Ticket'], listScreen: 'My Tickets' },
  { name: 'staff', email: 'alex.rivera@toktickit.test', screens: ['Dashboard', 'Ticket Queue'], listScreen: 'Ticket Queue' },
  { name: 'administrator', email: 'morgan.kim@toktickit.test', screens: ['Dashboard', 'Ticket Queue', 'User Management'], listScreen: null },
]

/** The pre-login session check answers 401 once; Chrome logs it as a console error. */
const isExpectedNoise = (url: string) => url.endsWith('/api/auth/me')

function watchConsole(page: Page) {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !isExpectedNoise(message.location().url)) problems.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  return problems
}

async function login(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email *').fill(email)
  await page.getByLabel('Password *').fill('DevPass123!')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
}

/** Navigation buttons live in the header; the screens have their own buttons with the same words. */
const nav = (page: Page, name: string) => page.locator('header').getByRole('button', { name, exact: true })

async function expectNoOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(0)
}

async function expectNoSeriousViolations(page: Page, where: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  const summary = blocking.map(
    (violation) => `${violation.id} (${violation.impact}): ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ')}`,
  )
  expect(summary, `accessibility on ${where}`).toEqual([])
}

async function openFirstTicket(page: Page) {
  await page.locator('text=/^TKT-\\d{4}-\\d+$/').locator('visible=true').first().click()
  await expect(page.getByRole('heading', { name: /Ticket TKT-/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

for (const role of ROLES) {
  for (const size of WIDTHS) {
    test(`RESP4-01 and axe: ${role.name} screens at ${size.name}px`, async ({ page }) => {
      const problems = watchConsole(page)
      await page.setViewportSize({ width: size.width, height: size.height })
      await login(page, role.email)

      for (const screen of role.screens) {
        await nav(page, screen).click()
        await page.waitForLoadState('networkidle')
        await expectNoOverflow(page, `${role.name} ${screen} ${size.name}`)
        await expectNoSeriousViolations(page, `${role.name} ${screen} ${size.name}`)
      }

      if (role.listScreen) {
        await nav(page, role.listScreen).click()
        await page.waitForLoadState('networkidle')
        await openFirstTicket(page)
        await expectNoOverflow(page, `${role.name} Ticket Detail ${size.name}`)
        await expectNoSeriousViolations(page, `${role.name} Ticket Detail ${size.name}`)

        if (role.name === 'staff') {
          await expect(page.getByRole('heading', { name: /^Actions Taken \(\d+\)$/ })).toBeVisible()
          const add = page.getByRole('button', { name: 'Add action' })
          if (await add.isVisible()) {
            await add.click()
            await expect(page.getByRole('form', { name: 'Add action' })).toBeVisible()
            await expectNoOverflow(page, `staff Action form ${size.name}`)
            await expectNoSeriousViolations(page, `staff Action form ${size.name}`)
          }
        }
      }

      expect(problems, `console errors for ${role.name} at ${size.name}`).toEqual([])
    })
  }
}

type Stop = { tag: string; name: string; indicator: boolean }

/**
 * Tab through the page. For each element that took focus, the indicator is
 * whether its outline or shadow differs while focused from the same element
 * after focus has moved on (measured later, so the walk never disturbs focus;
 * a date field has several inner tab stops that a blur and focus would reset).
 */
async function walk(page: Page, steps: number): Promise<Stop[]> {
  // Start from a known place: the first navigation button, so the order does not depend on where a click left focus.
  await page.locator('header').getByRole('button').first().focus()
  await page.evaluate(() => {
    ;(window as unknown as { __walk: unknown }).__walk = null
  })

  const stops: Stop[] = []
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab')
    const left = await page.evaluate(() => {
      const state = window as unknown as { __walk: { element: HTMLElement; focused: string; tag: string; name: string } | null }
      const look = (element: HTMLElement) => {
        const style = getComputedStyle(element)
        return `${style.outlineStyle}|${style.outlineWidth}|${style.outlineColor}|${style.boxShadow}`
      }
      const current = document.activeElement as HTMLElement
      let finished: { tag: string; name: string; indicator: boolean } | null = null
      if (state.__walk && state.__walk.element !== current) {
        finished = { tag: state.__walk.tag, name: state.__walk.name, indicator: look(state.__walk.element) !== state.__walk.focused }
      }
      if (!state.__walk || state.__walk.element !== current) {
        current.setAttribute('data-walked', '1')
        state.__walk = {
          element: current,
          focused: look(current),
          tag: current.tagName.toLowerCase(),
          name: (current.getAttribute('aria-label') ?? current.textContent ?? '').trim().slice(0, 60),
        }
      }
      return finished
    })
    if (left) stops.push(left)
  }
  return stops
}

function expectEveryStopShowsFocus(stops: Stop[], where: string) {
  const without = stops.filter((stop) => !stop.indicator && stop.tag !== 'body')
  expect(without.map((stop) => `${stop.tag}: ${stop.name}`), `focused elements with no visible change on ${where}`).toEqual([])
}

test.describe('A11Y4-01 keyboard walk', () => {
  test('Staff Dashboard: navigation first, then the cards and rows, each with a focus indicator', async ({ page }) => {
    await login(page, 'alex.rivera@toktickit.test')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    await page.waitForLoadState('networkidle')

    const stops = await walk(page, 24)
    const firstCardAt = stops.findIndex((stop) => stop.tag === 'a')
    const navAt = stops.findIndex((stop) => stop.name === 'Ticket Queue')
    expect(navAt, 'navigation is reached before the first card').toBeGreaterThanOrEqual(0)
    expect(navAt).toBeLessThan(firstCardAt)
    expect(stops.filter((stop) => stop.tag === 'a').length, 'cards and breakdown rows are reachable').toBeGreaterThanOrEqual(10)
    expectEveryStopShowsFocus(stops, 'the Staff Dashboard')
  })

  test('Requester Dashboard: cards, rows and quick actions are reachable with a focus indicator', async ({ page }) => {
    await login(page, 'sarah.johnson@toktickit.test')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    await page.waitForLoadState('networkidle')

    const stops = await walk(page, 20)
    expect(stops.filter((stop) => stop.tag === 'a').length, 'the four cards are reachable').toBeGreaterThanOrEqual(4)
    expect(stops.some((stop) => stop.name === 'Create Ticket')).toBe(true)
    expectEveryStopShowsFocus(stops, 'the Requester Dashboard')
  })

  test('Staff Ticket Detail with the Action form open: every control is reachable with a focus indicator', async ({ page }) => {
    await login(page, 'alex.rivera@toktickit.test')
    await nav(page, 'Ticket Queue').click()
    await page.waitForLoadState('networkidle')
    await openFirstTicket(page)
    await expect(page.getByRole('heading', { name: /^Actions Taken \(\d+\)$/ })).toBeVisible()
    const add = page.getByRole('button', { name: 'Add action' })
    if (await add.isVisible()) await add.click()
    await expect(page.getByRole('form', { name: 'Add action' })).toBeVisible()

    const stops = await walk(page, 45)
    const visited = await page.evaluate(() => document.querySelectorAll('[data-walked]').length)
    expect(visited, 'focus keeps moving through different elements instead of getting stuck').toBeGreaterThan(15)
    expectEveryStopShowsFocus(stops, 'Ticket Detail')
  })
})
