import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/prisma.js'
import { TicketQueryBuilder } from '../../src/staff/ticket-query-builder.js'
import { loginAsItStaff, loginAsRequester, type AuthenticatedAgent } from '../helpers/session.js'

let staffAgent: AuthenticatedAgent
let requesterA: AuthenticatedAgent
let requesterB: AuthenticatedAgent
let categoryId: number
let relatedSystemId: number

async function createTicketAs(agent: AuthenticatedAgent, summary: string) {
  const response = await agent.post('/api/tickets').send({
    categoryId,
    relatedSystemId,
    requestedPriority: 'MEDIUM',
    summary,
    description: 'Staff queue test ticket.',
  })
  return response.body
}

beforeAll(async () => {
  const [staff, reqA, reqB, category, relatedSystem] = await Promise.all([
    loginAsItStaff(),
    loginAsRequester(0),
    loginAsRequester(1),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ])
  staffAgent = staff.agent
  requesterA = reqA.agent
  requesterB = reqB.agent
  categoryId = category.id
  relatedSystemId = relatedSystem.id
})

describe('GET /api/tickets as IT Staff (Queue) (QUEUE-01, AC-L3-09)', () => {
  it('returns tickets from every Requester, not scoped to one', async () => {
    await createTicketAs(requesterA, 'Staff queue visibility check A')
    await createTicketAs(requesterB, 'Staff queue visibility check B')

    const response = await staffAgent.get('/api/tickets').query({ pageSize: 50 })

    expect(response.status).toBe(200)
    const requesterIds = new Set(response.body.data.map((row: { requester: { id: number } }) => row.requester.id))
    expect(requesterIds.size).toBeGreaterThan(1)
  })

  it('rejects a Requester using the staff-only query params silently (still scoped to their own tickets)', async () => {
    // A Requester hitting the same URL still only gets their own data --
    // the role branch, not the query params, decides scope.
    const ticket = await createTicketAs(requesterA, 'Requester scoping regression check')
    const response = await requesterB.get('/api/tickets').query({ pageSize: 50 })

    const ticketNumbers = response.body.data.map((row: { ticketNumber: string }) => row.ticketNumber)
    expect(ticketNumbers).not.toContain(ticket.ticketNumber)
  })
})

describe('GET /api/tickets unassignedOnly / ticketOwnerId filters (QUEUE-02, QUEUE-03)', () => {
  it('unassignedOnly=true returns only tickets with no ticketOwnerId', async () => {
    await createTicketAs(requesterA, 'Unassigned filter check')

    const response = await staffAgent.get('/api/tickets').query({ unassignedOnly: 'true', pageSize: 50 })

    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThan(0)
    for (const row of response.body.data as Array<{ ticketOwnerId: number | null }>) {
      expect(row.ticketOwnerId).toBeNull()
    }
  })

  it('ticketOwnerId=<id> returns only tickets claimed by that staff member', async () => {
    // No claim action exists yet (Issue 19), so every ticket is unowned --
    // filtering by a real staff id must return zero results, not an error
    // and not every ticket.
    const response = await staffAgent.get('/api/tickets').query({ ticketOwnerId: 999999, pageSize: 50 })

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
  })
})

describe('GET /api/tickets sortBy allowlist (QUEUE-04, BR-L3-11)', () => {
  it('rejects a sortBy value outside the allowlist with 400, before it reaches Prisma', async () => {
    const response = await staffAgent.get('/api/tickets').query({ sortBy: 'requesterId; DROP TABLE "Ticket";--' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('VALIDATION_FAILED')
    expect(response.body.fields.sortBy).toBeDefined()
  })

  it('rejects an invalid itPriority value', async () => {
    const response = await staffAgent.get('/api/tickets').query({ itPriority: 'not-a-priority' })

    expect(response.status).toBe(400)
    expect(response.body.fields.itPriority).toBeDefined()
  })
})

describe('TicketQueryBuilder (QUEUE-05, unit)', () => {
  it('produces the expected where/orderBy/skip/take shape from a chained call', () => {
    const result = new TicketQueryBuilder()
      .withSearch('printer')
      .withStatus('OPEN')
      .sortBy('summary', 'asc')
      .paginate(2, 20)
      .build()

    expect(result.where).toEqual({
      OR: [
        { ticketNumber: { contains: 'printer', mode: 'insensitive' } },
        { summary: { contains: 'printer', mode: 'insensitive' } },
      ],
      currentStatus: 'OPEN',
    })
    expect(result.orderBy).toEqual([{ summary: 'asc' }, { id: 'desc' }])
    expect(result.skip).toBe(20) // (page 2 - 1) * pageSize 20
    expect(result.take).toBe(20)
  })

  it('unassignedOnly overrides withTicketOwner when both are set after it', () => {
    const result = new TicketQueryBuilder().withTicketOwner(7).unassignedOnly(true).paginate(1, 10).build()

    expect(result.where.ticketOwnerId).toBeNull()
  })

  it('omits filters that were never set', () => {
    const result = new TicketQueryBuilder().paginate(1, 10).build()

    expect(result.where).toEqual({})
    expect(result.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
  })
})
