import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { TicketStatus } from '@prisma/client'
import { ACTIVE_STATUSES } from '@toktickit/shared'
import { app } from '../helpers/app.js'
import { prisma } from '../../src/prisma.js'
import { createDashboardService } from '../../src/dashboard/dashboard-service.js'
import { loginAsNewUser } from '../helpers/users.js'
import { createTicketRow } from '../helpers/tickets.js'
import { MigrationSandbox, migrationNames } from '../helpers/migration-sandbox.js'

const DAY = 86_400_000
type Actor = Awaited<ReturnType<typeof loginAsNewUser>>
const get = (actor: Actor) => actor.agent.get('/api/dashboard/requester')
const byKey = (cards: Array<{ key: string; count: number }>) => Object.fromEntries(cards.map((card) => [card.key, card.count]))

async function fill(actor: Actor, plan: Array<[TicketStatus, number]>) {
  for (const [status, count] of plan) for (let i = 0; i < count; i += 1) await createTicketRow({ requesterId: actor.userId, status })
}

describe('Requester dashboard (RD-01 to RD-07, RD-09)', () => {
  it('RD-01 each card equals a direct database query', async () => {
    const me = await loginAsNewUser('REQUESTER')
    await fill(me, [['NEW', 1], ['OPEN', 1], ['REOPENED', 1], ['IN_PROGRESS', 2], ['WAITING_FOR_REQUESTER', 1], ['RESOLVED', 2], ['CLOSED', 1], ['CANCELLED', 1]])

    const response = await get(me)
    expect(response.status).toBe(200)
    expect(response.body.windowDays).toBe(7)
    expect(typeof response.body.generatedAt).toBe('string')

    const count = (statuses: readonly string[]) => prisma.ticket.count({ where: { requesterId: me.userId, currentStatus: { in: statuses as TicketStatus[] } } })
    const cards = byKey(response.body.cards)
    expect(cards).toEqual({
      open: await count(ACTIVE_STATUSES),
      'in-progress': await count(['IN_PROGRESS']),
      waiting: await count(['WAITING_FOR_REQUESTER']),
      resolved: await count(['RESOLVED']),
    })
    expect(cards).toEqual({ open: 6, 'in-progress': 2, waiting: 1, resolved: 2 })
  })

  it('RD-02 never counts or lists another Requester’s Tickets', async () => {
    const me = await loginAsNewUser('REQUESTER')
    const other = await loginAsNewUser('REQUESTER')
    await fill(other, [['OPEN', 3], ['RESOLVED', 2]])
    await createTicketRow({ requesterId: other.userId, status: 'RESOLVED', history: [{ from: null, to: 'RESOLVED', at: new Date() }] })

    const response = await get(me)
    expect(byKey(response.body.cards)).toEqual({ open: 0, 'in-progress': 0, waiting: 0, resolved: 0 })
    expect(response.body.recentlyUpdated).toEqual([])
    expect(response.body.recentlyResolved).toEqual([])
  })

  it('RD-03 lists have at most 5 items with only the documented fields, newest first', async () => {
    const me = await loginAsNewUser('REQUESTER')
    for (let i = 0; i < 7; i += 1) {
      await createTicketRow({ requesterId: me.userId, status: 'OPEN', updatedAt: new Date(Date.now() - i * 3_600_000) })
    }
    const response = await get(me)
    expect(response.body.recentlyUpdated).toHaveLength(5)
    for (const item of response.body.recentlyUpdated) {
      expect(Object.keys(item).sort()).toEqual(['currentStatus', 'id', 'summary', 'ticketNumber', 'updatedAt'])
    }
    const times = response.body.recentlyUpdated.map((item: { updatedAt: string }) => new Date(item.updatedAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('RD-04 recently resolved follows the 7-day window, includes Closed, and drops a reopened Ticket', async () => {
    const me = await loginAsNewUser('REQUESTER')
    const now = Date.now()
    const inside = await createTicketRow({ requesterId: me.userId, status: 'RESOLVED', history: [{ from: 'IN_PROGRESS', to: 'RESOLVED', at: new Date(now - 6 * DAY) }] })
    const outside = await createTicketRow({ requesterId: me.userId, status: 'RESOLVED', history: [{ from: 'IN_PROGRESS', to: 'RESOLVED', at: new Date(now - 8 * DAY) }] })
    const closed = await createTicketRow({
      requesterId: me.userId,
      status: 'CLOSED',
      history: [
        { from: 'IN_PROGRESS', to: 'RESOLVED', at: new Date(now - 2 * DAY) },
        { from: 'RESOLVED', to: 'CLOSED', at: new Date(now - 1 * DAY) },
      ],
    })
    const reopened = await createTicketRow({
      requesterId: me.userId,
      status: 'REOPENED',
      history: [
        { from: 'IN_PROGRESS', to: 'RESOLVED', at: new Date(now - 3 * DAY) },
        { from: 'RESOLVED', to: 'REOPENED', at: new Date(now - 2 * DAY) },
      ],
    })

    const listed = (await get(me)).body.recentlyResolved as Array<{ id: number; resolvedAt: string }>
    const found = listed.map((item) => item.id)
    expect(found).toContain(inside.id)
    expect(found).toContain(closed.id)
    expect(found).not.toContain(outside.id)
    expect(found).not.toContain(reopened.id)
    expect(found[0]).toBe(closed.id)
    expect(Object.keys(listed[0]).sort()).toEqual(['currentStatus', 'id', 'resolvedAt', 'summary', 'ticketNumber'])
  })

  it('RD-05 a Requester with no Tickets sees zeros and empty lists', async () => {
    const me = await loginAsNewUser('REQUESTER')
    const response = await get(me)
    expect(byKey(response.body.cards)).toEqual({ open: 0, 'in-progress': 0, waiting: 0, resolved: 0 })
    expect(response.body.recentlyUpdated).toEqual([])
    expect(response.body.recentlyResolved).toEqual([])
  })

  it('RD-06 refuses IT Staff and Administrator (403) and an anonymous caller (401)', async () => {
    for (const role of ['IT_STAFF', 'ADMINISTRATOR'] as const) {
      const actor = await loginAsNewUser(role)
      expect((await get(actor)).status).toBe(403)
    }
    expect((await request(app).get('/api/dashboard/requester')).status).toBe(401)
  })

  it('RD-07 every card’s drill-down returns exactly as many Tickets as the card shows', async () => {
    const me = await loginAsNewUser('REQUESTER')
    await fill(me, [['NEW', 2], ['IN_PROGRESS', 2], ['WAITING_FOR_REQUESTER', 1], ['RESOLVED', 3], ['CLOSED', 1]])
    const response = await get(me)
    for (const card of response.body.cards) {
      expect(card.drillDown.view).toBe('my-tickets')
      const list = await me.agent.get(`/api/tickets?${new URLSearchParams(card.drillDown.query).toString()}&pageSize=50`)
      expect(list.body.meta.totalItems, card.key).toBe(card.count)
    }
  })

  it('RD-09 counts a legacy Ticket that has only its baseline history row like any other', async () => {
    const me = await loginAsNewUser('REQUESTER')
    const legacy = await createTicketRow({ requesterId: me.userId, status: 'RESOLVED', history: [{ from: null, to: 'RESOLVED', at: new Date(Date.now() - DAY) }] })
    const response = await get(me)
    expect(byKey(response.body.cards).resolved).toBe(1)
    expect(response.body.recentlyResolved.map((item: { id: number }) => item.id)).toEqual([legacy.id])
  })
})

describe('Requester dashboard on about 300 Tickets (RD-08, AC-L4-33)', () => {
  let sandbox: MigrationSandbox
  let requesterId: number

  beforeAll(async () => {
    sandbox = await MigrationSandbox.create()
    sandbox.deploy(migrationNames())
    const db = sandbox.client
    const user = await db.user.create({ data: { email: 'perf.requester@mig.test', name: 'Perf Requester', passwordHash: 'x', role: 'REQUESTER' } })
    requesterId = user.id
    const category = await db.category.create({ data: { name: 'Perf Category' } })
    const system = await db.relatedSystem.create({ data: { name: 'Perf System' } })
    const statuses: TicketStatus[] = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED']
    await db.ticket.createMany({
      data: Array.from({ length: 300 }, (_, i) => ({
        ticketNumber: `PERF-${i}`, requesterId, categoryId: category.id, relatedSystemId: system.id,
        summary: `Perf ticket ${i}`, description: 'Performance fixture.', requestedPriority: 'MEDIUM' as const,
        itPriority: 'MEDIUM' as const, currentStatus: statuses[i % statuses.length],
      })),
    })
    const tickets = await db.ticket.findMany({ where: { currentStatus: 'RESOLVED' }, select: { id: true } })
    await db.ticketStatusHistory.createMany({ data: tickets.map((ticket) => ({ ticketId: ticket.id, fromStatus: 'IN_PROGRESS' as const, toStatus: 'RESOLVED' as const })) })
  }, 180_000)

  afterAll(async () => {
    await sandbox.dispose()
  })

  it('RD-08 answers in under one second', async () => {
    const service = createDashboardService(sandbox.client)
    const started = performance.now()
    const result = await service.requester(requesterId)
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(1000)
    // 300 Tickets over 8 statuses: 37 or 38 each, and five statuses are active.
    expect(byKey(result.cards).open).toBeGreaterThan(150)
    expect(byKey(result.cards).resolved).toBeGreaterThanOrEqual(37)
    expect(result.recentlyUpdated).toHaveLength(5)
  })
})
