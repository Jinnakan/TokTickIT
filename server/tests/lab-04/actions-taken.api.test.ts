import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../helpers/app.js'
import { prisma } from '../../src/prisma.js'
import { createUser, loginAsNewUser } from '../helpers/users.js'
import { createTicketVia, setTicketStatus } from '../helpers/tickets.js'
import { loginAsEmail, type AuthenticatedAgent } from '../helpers/session.js'

type Actor = { agent: AuthenticatedAgent; userId: number }

let requesterA: Actor
let requesterB: Actor
let staff: Actor
let otherStaff: Actor
let admin: Actor
let inactiveStaffId: number

const base = { description: 'Replaced the docking station firmware.' }
const actionsUrl = (ticketId: number) => `/api/tickets/${ticketId}/actions`
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function newTicket(): Promise<number> {
  return (await createTicketVia(requesterA.agent)).id
}

async function createVia(actor: Actor, ticketId: number, body: Record<string, unknown> = base) {
  return actor.agent.post(actionsUrl(ticketId)).send(body)
}

beforeAll(async () => {
  const [a, b, s1, s2, ad, inactive] = await Promise.all([
    loginAsNewUser('REQUESTER'),
    loginAsNewUser('REQUESTER'),
    loginAsNewUser('IT_STAFF'),
    loginAsNewUser('IT_STAFF'),
    loginAsNewUser('ADMINISTRATOR'),
    createUser({ role: 'IT_STAFF', isActive: false }),
  ])
  requesterA = a
  requesterB = b
  staff = s1
  otherStaff = s2
  admin = ad
  inactiveStaffId = inactive.id
}, 60_000)

