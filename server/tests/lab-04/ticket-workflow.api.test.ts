import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/prisma.js'
import { loginAsAdministrator, loginAsItStaff, loginAsRequester, type AuthenticatedAgent } from '../helpers/session.js'

async function createTicketAs(agent: AuthenticatedAgent, summary = 'Lab 4 workflow test ticket') {
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  const response = await agent.post('/api/tickets').send({
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    requestedPriority: 'MEDIUM',
    summary,
    description: 'Used to verify the Lab 4 advisory resolution indication.',
  })
  return response.body as { id: number }
}

describe('Requester cannot perform staff workflow actions (WF-05, AC-L4-14)', () => {
  it('returns 403 for status, priority, reassign, and claim', async () => {
    const { agent: requester } = await loginAsRequester()
    const { userId: staffId } = await loginAsItStaff()
    const ticket = await createTicketAs(requester)

    expect((await requester.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })).status).toBe(403)
    expect((await requester.patch(`/api/tickets/${ticket.id}/priority`).send({ itPriority: 'HIGH' })).status).toBe(403)
    expect((await requester.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: staffId })).status).toBe(403)
    expect((await requester.post(`/api/tickets/${ticket.id}/claim`)).status).toBe(403)
  })
})

describe('POST /api/tickets/:id/appears-resolved (WF-06, WF-07, AC-L4-15, BR-L4-11)', () => {
  it('records the indication on an active own ticket without changing its status', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const ticket = await createTicketAs(requester)
    await staff.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })

    const response = await requester.post(`/api/tickets/${ticket.id}/appears-resolved`)

    expect(response.status).toBe(200)
    expect(response.body.currentStatus).toBe('OPEN')
    expect(response.body.requesterResolvedAt).toBeTruthy()

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored.currentStatus).toBe('OPEN')
    expect(stored.requesterResolvedAt).not.toBeNull()
  })

  it('is idempotent and keeps the first timestamp', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const ticket = await createTicketAs(requester)
    await staff.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })

    const first = await requester.post(`/api/tickets/${ticket.id}/appears-resolved`)
    const second = await requester.post(`/api/tickets/${ticket.id}/appears-resolved`)

    expect(second.status).toBe(200)
    expect(second.body.requesterResolvedAt).toBe(first.body.requesterResolvedAt)
  })

  it('refuses a ticket owned by another Requester with 403', async () => {
    const { agent: owner } = await loginAsRequester(0)
    const { agent: other } = await loginAsRequester(1)
    const { agent: staff } = await loginAsItStaff()
    const ticket = await createTicketAs(owner)
    await staff.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })

    const response = await other.post(`/api/tickets/${ticket.id}/appears-resolved`)

    expect(response.status).toBe(403)
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored.requesterResolvedAt).toBeNull()
  })

  it('refuses statuses where it does not apply with 409 NOT_APPLICABLE', async () => {
    const { agent: requester } = await loginAsRequester()
    const ticket = await createTicketAs(requester)

    const onNew = await requester.post(`/api/tickets/${ticket.id}/appears-resolved`)
    expect(onNew.status).toBe(409)
    expect(onNew.body.error).toBe('NOT_APPLICABLE')
    expect(onNew.body.currentStatus).toBe('NEW')

    await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: 'CLOSED' } })
    const onClosed = await requester.post(`/api/tickets/${ticket.id}/appears-resolved`)
    expect(onClosed.status).toBe(409)
  })

  it('refuses IT Staff and Administrators with 403, an unknown ticket with 404, and no session with 401', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const { agent: admin } = await loginAsAdministrator()
    const ticket = await createTicketAs(requester)
    await staff.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })

    expect((await staff.post(`/api/tickets/${ticket.id}/appears-resolved`)).status).toBe(403)
    expect((await admin.post(`/api/tickets/${ticket.id}/appears-resolved`)).status).toBe(403)
    expect((await requester.post('/api/tickets/9999999/appears-resolved')).status).toBe(404)

    const request = (await import('supertest')).default
    const { app } = await import('../../src/app.js')
    const anonymous = await request(app)
      .post(`/api/tickets/${ticket.id}/appears-resolved`)
      .set('Origin', process.env.APP_ORIGIN ?? 'http://localhost:5173')
    expect(anonymous.status).toBe(401)
  })
})

describe('Indication cleared on reopen (WF-08, AC-L4-16, BR-L4-11)', () => {
  it('clears requesterResolvedAt when the ticket moves to REOPENED', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const ticket = await createTicketAs(requester)
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { currentStatus: 'RESOLVED', requesterResolvedAt: new Date() },
    })

    const response = await staff.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'REOPENED' })

    expect(response.status).toBe(200)
    expect(response.body.requesterResolvedAt).toBeNull()
  })

  it('keeps the indication on other transitions', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const ticket = await createTicketAs(requester)
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { currentStatus: 'OPEN', requesterResolvedAt: new Date() },
    })

    const response = await staff.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'IN_PROGRESS' })

    expect(response.status).toBe(200)
    expect(response.body.requesterResolvedAt).not.toBeNull()
  })
})

describe('Staff see the indication (WF-18, FR-L4-11)', () => {
  it('exposes requesterResolvedAt on staff detail and staff list, not on the Requester list', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const ticket = await createTicketAs(requester, 'WF-18 visible indication ticket')
    await staff.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })
    await requester.post(`/api/tickets/${ticket.id}/appears-resolved`)

    const detail = await staff.get(`/api/tickets/${ticket.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.requesterResolvedAt).toBeTruthy()

    const staffList = await staff.get('/api/tickets').query({ search: 'WF-18 visible indication ticket' })
    const row = staffList.body.data.find((item: { id: number }) => item.id === ticket.id)
    expect(row.requesterResolvedAt).toBeTruthy()

    const requesterList = await requester.get('/api/tickets').query({ search: 'WF-18 visible indication ticket' })
    const ownRow = requesterList.body.data.find((item: { id: number }) => item.id === ticket.id)
    expect(ownRow).toBeDefined()
    expect('requesterResolvedAt' in ownRow).toBe(false)
  })
})
