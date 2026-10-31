import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Priority, TicketStatus } from '@prisma/client'
import { ACTIVE_STATUSES, TICKET_STATUSES } from '@toktickit/shared'
import { app } from '../helpers/app.js'
import { prisma } from '../../src/prisma.js'
import { createDashboardService } from '../../src/dashboard/dashboard-service.js'
import { loginAsNewUser } from '../helpers/users.js'
import { addActionRow, createTicketRow } from '../helpers/tickets.js'
import { MigrationSandbox, migrationNames } from '../helpers/migration-sandbox.js'

type Actor = Awaited<ReturnType<typeof loginAsNewUser>>
const get = (actor: Actor) => actor.agent.get('/api/dashboard/staff')
const active = { currentStatus: { in: [...ACTIVE_STATUSES] as TicketStatus[] } }
const byKey = (cards: Array<{ key: string; count: number }>) => Object.fromEntries(cards.map((card) => [card.key, card.count]))

let requester: Actor
let staff: Actor
let admin: Actor

beforeAll(async () => {
  ;[requester, staff, admin] = await Promise.all([loginAsNewUser('REQUESTER'), loginAsNewUser('IT_STAFF'), loginAsNewUser('ADMINISTRATOR')])
  await createTicketRow({ requesterId: requester.userId, status: 'NEW' })
  await createTicketRow({ requesterId: requester.userId, status: 'IN_PROGRESS', ownerId: staff.userId, itPriority: 'HIGH' })
  await createTicketRow({ requesterId: requester.userId, status: 'IN_PROGRESS', ownerId: staff.userId, requesterResolvedAt: new Date() })
  await createTicketRow({ requesterId: requester.userId, status: 'RESOLVED', ownerId: staff.userId, requesterResolvedAt: new Date() })
  await createTicketRow({ requesterId: requester.userId, status: 'CLOSED' })
  await createTicketRow({ requesterId: requester.userId, status: 'CANCELLED' })
}, 90_000)