describe('POST /api/tickets/:ticketId/actions', () => {
  it('ACT-01 creates an Action for IT Staff and Administrator with the session user as creator', async () => {
    const ticketId = await newTicket()
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    await sleep(15)

    const created = await createVia(staff, ticketId)
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      ticketId,
      createdById: staff.userId,
      assigneeId: staff.userId,
      status: 'PLANNED',
      version: 1,
      description: base.description,
    })

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime())
    expect(after.version).toBe(before.version)

    const byAdmin = await createVia(admin, ticketId)
    expect(byAdmin.status).toBe(201)
    expect(byAdmin.body.createdById).toBe(admin.userId)
  })

  it('ACT-02 ignores createdById, ticketId, version, id and unknown fields', async () => {
    const ticketId = await newTicket()
    const response = await createVia(staff, ticketId, {
      ...base,
      createdById: otherStaff.userId,
      ticketId: 999999999,
      version: 9,
      id: 123456789,
      bogus: 'x',
    })
    expect(response.status).toBe(201)
    expect(response.body.createdById).toBe(staff.userId)
    expect(response.body.ticketId).toBe(ticketId)
    expect(response.body.version).toBe(1)
    expect(response.body.id).not.toBe(123456789)
    expect(response.body.bogus).toBeUndefined()
  })

  it('ACT-03 rejects an inactive, Requester, unknown or non-integer assignee on create and edit', async () => {
    const ticketId = await newTicket()
    const bad = [inactiveStaffId, requesterB.userId, 999999999, '7']
    for (const assigneeId of bad) {
      const response = await createVia(staff, ticketId, { ...base, assigneeId })
      expect(response.status).toBe(400)
      expect(response.body.fields.assigneeId).toBe('Assignee must be an active IT Staff or Administrator.')
    }
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(0)

    const ok = await createVia(staff, ticketId)
    const edit = await staff.agent
      .patch(`${actionsUrl(ticketId)}/${ok.body.id}`)
      .send({ version: ok.body.version, assigneeId: inactiveStaffId })
    expect(edit.status).toBe(400)
    expect(edit.body.fields.assigneeId).toBe('Assignee must be an active IT Staff or Administrator.')
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: ok.body.id } })
    expect(stored.assigneeId).toBe(staff.userId)
    expect(stored.version).toBe(1)
  })

  it('ACT-04 rejects a missing follow-up note and a note without follow-up', async () => {
    const ticketId = await newTicket()
    const missing = await createVia(staff, ticketId, { ...base, followUpRequired: true })
    expect(missing.status).toBe(400)
    expect(missing.body.fields.followUpNote).toBeDefined()
    const extra = await createVia(staff, ticketId, { ...base, followUpNote: 'Later' })
    expect(extra.status).toBe(400)
    expect(extra.body.fields.followUpNote).toBeDefined()
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(0)
  })

  it('ACT-07 accepts a staff member who is not the Ticket Owner, with a third person as assignee', async () => {
    const ticketId = await newTicket()
    expect((await staff.agent.post(`/api/tickets/${ticketId}/claim`)).status).toBe(200)

    const created = await createVia(otherStaff, ticketId, { ...base, assigneeId: admin.userId })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ createdById: otherStaff.userId, assigneeId: admin.userId })

    const edited = await otherStaff.agent
      .patch(`${actionsUrl(ticketId)}/${created.body.id}`)
      .send({ version: 1, description: 'Edited by a non-owner.' })
    expect(edited.status).toBe(200)
  })

  it('ACT-10 makes a repeated requestId idempotent, also when two arrive at once', async () => {
    const ticketId = await newTicket()
    const otherTicketId = await newTicket()
    const requestId = `req-${Date.now()}-a`

    const first = await createVia(staff, ticketId, { ...base, requestId })
    const second = await createVia(staff, ticketId, { ...base, requestId })
    expect([first.status, second.status]).toEqual([201, 200])
    expect(second.body.id).toBe(first.body.id)
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1)

    const parallelId = `req-${Date.now()}-b`
    const both = await Promise.all([
      createVia(staff, ticketId, { ...base, requestId: parallelId }),
      createVia(staff, ticketId, { ...base, requestId: parallelId }),
    ])
    expect(both.map((r) => r.status).sort()).toEqual([200, 201])
    expect(both[0].body.id).toBe(both[1].body.id)
    expect(await prisma.actionTaken.count({ where: { ticketId, requestId: parallelId } })).toBe(1)

    const elsewhere = await createVia(staff, otherTicketId, { ...base, requestId })
    expect(elsewhere.status).toBe(201)
    expect(elsewhere.body.id).not.toBe(first.body.id)

    for (const unsafe of ['bad id!!!', 'short', 'x'.repeat(65)]) {
      const rejected = await createVia(staff, ticketId, { ...base, requestId: unsafe })
      expect(rejected.status).toBe(400)
      expect(rejected.body.fields.requestId).toBeDefined()
    }
  })

  it('ACT-11 refuses Actions on a Closed or Cancelled Ticket and allows them on a Resolved one', async () => {
    for (const status of ['CLOSED', 'CANCELLED'] as const) {
      const ticketId = await newTicket()
      const existing = await createVia(staff, ticketId)
      await setTicketStatus(ticketId, status)

      const create = await createVia(staff, ticketId)
      expect(create.status).toBe(409)
      expect(create.body).toEqual({ error: 'TICKET_LOCKED', currentStatus: status })

      const edit = await staff.agent
        .patch(`${actionsUrl(ticketId)}/${existing.body.id}`)
        .send({ version: 1, description: 'Too late.' })
      expect(edit.status).toBe(409)
      expect(edit.body.error).toBe('TICKET_LOCKED')
    }

    const resolvedId = await newTicket()
    await setTicketStatus(resolvedId, 'RESOLVED')
    expect((await createVia(staff, resolvedId)).status).toBe(201)
  })

  it('ACT-12 enforces result, future-date and length limits', async () => {
    const ticketId = await newTicket()
    const noResult = await createVia(staff, ticketId, { ...base, status: 'COMPLETED' })
    expect(noResult.status).toBe(400)
    expect(noResult.body.fields.result).toBeDefined()

    const future = new Date(Date.now() + 3_600_000).toISOString()
    const futureDone = await createVia(staff, ticketId, { ...base, status: 'COMPLETED', result: 'Done', actionAt: future })
    expect(futureDone.status).toBe(400)
    expect(futureDone.body.fields.actionAt).toBeDefined()

    const skew = new Date(Date.now() + 30_000).toISOString()
    expect((await createVia(staff, ticketId, { ...base, status: 'COMPLETED', result: 'Done', actionAt: skew })).status).toBe(201)

    expect((await createVia(staff, ticketId, { description: 'x'.repeat(2001) })).status).toBe(400)
    expect((await createVia(staff, ticketId, { description: 'x'.repeat(2000) })).status).toBe(201)
    expect((await createVia(staff, ticketId, { ...base, result: 'x'.repeat(2001) })).status).toBe(400)
  })

  it('ACT-15 stores a script tag as plain data', async () => {
    const ticketId = await newTicket()
    const text = '<script>alert(1)<' + '/script>'
    const created = await createVia(staff, ticketId, { description: text })
    expect(created.status).toBe(201)
    const listed = await staff.agent.get(actionsUrl(ticketId))
    expect(listed.body[0].description).toBe(text)
  })
})

