import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/prisma.js'
import { getTicketState } from '../../src/tickets/ticket-state/ticket-state-factory.js'
import { loginAsItStaff, loginAsRequester, type AuthenticatedAgent } from '../helpers/session.js'

async function createTicketAs(agent: AuthenticatedAgent) {
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  const response = await agent.post('/api/tickets').send({
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    requestedPriority: 'MEDIUM',
    summary: 'Staff ticket detail test ticket',
    description: 'Used to verify claim/reassign/priority/status behavior.',
  })
  return response.body
}

describe('POST /api/tickets/:id/claim (STAFF-01, STAFF-02, AC-L3-10)', () => {
  it('claims an unassigned ticket', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent, userId: staffId } = await loginAsItStaff()
    const ticket = await createTicketAs(requesterAgent)

    const response = await staffAgent.post(`/api/tickets/${ticket.id}/claim`)

    expect(response.status).toBe(200)
    expect(response.body.ticketOwnerId).toBe(staffId)
  })

  it('rejects claiming a ticket already claimed by someone else with 409', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: firstStaff } = await loginAsItStaff(0)
    const { agent: secondStaff } = await loginAsItStaff(1)
    const ticket = await createTicketAs(requesterAgent)

    await firstStaff.post(`/api/tickets/${ticket.id}/claim`)
    const response = await secondStaff.post(`/api/tickets/${ticket.id}/claim`)

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('ALREADY_CLAIMED')
    expect(response.body.ticketOwnerId).toBeDefined()
  })

  it('returns 404 for an unknown ticket', async () => {
    const { agent: staffAgent } = await loginAsItStaff()

    const response = await staffAgent.post('/api/tickets/9999999/claim')

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('TICKET_NOT_FOUND')
  })

  it('rejects a Requester attempting to claim', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const ticket = await createTicketAs(requesterAgent)

    const response = await requesterAgent.post(`/api/tickets/${ticket.id}/claim`)

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })
})

describe('POST /api/tickets/:id/reassign (STAFF-03)', () => {
  it('rejects a ticketOwnerId that does not reference an active IT Staff user', async () => {
    const { agent: requesterAgent, userId: requesterId } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff()
    const ticket = await createTicketAs(requesterAgent)

    const notStaff = await staffAgent.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: requesterId })
    expect(notStaff.status).toBe(400)
    expect(notStaff.body.error).toBe('VALIDATION_FAILED')

    const unknown = await staffAgent.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: 9999999 })
    expect(unknown.status).toBe(400)
  })

  it('reassigns to a valid active IT Staff user', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff(0)
    const { userId: targetStaffId } = await loginAsItStaff(1)
    const ticket = await createTicketAs(requesterAgent)

    const response = await staffAgent.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: targetStaffId })

    expect(response.status).toBe(200)
    expect(response.body.ticketOwnerId).toBe(targetStaffId)
  })
})

describe('PATCH /api/tickets/:id/priority (STAFF-04)', () => {
  it('updates itPriority without changing requestedPriority', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff()
    const ticket = await createTicketAs(requesterAgent)
    expect(ticket.requestedPriority).toBe('MEDIUM')

    const response = await staffAgent.patch(`/api/tickets/${ticket.id}/priority`).send({ itPriority: 'HIGH' })

    expect(response.status).toBe(200)
    expect(response.body.itPriority).toBe('HIGH')
    expect(response.body.requestedPriority).toBe('MEDIUM')
  })

  it('rejects an invalid priority value', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff()
    const ticket = await createTicketAs(requesterAgent)

    const response = await staffAgent.patch(`/api/tickets/${ticket.id}/priority`).send({ itPriority: 'URGENT' })

    expect(response.status).toBe(400)
  })
})

describe('PATCH /api/tickets/:id/status (STAFF-05, STAFF-06, STAFF-07, AC-L3-11, AC-L3-12)', () => {
  it('rejects an invalid transition (NEW -> CLOSED) and leaves status unchanged', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff()
    const ticket = await createTicketAs(requesterAgent)

    const response = await staffAgent.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'CLOSED' })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('INVALID_TRANSITION')
    expect(response.body.from).toBe('NEW')
    expect(response.body.allowed).toEqual(['OPEN', 'CANCELLED'])

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored.currentStatus).toBe('NEW')
  })

  it('accepts every allowed transition in the BR-L3-13 table', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff()

    const path: Array<[string, string]> = [
      ['NEW', 'OPEN'],
      ['OPEN', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'WAITING_FOR_REQUESTER'],
      ['WAITING_FOR_REQUESTER', 'RESOLVED'],
      ['RESOLVED', 'CLOSED'],
      ['CLOSED', 'REOPENED'],
      ['REOPENED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'CANCELLED'],
    ]

    const ticket = await createTicketAs(requesterAgent)

    for (const [, to] of path) {
      const response = await staffAgent.patch(`/api/tickets/${ticket.id}/status`).send({ status: to })
      expect(response.status).toBe(200)
      expect(response.body.currentStatus).toBe(to)
    }
  })

  it('rejects every transition out of the terminal CANCELLED state', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff()
    const ticket = await createTicketAs(requesterAgent)

    await staffAgent.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })
    await staffAgent.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'CANCELLED' })

    for (const target of ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED']) {
      const response = await staffAgent.patch(`/api/tickets/${ticket.id}/status`).send({ status: target })
      expect(response.status).toBe(409)
      expect(response.body.allowed).toEqual([])
    }
  })

  it('rejects a status change from a Requester', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const ticket = await createTicketAs(requesterAgent)

    const response = await requesterAgent.patch(`/api/tickets/${ticket.id}/status`).send({ status: 'OPEN' })

    expect(response.status).toBe(403)
  })
})

describe('TicketState subclasses (STAFF-08, unit, no database)', () => {
  it('matches the BR-L3-13 table exactly for every status', () => {
    const table: Record<string, string[]> = {
      NEW: ['OPEN', 'CANCELLED'],
      OPEN: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
      WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
      RESOLVED: ['CLOSED', 'REOPENED'],
      CLOSED: ['REOPENED'],
      REOPENED: ['IN_PROGRESS', 'CANCELLED'],
      CANCELLED: [],
    }

    for (const status of Object.keys(table) as Array<keyof typeof table>) {
      const state = getTicketState(status as never)
      expect(state.allowedActions()).toEqual(table[status])
      for (const candidate of Object.keys(table)) {
        expect(state.canTransitionTo(candidate as never)).toBe(table[status].includes(candidate))
      }
    }
  })
})
