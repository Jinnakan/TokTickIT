import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import type { TicketStatus } from '@prisma/client'
import { app } from '../helpers/app.js'
import { prisma } from '../../src/prisma.js'
import { loginAsNewUser } from '../helpers/users.js'
import { addActionRow, createTicketVia, setTicketStatus, versionOf } from '../helpers/tickets.js'

type Actor = Awaited<ReturnType<typeof loginAsNewUser>>
let requester: Actor
let otherRequester: Actor
let staff: Actor
let otherStaff: Actor

const url = (id: number, part: string) => `/api/tickets/${id}/${part}`
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function ticketAt(status: TicketStatus = 'NEW'): Promise<number> {
  const ticket = await createTicketVia(requester.agent)
  if (status !== 'NEW') await setTicketStatus(ticket.id, status)
  return ticket.id
}

async function move(actor: Actor, ticketId: number, status: string) {
  return actor.agent.patch(url(ticketId, 'status')).send({ status, expectedVersion: await versionOf(ticketId) })
}

beforeAll(async () => {
  ;[requester, otherRequester, staff, otherStaff] = await Promise.all([
    loginAsNewUser('REQUESTER'),
    loginAsNewUser('REQUESTER'),
    loginAsNewUser('IT_STAFF'),
    loginAsNewUser('IT_STAFF'),
  ])
}, 60_000)

const MATRIX: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
}
const ALL = Object.keys(MATRIX) as TicketStatus[]

describe('Status transitions (WF-01, WF-02, AC-L4-14)', () => {
  it('WF-01 accepts every allowed transition, bumps the version, and writes a history row', async () => {
    for (const from of ALL) {
      for (const to of MATRIX[from]) {
        const id = await ticketAt(from)
        if (to === 'RESOLVED') await addActionRow(id, staff.userId, 'COMPLETED')
        const before = await versionOf(id)

        const response = await staff.agent.patch(url(id, 'status')).send({ status: to, expectedVersion: before })

        expect(response.status, `${from} -> ${to}`).toBe(200)
        expect(response.body).toMatchObject({ currentStatus: to, version: before + 1 })
        const rows = await prisma.ticketStatusHistory.findMany({ where: { ticketId: id }, orderBy: { id: 'desc' }, take: 1 })
        expect(rows[0]).toMatchObject({ fromStatus: from, toStatus: to, changedById: staff.userId })
      }
    }
  }, 120_000)

  it('WF-02 refuses every other pair with INVALID_TRANSITION and the allowed list', async () => {
    for (const from of ALL) {
      const id = await ticketAt(from)
      for (const to of ALL.filter((candidate) => !MATRIX[from].includes(candidate))) {
        const before = await versionOf(id)
        const response = await staff.agent.patch(url(id, 'status')).send({ status: to, expectedVersion: before })
        expect(response.status, `${from} -> ${to}`).toBe(409)
        expect(response.body).toEqual({ error: 'INVALID_TRANSITION', from, to, allowed: MATRIX[from] })
        expect(await versionOf(id)).toBe(before)
      }
    }
  }, 120_000)

  it('refuses an unknown status value the same way', async () => {
    const id = await ticketAt('NEW')
    const response = await staff.agent.patch(url(id, 'status')).send({ status: 'DONE', expectedVersion: await versionOf(id) })
    expect(response.status).toBe(409)
    expect(response.body.error).toBe('INVALID_TRANSITION')
  })
})

