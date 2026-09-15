import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'

let requesterAId: number
let requesterBId: number
let categoryId: number
let relatedSystemId: number

async function createTicket(overrides: Partial<{
  requesterId: number
  summary: string
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH'
}> = {}) {
  const response = await request(app)
    .post('/api/tickets')
    .set('X-Dev-Requester-Id', String(overrides.requesterId ?? requesterAId))
    .send({
      categoryId,
      relatedSystemId,
      requestedPriority: overrides.requestedPriority ?? 'MEDIUM',
      summary: overrides.summary ?? 'Default seeded ticket summary',
      description: 'Seeded description used across My Tickets list tests.',
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

describe('GET /api/tickets', () => {
  it('rejects a request with no Development Requester context', async () => {
    const response = await request(app).get('/api/tickets')
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_REQUIRED')
  })

  it('only returns tickets owned by the selected Requester (AC-03, BR-12)', async () => {
    const ticket = await createTicket({ requesterId: requesterAId, summary: 'Requester A isolation check' })

    const asRequesterB = await request(app)
      .get('/api/tickets')
      .set('X-Dev-Requester-Id', String(requesterBId))

    expect(asRequesterB.status).toBe(200)
    const ticketNumbers = asRequesterB.body.data.map((row: { ticketNumber: string }) => row.ticketNumber)
    expect(ticketNumbers).not.toContain(ticket.ticketNumber)
  })

  it('returns an empty result set with zero totalItems for a search with no matches (AC-10)', async () => {
    const response = await request(app)
      .get('/api/tickets')
      .query({ search: 'no-such-ticket-summary-xyz' })
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
    expect(response.body.meta.totalItems).toBe(0)
  })

  it('finds a ticket by partial, case-insensitive summary search', async () => {
    const ticket = await createTicket({ requesterId: requesterAId, summary: 'Docking station not detected' })

    const response = await request(app)
      .get('/api/tickets')
      .query({ search: 'docking station' })
      .set('X-Dev-Requester-Id', String(requesterAId))

    const ticketNumbers = response.body.data.map((row: { ticketNumber: string }) => row.ticketNumber)
    expect(ticketNumbers).toContain(ticket.ticketNumber)
  })

  it('paginates correctly and reports totalPages (AC-11)', async () => {
    for (let index = 0; index < 3; index += 1) {
      await createTicket({ requesterId: requesterAId, summary: `Pagination check ticket ${index}` })
    }

    const response = await request(app)
      .get('/api/tickets')
      .query({ page: 1, pageSize: 2 })
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(200)
    expect(response.body.data.length).toBe(2)
    expect(response.body.meta.page).toBe(1)
    expect(response.body.meta.pageSize).toBe(2)
    expect(response.body.meta.totalPages).toBe(Math.ceil(response.body.meta.totalItems / 2))
  })

  it('clamps an out-of-range pageSize to the maximum (BR-15)', async () => {
    const response = await request(app)
      .get('/api/tickets')
      .query({ pageSize: 999 })
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(200)
    expect(response.body.meta.pageSize).toBe(50)
  })

  it('rejects an invalid sortBy value', async () => {
    const response = await request(app)
      .get('/api/tickets')
      .query({ sortBy: 'not-a-real-field' })
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(400)
    expect(response.body.fields.sortBy).toBeDefined()
  })

  it('sorts by summary ascending when requested', async () => {
    await createTicket({ requesterId: requesterAId, summary: 'AAA first alphabetically' })
    await createTicket({ requesterId: requesterAId, summary: 'ZZZ last alphabetically' })

    const response = await request(app)
      .get('/api/tickets')
      .query({ sortBy: 'summary', sortDir: 'asc', pageSize: 50 })
      .set('X-Dev-Requester-Id', String(requesterAId))

    const summaries: string[] = response.body.data.map((row: { summary: string }) => row.summary)
    const sorted = [...summaries].sort((a, b) => a.localeCompare(b))
    expect(summaries).toEqual(sorted)
  })
})
