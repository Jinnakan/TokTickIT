import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'

let requesterAId: number
let requesterBId: number
let categoryId: number
let relatedSystemId: number

async function createTicketAs(requesterId: number) {
  const response = await request(app)
    .post('/api/tickets')
    .set('X-Dev-Requester-Id', String(requesterId))
    .send({
      categoryId,
      relatedSystemId,
      requestedPriority: 'MEDIUM',
      summary: 'Ticket Detail ownership test ticket',
      description: 'Used to verify ownership checks on GET /api/tickets/:id.',
    })
  return response.body
}

beforeAll(async () => {
  const [requesterA, requesterB, category, relatedSystem] = await Promise.all([
    prisma.devRequester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    prisma.devRequester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' }, skip: 1 }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ])
  requesterAId = requesterA.id
  requesterBId = requesterB.id
  categoryId = category.id
  relatedSystemId = relatedSystem.id
})

describe('GET /api/tickets/:id', () => {
  it('returns the full ticket for its owner (AC-12)', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(ticket.id)
    expect(response.body.ticketNumber).toBe(ticket.ticketNumber)
  })

  it('returns 403 (not 404) when a different Requester owns the ticket (AC-03)', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('X-Dev-Requester-Id', String(requesterBId))

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('TICKET_FORBIDDEN')
  })

  it('returns 404 for an unknown ticket id', async () => {
    const response = await request(app)
      .get('/api/tickets/9999999')
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('TICKET_NOT_FOUND')
  })

  it('returns 404 for a non-numeric id rather than leaking a stack trace', async () => {
    const response = await request(app)
      .get('/api/tickets/not-a-number')
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('TICKET_NOT_FOUND')
  })

  it('rejects a request with no Development Requester context', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await request(app).get(`/api/tickets/${ticket.id}`)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_REQUIRED')
  })
})