describe('Resolution gate (WF-03, WF-04, AC-L4-12)', () => {
  it('WF-03 reports each blocker', async () => {
    const none = await ticketAt('IN_PROGRESS')
    const noActions = await move(staff, none, 'RESOLVED')
    expect(noActions.status).toBe(409)
    expect(noActions.body).toEqual({ error: 'RESOLUTION_BLOCKED', blockers: [{ code: 'NO_COMPLETED_ACTION' }] })

    const open = await ticketAt('IN_PROGRESS')
    await addActionRow(open, staff.userId, 'COMPLETED')
    await addActionRow(open, staff.userId, 'PLANNED')
    await addActionRow(open, staff.userId, 'IN_PROGRESS')
    expect((await move(staff, open, 'RESOLVED')).body.blockers).toEqual([{ code: 'ACTIONS_STILL_OPEN', count: 2 }])

    const followUp = await ticketAt('IN_PROGRESS')
    await addActionRow(followUp, staff.userId, 'COMPLETED', { followUpRequired: true })
    expect((await move(staff, followUp, 'RESOLVED')).body.blockers).toEqual([{ code: 'FOLLOW_UP_OPEN', count: 1 }])

    expect(await prisma.ticket.count({ where: { id: { in: [none, open, followUp] }, currentStatus: 'RESOLVED' } })).toBe(0)
  })

  it('WF-04 resolves once the blockers are cleared, and ignores a follow-up on a Cancelled Action', async () => {
    const id = await ticketAt('IN_PROGRESS')
    const completed = await addActionRow(id, staff.userId, 'COMPLETED', { followUpRequired: true })
    expect((await move(staff, id, 'RESOLVED')).status).toBe(409)

    await prisma.actionTaken.update({ where: { id: completed.id }, data: { followUpDoneAt: new Date() } })
    await addActionRow(id, staff.userId, 'CANCELLED', { followUpRequired: true })
    const resolved = await move(staff, id, 'RESOLVED')
    expect(resolved.status).toBe(200)
    expect(resolved.body.currentStatus).toBe('RESOLVED')
  })

  it('WF-14 a status change waits for the Ticket lock, then sees an Action added by the lock holder', async () => {
    const id = await ticketAt('IN_PROGRESS')
    await addActionRow(id, staff.userId, 'COMPLETED')
    const version = await versionOf(id)

    let release: () => void = () => {}
    let acquired: () => void = () => {}
    const lockTaken = new Promise<void>((resolve) => { acquired = resolve })
    const held = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`
        acquired()
        await new Promise<void>((resolve) => { release = resolve })
        await tx.actionTaken.create({
          data: { ticketId: id, createdById: otherStaff.userId, assigneeId: otherStaff.userId, actionAt: new Date(), description: 'Added under the lock', status: 'PLANNED' },
        })
      },
      { timeout: 20_000 },
    )
    await lockTaken

    let settled = false
    const resolving = staff.agent.patch(url(id, 'status')).send({ status: 'RESOLVED', expectedVersion: version }).then((r) => {
      settled = true
      return r
    })
    await sleep(500)
    expect(settled).toBe(false)

    release()
    await held
    const response = await resolving
    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'RESOLUTION_BLOCKED', blockers: [{ code: 'ACTIONS_STILL_OPEN', count: 1 }] })
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).currentStatus).toBe('IN_PROGRESS')
  }, 40_000)

  it('WF-14 racing requests always end in one valid state', async () => {
    for (let round = 0; round < 8; round += 1) {
      const id = await ticketAt('IN_PROGRESS')
      await addActionRow(id, staff.userId, 'COMPLETED')
      const version = await versionOf(id)
      const [resolve, created] = await Promise.all([
        staff.agent.patch(url(id, 'status')).send({ status: 'RESOLVED', expectedVersion: version }),
        otherStaff.agent.post(`/api/tickets/${id}/actions`).send({ description: 'Raced action' }),
      ])
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id } })
      if (resolve.status === 200) {
        expect(stored.currentStatus).toBe('RESOLVED')
        expect(created.status).toBe(201)
      } else {
        expect(resolve.status).toBe(409)
        expect(resolve.body.blockers).toEqual([{ code: 'ACTIONS_STILL_OPEN', count: 1 }])
        expect(stored.currentStatus).toBe('IN_PROGRESS')
      }
    }
  }, 60_000)
})

describe('Requester access (WF-05)', () => {
  it('refuses status, priority, reassign and claim for a Requester', async () => {
    const id = await ticketAt('NEW')
    const version = await versionOf(id)
    expect((await requester.agent.patch(url(id, 'status')).send({ status: 'OPEN', expectedVersion: version })).status).toBe(403)
    expect((await requester.agent.patch(url(id, 'priority')).send({ itPriority: 'HIGH', expectedVersion: version })).status).toBe(403)
    expect((await requester.agent.post(url(id, 'reassign')).send({ ticketOwnerId: staff.userId, expectedVersion: version })).status).toBe(403)
    expect((await requester.agent.post(url(id, 'claim'))).status).toBe(403)
    expect(await versionOf(id)).toBe(version)
  })
})

describe('Appears resolved (WF-06, WF-07, WF-08)', () => {
  it('WF-06 sets requesterResolvedAt once in each allowed status and changes neither status nor version', async () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] as const) {
      const id = await ticketAt(status)
      const version = await versionOf(id)

      const first = await requester.agent.post(url(id, 'appears-resolved'))
      expect(first.status, status).toBe(200)
      expect(first.body).toMatchObject({ id, currentStatus: status })
      expect(first.body.requesterResolvedAt).not.toBeNull()

      await sleep(15)
      const again = await requester.agent.post(url(id, 'appears-resolved'))
      expect(again.status).toBe(200)
      expect(again.body.requesterResolvedAt).toBe(first.body.requesterResolvedAt)

      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id } })
      expect(stored.currentStatus).toBe(status)
      expect(stored.version).toBe(version)
    }
  })

  it('WF-07 refuses another Requester, the wrong status, staff, an unknown Ticket, and no session', async () => {
    const id = await ticketAt('OPEN')
    const foreign = await otherRequester.agent.post(url(id, 'appears-resolved'))
    expect(foreign.status).toBe(403)
    expect(foreign.body.error).toBe('TICKET_FORBIDDEN')

    const fresh = await ticketAt('NEW')
    const notApplicable = await requester.agent.post(url(fresh, 'appears-resolved'))
    expect(notApplicable.status).toBe(409)
    expect(notApplicable.body).toEqual({ error: 'NOT_APPLICABLE', currentStatus: 'NEW' })

    const closed = await ticketAt('CLOSED')
    expect((await requester.agent.post(url(closed, 'appears-resolved'))).status).toBe(409)

    expect((await staff.agent.post(url(id, 'appears-resolved'))).status).toBe(403)
    expect((await requester.agent.post('/api/tickets/999999999/appears-resolved')).status).toBe(404)
    expect((await request(app).post(url(id, 'appears-resolved'))).status).toBe(401)
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).requesterResolvedAt).toBeNull()
  })

  it('WF-08 clears the indication when the Ticket is reopened', async () => {
    const id = await ticketAt('IN_PROGRESS')
    await addActionRow(id, staff.userId, 'COMPLETED')
    expect((await requester.agent.post(url(id, 'appears-resolved'))).status).toBe(200)
    expect((await move(staff, id, 'RESOLVED')).status).toBe(200)
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).requesterResolvedAt).not.toBeNull()

    expect((await move(staff, id, 'REOPENED')).status).toBe(200)
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).requesterResolvedAt).toBeNull()
  })
})

describe('History (WF-09, WF-10)', () => {
  it('WF-09 lists creation and every change once, in order, with the actor', async () => {
    const id = await ticketAt('NEW')
    expect((await move(staff, id, 'OPEN')).status).toBe(200)
    expect((await move(otherStaff, id, 'IN_PROGRESS')).status).toBe(200)

    for (const viewer of [requester, staff]) {
      const response = await viewer.agent.get(url(id, 'history'))
      expect(response.status).toBe(200)
      expect(response.body.map((row: { fromStatus: string | null; toStatus: string }) => [row.fromStatus, row.toStatus])).toEqual([
        [null, 'NEW'],
        ['NEW', 'OPEN'],
        ['OPEN', 'IN_PROGRESS'],
      ])
      expect(response.body.map((row: { changedById: number }) => row.changedById)).toEqual([requester.userId, staff.userId, otherStaff.userId])
      expect(response.body[0].changedByName).toBeTruthy()
    }
    expect((await otherRequester.agent.get(url(id, 'history'))).status).toBe(403)
    expect((await staff.agent.get('/api/tickets/999999999/history')).status).toBe(404)
  })

  it('WF-10 has no write route', async () => {
    const id = await ticketAt('NEW')
    const before = await prisma.ticketStatusHistory.count({ where: { ticketId: id } })
    expect((await staff.agent.post(url(id, 'history')).send({})).status).toBe(404)
    expect((await staff.agent.patch(url(id, 'history')).send({})).status).toBe(404)
    expect((await staff.agent.delete(url(id, 'history'))).status).toBe(404)
    expect(await prisma.ticketStatusHistory.count({ where: { ticketId: id } })).toBe(before)
  })
})

describe('Cancelling (WF-11, AC-L4-19)', () => {
  it('cancels Planned and In Progress Actions and leaves Completed ones', async () => {
    const id = await ticketAt('IN_PROGRESS')
    const planned = await addActionRow(id, staff.userId, 'PLANNED')
    const running = await addActionRow(id, staff.userId, 'IN_PROGRESS')
    const done = await addActionRow(id, staff.userId, 'COMPLETED')

    expect((await move(staff, id, 'CANCELLED')).status).toBe(200)

    const rows = await prisma.actionTaken.findMany({ where: { ticketId: id }, orderBy: { id: 'asc' } })
    expect(rows.map((row) => row.status)).toEqual(['CANCELLED', 'CANCELLED', 'COMPLETED'])
    expect(rows[0].version).toBe(planned.version + 1)
    expect(rows[1].version).toBe(running.version + 1)
    expect(rows[2].version).toBe(done.version)
  })
})

describe('Versions (WF-12, WF-13, WF-17, AC-L4-08, AC-L4-20)', () => {
  it('WF-12 rejects a stale or missing expectedVersion on status, priority and reassign', async () => {
    const id = await ticketAt('NEW')
    expect((await move(staff, id, 'OPEN')).status).toBe(200)
    const current = await versionOf(id)

    for (const [method, part, body] of [
      ['patch', 'status', { status: 'IN_PROGRESS' }],
      ['patch', 'priority', { itPriority: 'HIGH' }],
      ['post', 'reassign', { ticketOwnerId: staff.userId }],
    ] as const) {
      const stale = await staff.agent[method](url(id, part)).send({ ...body, expectedVersion: current - 1 })
      expect(stale.status, part).toBe(409)
      expect(stale.body).toEqual({ error: 'STALE_UPDATE', currentVersion: current })

      for (const expectedVersion of [undefined, 0, -1, 1.5, '2']) {
        const missing = await staff.agent[method](url(id, part)).send({ ...body, expectedVersion })
        expect(missing.status, `${part} ${String(expectedVersion)}`).toBe(400)
        expect(missing.body.fields.expectedVersion).toBeDefined()
      }
    }
    expect(await versionOf(id)).toBe(current)
  })

  it('WF-13 lets exactly one of two simultaneous status changes win', async () => {
    const id = await ticketAt('NEW')
    const version = await versionOf(id)
    const results = await Promise.all([
      staff.agent.patch(url(id, 'status')).send({ status: 'OPEN', expectedVersion: version }),
      otherStaff.agent.patch(url(id, 'status')).send({ status: 'CANCELLED', expectedVersion: version }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(results.find((r) => r.status === 409)?.body.error).toBe('STALE_UPDATE')
    expect(await versionOf(id)).toBe(version + 1)
  })

  it('WF-17 changes the version only for claim, reassign, priority and status; any activity refreshes updatedAt', async () => {
    const id = await ticketAt('NEW')
    const base = await versionOf(id)

    expect((await staff.agent.post(url(id, 'claim'))).status).toBe(200)
    expect(await versionOf(id)).toBe(base + 1)
    expect((await staff.agent.post(url(id, 'reassign')).send({ ticketOwnerId: otherStaff.userId, expectedVersion: base + 1 })).status).toBe(200)
    expect(await versionOf(id)).toBe(base + 2)
    expect((await staff.agent.patch(url(id, 'priority')).send({ itPriority: 'HIGH', expectedVersion: base + 2 })).status).toBe(200)
    expect(await versionOf(id)).toBe(base + 3)
    expect((await move(staff, id, 'OPEN')).status).toBe(200)
    expect(await versionOf(id)).toBe(base + 4)

    const settled = base + 4
    const stamp = async () => (await prisma.ticket.findUniqueOrThrow({ where: { id } })).updatedAt.getTime()
    for (const act of [
      () => staff.agent.post(`/api/tickets/${id}/actions`).send({ description: 'Version check action' }),
      () => requester.agent.post(`/api/tickets/${id}/comments`).send({ body: 'Comment' }),
      () => staff.agent.post(`/api/tickets/${id}/notes`).send({ body: 'Note' }),
      () => requester.agent.post(url(id, 'appears-resolved')),
    ]) {
      const before = await stamp()
      await sleep(15)
      expect((await act()).status).toBeLessThan(300)
      expect(await stamp()).toBeGreaterThan(before)
      expect(await versionOf(id)).toBe(settled)
    }
  })
})

describe('Ticket detail and list fields (WF-15, WF-18, FR-L4-11)', () => {
  it('WF-15 returns version, actionsSummary and, for staff only, resolution', async () => {
    const id = await ticketAt('IN_PROGRESS')
    await addActionRow(id, staff.userId, 'COMPLETED', { followUpRequired: true })
    await addActionRow(id, staff.userId, 'PLANNED')

    const asStaff = await staff.agent.get(`/api/tickets/${id}`)
    expect(asStaff.status).toBe(200)
    expect(asStaff.body.version).toBe(await versionOf(id))
    expect(asStaff.body.actionsSummary).toEqual({ total: 2, planned: 1, inProgress: 0, completed: 1, cancelled: 0, openFollowUps: 1 })
    expect(asStaff.body.resolution).toEqual({
      canResolve: false,
      blockers: [{ code: 'ACTIONS_STILL_OPEN', count: 1 }, { code: 'FOLLOW_UP_OPEN', count: 1 }],
    })
    expect(asStaff.body.allowedStatuses).toEqual(MATRIX.IN_PROGRESS)

    const asRequester = await requester.agent.get(`/api/tickets/${id}`)
    expect(asRequester.body.version).toBe(asStaff.body.version)
    expect(asRequester.body.actionsSummary.total).toBe(2)
    expect(asRequester.body.resolution).toBeUndefined()
  })

  it('WF-18 carries the indication on staff list and detail, never on Requester list items', async () => {
    const id = await ticketAt('IN_PROGRESS')
    await requester.agent.post(url(id, 'appears-resolved'))

    const detail = await staff.agent.get(`/api/tickets/${id}`)
    expect(detail.body.requesterResolvedAt).not.toBeNull()

    const search = encodeURIComponent('Helper ticket for tests')
    const staffList = await staff.agent.get(`/api/tickets?search=${search}&pageSize=50`)
    const staffItem = staffList.body.data.find((item: { id: number }) => item.id === id)
    expect(staffItem.requesterResolvedAt).not.toBeNull()

    const requesterList = await requester.agent.get(`/api/tickets?search=${search}&pageSize=50`)
    const requesterItem = requesterList.body.data.find((item: { id: number }) => item.id === id)
    expect(requesterItem).toBeDefined()
    expect('requesterResolvedAt' in requesterItem).toBe(false)
  })
})

describe('Claim keeps its Lab 3 behavior', () => {
  it('still answers ALREADY_CLAIMED to the second claimer', async () => {
    const id = await ticketAt('NEW')
    expect((await staff.agent.post(url(id, 'claim'))).status).toBe(200)
    const second = await otherStaff.agent.post(url(id, 'claim'))
    expect(second.status).toBe(409)
    expect(second.body).toEqual({ error: 'ALREADY_CLAIMED', ticketOwnerId: staff.userId })
  })
})