describe('GET /api/tickets/:ticketId/actions', () => {
  it('ACT-05 lets a Requester read their own Ticket but not create, edit, or read another Requester’s', async () => {
    const ticketId = await newTicket()
    const created = await createVia(staff, ticketId)

    const own = await requesterA.agent.get(actionsUrl(ticketId))
    expect(own.status).toBe(200)
    expect(own.body.map((a: { id: number }) => a.id)).toEqual([created.body.id])

    const create = await createVia(requesterA, ticketId)
    expect(create.status).toBe(403)
    expect(create.body.error).toBe('FORBIDDEN')
    const edit = await requesterA.agent.patch(`${actionsUrl(ticketId)}/${created.body.id}`).send({ version: 1, description: 'x' })
    expect(edit.status).toBe(403)

    const foreign = await requesterB.agent.get(actionsUrl(ticketId))
    expect(foreign.status).toBe(403)
    expect(foreign.body.error).toBe('TICKET_FORBIDDEN')
  })

  it('ACT-14 returns 401 without a session and 403 PASSWORD_CHANGE_REQUIRED when a change is pending', async () => {
    const ticketId = await newTicket()
    expect((await request(app).get(actionsUrl(ticketId))).status).toBe(401)

    const pending = await createUser({ role: 'IT_STAFF' })
    await prisma.user.update({ where: { id: pending.id }, data: { mustChangePassword: true } })
    const session = await loginAsEmail(pending.email)
    const response = await session.agent.get(actionsUrl(ticketId))
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('PASSWORD_CHANGE_REQUIRED')
  })

  it('ACT-16 orders by actionAt then id, so equal times stay stable', async () => {
    const ticketId = await newTicket()
    const same = '2026-10-01T08:00:00.000Z'
    const a = await createVia(staff, ticketId, { description: 'first', actionAt: same })
    const b = await createVia(staff, ticketId, { description: 'second', actionAt: same })
    const earlier = await createVia(staff, ticketId, { description: 'earlier', actionAt: '2026-09-30T08:00:00.000Z' })

    const listed = await staff.agent.get(actionsUrl(ticketId))
    expect(listed.body.map((x: { id: number }) => x.id)).toEqual([earlier.body.id, a.body.id, b.body.id])
  })

  it('returns an empty array when there are no Actions and 404 for an unknown Ticket', async () => {
    const ticketId = await newTicket()
    expect((await staff.agent.get(actionsUrl(ticketId))).body).toEqual([])
    expect((await staff.agent.get(actionsUrl(999999999))).status).toBe(404)
  })
})

