import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'
import { loginAsRequester, type AuthenticatedAgent } from '../helpers/session.js'

let agentA: AuthenticatedAgent
let agentB: AuthenticatedAgent
let categoryId: number
let relatedSystemId: number

async function createTicket(
  agent: AuthenticatedAgent,
  overrides: Partial<{ summary: string; requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' }> = {},
) {
  const response = await agent.post('/api/tickets').send({
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
    loginAsRequester(0),
    loginAsRequester(1),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ])
  agentA = requesterA.agent
  agentB = requesterB.agent
  categoryId = category.id
  relatedSystemId = relatedSystem.id
})

describe('GET /api/tickets', () => {
  it('rejects a request with no session', async () => {
    const response = await request(app).get('/api/tickets')
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('UNAUTHENTICATED')
  })

  it('only returns tickets owned by the selected Requester (AC-03, BR-12)', async () => {
    const ticket = await createTicket(agentA, { summary: 'Requester A isolation check' })

    const asRequesterB = await agentB.get('/api/tickets')

    expect(asRequesterB.status).toBe(200)
    const ticketNumbers = asRequesterB.body.data.map((row: { ticketNumber: string }) => row.ticketNumber)
    expect(ticketNumbers).not.toContain(ticket.ticketNumber)
  })

  it('returns an empty result set with zero totalItems for a search with no matches (AC-10)', async () => {
    const response = await agentA.get('/api/tickets').query({ search: 'no-such-ticket-summary-xyz' })

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
    expect(response.body.meta.totalItems).toBe(0)
  })

  it('finds a ticket by partial, case-insensitive summary search', async () => {
    const ticket = await createTicket(agentA, { summary: 'Docking station not detected' })

    const response = await agentA.get('/api/tickets').query({ search: 'docking station' })

    const ticketNumbers = response.body.data.map((row: { ticketNumber: string }) => row.ticketNumber)
    expect(ticketNumbers).toContain(ticket.ticketNumber)
  })

  it('paginates correctly and reports totalPages (AC-11)', async () => {
    for (let index = 0; index < 3; index += 1) {
      await createTicket(agentA, { summary: `Pagination check ticket ${index}` })
    }

    const response = await agentA.get('/api/tickets').query({ page: 1, pageSize: 2 })

    expect(response.status).toBe(200)
    expect(response.body.data.length).toBe(2)
    expect(response.body.meta.page).toBe(1)
    expect(response.body.meta.pageSize).toBe(2)
    expect(response.body.meta.totalPages).toBe(Math.ceil(response.body.meta.totalItems / 2))
  })

  it('clamps an out-of-range pageSize to the maximum (BR-15)', async () => {
    const response = await agentA.get('/api/tickets').query({ pageSize: 999 })

    expect(response.status).toBe(200)
    expect(response.body.meta.pageSize).toBe(50)
  })

  it('rejects an invalid sortBy value', async () => {
    const response = await agentA.get('/api/tickets').query({ sortBy: 'not-a-real-field' })

    expect(response.status).toBe(400)
    expect(response.body.fields.sortBy).toBeDefined()
  })

  it('sorts by summary ascending when requested', async () => {
    await createTicket(agentA, { summary: 'AAA first alphabetically' })
    await createTicket(agentA, { summary: 'ZZZ last alphabetically' })

    const response = await agentA.get('/api/tickets').query({ sortBy: 'summary', sortDir: 'asc', pageSize: 50 })

    const summaries: string[] = response.body.data.map((row: { summary: string }) => row.summary)
    const sorted = [...summaries].sort((a, b) => a.localeCompare(b))
    expect(summaries).toEqual(sorted)
  })
})