describe('Staff dashboard (SD-01 to SD-03, SD-05 to SD-07, SD-09)', () => {
  it('SD-01 every card, byStatus and byItPriority equals a direct query', async () => {
    const response = await get(staff)
    expect(response.status).toBe(200)

    const ticketCount = (where: object) => prisma.ticket.count({ where })
    const cards = byKey(response.body.cards)
    expect(cards.unassigned).toBe(await ticketCount({ ...active, ticketOwnerId: null }))
    expect(cards.mine).toBe(await ticketCount({ ...active, ticketOwnerId: staff.userId }))
    expect(cards['reported-resolved']).toBe(await ticketCount({ ...active, requesterResolvedAt: { not: null } }))
    expect(cards['my-open-actions']).toBe(await prisma.actionTaken.count({ where: { assigneeId: staff.userId, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }))

    expect(response.body.byStatus.map((row: { status: string }) => row.status)).toEqual([...TICKET_STATUSES])
    for (const row of response.body.byStatus) {
      expect(row.count, row.status).toBe(await ticketCount({ currentStatus: row.status }))
    }
    expect(response.body.byItPriority.map((row: { priority: string }) => row.priority)).toEqual(['LOW', 'MEDIUM', 'HIGH'])
    for (const row of response.body.byItPriority) {
      expect(row.count, row.priority).toBe(await ticketCount({ ...active, itPriority: row.priority as Priority }))
    }
  })

  it('SD-02 only an Administrator receives user counts', async () => {
    const asAdmin = await get(admin)
    expect(asAdmin.status).toBe(200)
    const users = asAdmin.body.users
    expect(users.active).toBe(await prisma.user.count({ where: { isActive: true } }))
    expect(users.inactive).toBe(await prisma.user.count({ where: { isActive: false } }))
    expect(users.byRole.REQUESTER).toBe(await prisma.user.count({ where: { role: 'REQUESTER' } }))
    expect(users.byRole.IT_STAFF + users.byRole.ADMINISTRATOR + users.byRole.REQUESTER).toBe(users.active + users.inactive)

    const asStaff = await get(staff)
    expect('users' in asStaff.body).toBe(false)
  })

  it('SD-03 refuses a Requester (403) and an anonymous caller (401)', async () => {
    expect((await get(requester)).status).toBe(403)
    expect((await request(app).get('/api/dashboard/staff')).status).toBe(401)
  })

  it('SD-05 every drill-down returns exactly as many Tickets as its count', async () => {
    const response = await get(staff)
    const targets = [
      ...response.body.cards.map((card: { key: string; count: number; drillDown: { query: Record<string, string> } | null }) => ({ name: card.key, count: card.count, drillDown: card.drillDown })),
      ...response.body.byStatus.map((row: { status: string; count: number; drillDown: unknown }) => ({ name: row.status, count: row.count, drillDown: row.drillDown })),
      ...response.body.byItPriority.map((row: { priority: string; count: number; drillDown: unknown }) => ({ name: row.priority, count: row.count, drillDown: row.drillDown })),
    ] as Array<{ name: string; count: number; drillDown: { view: string; query: Record<string, string> } | null }>

    for (const target of targets) {
      if (target.name === 'my-open-actions') {
        expect(target.drillDown).toBeNull()
        continue
      }
      expect(target.drillDown?.view).toBe('ticket-queue')
      const list = await staff.agent.get(`/api/tickets?${new URLSearchParams(target.drillDown!.query).toString()}&pageSize=1`)
      expect(list.status, target.name).toBe(200)
      expect(list.body.meta.totalItems, target.name).toBe(target.count)
    }
  })

  it('SD-06 myActions lists only the caller’s Planned and In Progress Actions, soonest first, at most 5', async () => {
    const me = await loginAsNewUser('IT_STAFF')
    const someone = await loginAsNewUser('IT_STAFF')
    const ticket = await createTicketRow({ requesterId: requester.userId, status: 'IN_PROGRESS' })
    for (let i = 0; i < 6; i += 1) {
      await prisma.actionTaken.create({
        data: { ticketId: ticket.id, createdById: me.userId, assigneeId: me.userId, actionAt: new Date(Date.now() + (6 - i) * 3_600_000), description: `Mine ${i} ${'x'.repeat(100)}`, status: i % 2 === 0 ? 'PLANNED' : 'IN_PROGRESS' },
      })
    }
    await addActionRow(ticket.id, me.userId, 'COMPLETED')
    await addActionRow(ticket.id, someone.userId, 'PLANNED')

    const response = await get(me)
    expect(byKey(response.body.cards)['my-open-actions']).toBe(6)
    expect(response.body.myActions).toHaveLength(5)
    const times = response.body.myActions.map((item: { actionAt: string }) => new Date(item.actionAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
    for (const item of response.body.myActions) {
      expect(['PLANNED', 'IN_PROGRESS']).toContain(item.status)
      expect(item.description.length).toBeLessThanOrEqual(80)
      expect(Object.keys(item).sort()).toEqual(['actionAt', 'actionId', 'description', 'status', 'ticketId', 'ticketNumber'])
    }
  })

  it('SD-07 reported-resolved counts only active Tickets with the indication', async () => {
    const response = await get(staff)
    const expected = await prisma.ticket.count({ where: { ...active, requesterResolvedAt: { not: null } } })
    expect(byKey(response.body.cards)['reported-resolved']).toBe(expected)
    const resolvedWithIndication = await prisma.ticket.count({ where: { currentStatus: 'RESOLVED', requesterResolvedAt: { not: null } } })
    expect(resolvedWithIndication).toBeGreaterThan(0)
  })

  it('SD-09 Resolved, Closed and Cancelled are excluded from unassigned and mine', async () => {
    const response = await get(staff)
    const cards = byKey(response.body.cards)
    expect(cards.unassigned).toBe(await prisma.ticket.count({ where: { ticketOwnerId: null, currentStatus: { in: ['NEW', 'OPEN', 'REOPENED', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER'] } } }))
    expect(cards.mine).toBe(2)
    expect(response.body.recentlyUpdated.length).toBeLessThanOrEqual(5)
    for (const item of response.body.recentlyUpdated) {
      expect(['NEW', 'OPEN', 'REOPENED', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER']).toContain(item.currentStatus)
      expect(Object.keys(item).sort()).toEqual(['currentStatus', 'id', 'summary', 'ticketNumber', 'ticketOwnerName', 'updatedAt'])
    }
  })
})

describe('Staff dashboard on a clean schema and on about 300 Tickets (SD-04, SD-08)', () => {
  let sandbox: MigrationSandbox

  beforeAll(async () => {
    sandbox = await MigrationSandbox.create()
    sandbox.deploy(migrationNames())
  }, 180_000)

  afterAll(async () => {
    await sandbox.dispose()
  })

  it('SD-04 an empty database gives zeros, 8 status rows at 0, and empty lists', async () => {
    const db = sandbox.client
    const user = await db.user.create({ data: { email: 'clean.admin@mig.test', name: 'Clean Admin', passwordHash: 'x', role: 'ADMINISTRATOR' } })
    const result = await createDashboardService(db).staff(user.id, 'ADMINISTRATOR')

    expect(result.cards.map((card) => card.count)).toEqual([0, 0, 0, 0])
    expect(result.byStatus).toHaveLength(8)
    expect(result.byStatus.every((row) => row.count === 0)).toBe(true)
    expect(result.byItPriority.map((row) => row.count)).toEqual([0, 0, 0])
    expect(result.myActions).toEqual([])
    expect(result.recentlyUpdated).toEqual([])
    expect('users' in result && result.users).toMatchObject({ active: 1, inactive: 0 })
  })

  it('SD-08 answers in under one second with about 300 Tickets', async () => {
    const db = sandbox.client
    const owner = await db.user.create({ data: { email: 'perf.staff@mig.test', name: 'Perf Staff', passwordHash: 'x', role: 'IT_STAFF' } })
    const category = await db.category.create({ data: { name: 'Perf Category' } })
    const system = await db.relatedSystem.create({ data: { name: 'Perf System' } })
    const statuses: TicketStatus[] = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED']
    await db.ticket.createMany({
      data: Array.from({ length: 300 }, (_, i) => ({
        ticketNumber: `SPERF-${i}`, requesterId: owner.id, ticketOwnerId: i % 3 === 0 ? owner.id : null, categoryId: category.id,
        relatedSystemId: system.id, summary: `Perf ticket ${i}`, description: 'Performance fixture.', requestedPriority: 'MEDIUM' as const,
        itPriority: (['LOW', 'MEDIUM', 'HIGH'] as const)[i % 3], currentStatus: statuses[i % statuses.length],
      })),
    })
    const started = performance.now()
    const result = await createDashboardService(db).staff(owner.id, 'IT_STAFF')
    expect(performance.now() - started).toBeLessThan(1000)
    expect(result.byStatus.reduce((sum, row) => sum + row.count, 0)).toBe(300)
  })
})