describe('PATCH /api/tickets/:ticketId/actions/:actionId', () => {
  it('ACT-06 returns 404 for an Action addressed through the wrong Ticket or an unknown id', async () => {
    const ticketA = await newTicket()
    const ticketB = await newTicket()
    const action = await createVia(staff, ticketA)

    const wrong = await staff.agent.patch(`${actionsUrl(ticketB)}/${action.body.id}`).send({ version: 1, description: 'x' })
    expect(wrong.status).toBe(404)
    expect(wrong.body.error).toBe('ACTION_NOT_FOUND')

    const unknown = await staff.agent.patch(`${actionsUrl(ticketA)}/999999999`).send({ version: 1, description: 'x' })
    expect(unknown.status).toBe(404)
    expect(unknown.body.error).toBe('ACTION_NOT_FOUND')
  })

  it('ACT-08 rejects an outdated version and keeps the first change, in order and at the same moment', async () => {
    const ticketId = await newTicket()
    const action = await createVia(staff, ticketId)
    const url = `${actionsUrl(ticketId)}/${action.body.id}`

    const first = await staff.agent.patch(url).send({ version: 1, description: 'First change.' })
    expect(first.status).toBe(200)
    expect(first.body.version).toBe(2)
    const second = await otherStaff.agent.patch(url).send({ version: 1, description: 'Second change.' })
    expect(second.status).toBe(409)
    expect(second.body).toEqual({ error: 'STALE_UPDATE', currentVersion: 2 })
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.body.id } })).description).toBe('First change.')

    const racing = await createVia(staff, ticketId)
    const raceUrl = `${actionsUrl(ticketId)}/${racing.body.id}`
    const results = await Promise.all([
      staff.agent.patch(raceUrl).send({ version: 1, description: 'Left.' }),
      otherStaff.agent.patch(raceUrl).send({ version: 1, description: 'Right.' }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: racing.body.id } })).version).toBe(2)
  })

  it('ACT-09 locks a Cancelled Action and the content of a Completed one', async () => {
    const ticketId = await newTicket()
    const toCancel = await createVia(staff, ticketId)
    const cancelled = await staff.agent
      .patch(`${actionsUrl(ticketId)}/${toCancel.body.id}`)
      .send({ version: 1, status: 'CANCELLED' })
    expect(cancelled.status).toBe(200)
    const locked = await staff.agent
      .patch(`${actionsUrl(ticketId)}/${toCancel.body.id}`)
      .send({ version: 2, description: 'Nope.' })
    expect(locked.status).toBe(409)
    expect(locked.body).toEqual({ error: 'ACTION_LOCKED', reason: 'CANCELLED' })

    const done = await createVia(staff, ticketId, { ...base, status: 'COMPLETED', result: 'Fixed.' })
    const doneUrl = `${actionsUrl(ticketId)}/${done.body.id}`
    const content = await staff.agent.patch(doneUrl).send({ version: 1, description: 'Rewritten.' })
    expect(content.status).toBe(409)
    expect(content.body).toEqual({ error: 'ACTION_LOCKED', reason: 'COMPLETED', fields: ['description'] })

    const followUp = await staff.agent
      .patch(doneUrl)
      .send({ version: 1, followUpRequired: true, followUpNote: 'Check again Friday.', attachmentNotes: 'See photo.' })
    expect(followUp.status).toBe(200)
    expect(followUp.body).toMatchObject({ followUpRequired: true, followUpNote: 'Check again Friday.', attachmentNotes: 'See photo.' })
  })

  it('ACT-17 allows only the BR-L4-05 status moves', async () => {
    const ticketId = await newTicket()
    const allowed: Record<string, string[]> = {
      PLANNED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    }
    const statuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

    for (const from of statuses) {
      for (const to of statuses.filter((s) => s !== from)) {
        const seeded = await prisma.actionTaken.create({
          data: {
            ticketId,
            createdById: staff.userId,
            assigneeId: staff.userId,
            actionAt: new Date(),
            description: `from ${from}`,
            status: from as 'PLANNED',
            result: from === 'COMPLETED' ? 'Done.' : null,
          },
        })
        const response = await staff.agent
          .patch(`${actionsUrl(ticketId)}/${seeded.id}`)
          .send({ version: 1, status: to, ...(to === 'COMPLETED' ? { result: 'Done.' } : {}) })

        if (allowed[from].includes(to)) {
          expect(response.status, `${from} -> ${to}`).toBe(200)
          expect(response.body.status).toBe(to)
        } else {
          expect(response.status, `${from} -> ${to}`).toBe(409)
          expect(['ACTION_LOCKED', 'INVALID_ACTION_TRANSITION']).toContain(response.body.error)
        }
      }
    }

    const rejected = await prisma.actionTaken.create({
      data: { ticketId, createdById: staff.userId, assigneeId: staff.userId, actionAt: new Date(), description: 'x', status: 'COMPLETED', result: 'r' },
    })
    const body = (
      await staff.agent.patch(`${actionsUrl(ticketId)}/${rejected.id}`).send({ version: 1, status: 'PLANNED' })
    ).body
    expect(body).toEqual({ error: 'INVALID_ACTION_TRANSITION', from: 'COMPLETED', to: 'PLANNED' })
  })

  it('ACT-18 marks a follow-up done once, keeps the first time on repeat, and clears it on false', async () => {
    const ticketId = await newTicket()
    const action = await createVia(staff, ticketId, { ...base, followUpRequired: true, followUpNote: 'Check Friday.' })
    const url = `${actionsUrl(ticketId)}/${action.body.id}`

    const done = await staff.agent.patch(url).send({ version: 1, followUpDone: true })
    expect(done.status).toBe(200)
    const firstTime = done.body.followUpDoneAt
    expect(firstTime).not.toBeNull()

    await sleep(15)
    const again = await staff.agent.patch(url).send({ version: 2, followUpDone: true })
    expect(again.body.followUpDoneAt).toBe(firstTime)

    const reopened = await staff.agent.patch(url).send({ version: 3, followUpDone: false })
    expect(reopened.body.followUpDoneAt).toBeNull()

    const noFollowUp = await createVia(staff, ticketId)
    const refused = await staff.agent
      .patch(`${actionsUrl(ticketId)}/${noFollowUp.body.id}`)
      .send({ version: 1, followUpDone: true })
    expect(refused.status).toBe(400)
    expect(refused.body.fields.followUpDone).toBeDefined()
  })

  it('requires a positive integer version', async () => {
    const ticketId = await newTicket()
    const action = await createVia(staff, ticketId)
    for (const version of [undefined, 0, -1, 1.5, '1']) {
      const response = await staff.agent.patch(`${actionsUrl(ticketId)}/${action.body.id}`).send({ version, description: 'x' })
      expect(response.status).toBe(400)
      expect(response.body.fields.version).toBeDefined()
    }
  })
})

describe('DELETE /api/tickets/:ticketId/actions/:actionId', () => {
  it('ACT-13 returns 404 and leaves the row', async () => {
    const ticketId = await newTicket()
    const action = await createVia(staff, ticketId)
    const response = await staff.agent.delete(`${actionsUrl(ticketId)}/${action.body.id}`)
    expect(response.status).toBe(404)
    expect(await prisma.actionTaken.count({ where: { id: action.body.id } })).toBe(1)
  })
})
