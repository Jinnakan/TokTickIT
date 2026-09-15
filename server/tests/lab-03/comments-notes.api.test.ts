import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'
import { loginAsItStaff, loginAsRequester, type AuthenticatedAgent } from '../helpers/session.js'

// Comments half from Issue 17; the Notes half (CN-04, CN-05) and IT Staff
// comment access land here in Issue 19.

let agentA: AuthenticatedAgent
let agentB: AuthenticatedAgent
let staffAgent: AuthenticatedAgent
let categoryId: number
let relatedSystemId: number

async function createTicketAs(agent: AuthenticatedAgent) {
  const response = await agent.post('/api/tickets').send({
    categoryId,
    relatedSystemId,
    requestedPriority: 'MEDIUM',
    summary: 'Comments test ticket',
    description: 'Used to verify Public Comments behavior.',
  })
  return response.body
}

beforeAll(async () => {
  const [requesterA, requesterB, staff, category, relatedSystem] = await Promise.all([
    loginAsRequester(0),
    loginAsRequester(1),
    loginAsItStaff(),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ])
  agentA = requesterA.agent
  agentB = requesterB.agent
  staffAgent = staff.agent
  categoryId = category.id
  relatedSystemId = relatedSystem.id
})

describe('POST /api/tickets/:id/comments', () => {
  it('creates a comment on the Requester\'s own ticket (CN-01, FR-L3-07)', async () => {
    const ticket = await createTicketAs(agentA)

    const response = await agentA
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: 'Still happening after a reboot.' })

    expect(response.status).toBe(201)
    expect(response.body.body).toBe('Still happening after a reboot.')
    expect(response.body.ticketId).toBe(ticket.id)
    expect(response.body.authorName).toBeTruthy()

    const stored = await prisma.publicComment.findUnique({ where: { id: response.body.id } })
    expect(stored?.authorId).toBeTruthy()
  })

  it('rejects posting to a ticket owned by a different Requester (CN-02, AC-L3-07)', async () => {
    const ticket = await createTicketAs(agentA)
    const beforeCount = await prisma.publicComment.count({ where: { ticketId: ticket.id } })

    const response = await agentB
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: 'Trying to comment on someone else\'s ticket.' })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('TICKET_FORBIDDEN')
    expect(await prisma.publicComment.count({ where: { ticketId: ticket.id } })).toBe(beforeCount)
  })

  it('rejects an unauthenticated request', async () => {
    const ticket = await createTicketAs(agentA)

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: 'No session here.' })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('UNAUTHENTICATED')
  })

  it('rejects an empty or over-length body', async () => {
    const ticket = await createTicketAs(agentA)

    const empty = await agentA.post(`/api/tickets/${ticket.id}/comments`).send({ body: '' })
    expect(empty.status).toBe(400)
    expect(empty.body.error).toBe('VALIDATION_FAILED')

    const tooLong = await agentA.post(`/api/tickets/${ticket.id}/comments`).send({ body: 'x'.repeat(2001) })
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error).toBe('VALIDATION_FAILED')
  })

  it('stores HTML/script-like text verbatim as data, not executable markup (CN-03, AC-L3-13, BR-L3-12)', async () => {
    const ticket = await createTicketAs(agentA)
    const payload = '<script>alert(1)</script> and <img src=x onerror=alert(2)>'

    const response = await agentA.post(`/api/tickets/${ticket.id}/comments`).send({ body: payload })

    expect(response.status).toBe(201)
    // Stored and returned byte-for-byte as text -- the API never strips or
    // transforms it, because safety comes from how the client renders it
    // (plain text interpolation, never dangerouslySetInnerHTML), not from
    // server-side sanitization.
    expect(response.body.body).toBe(payload)

    const listed = await agentA.get(`/api/tickets/${ticket.id}/comments`)
    const found = listed.body.find((comment: { id: number }) => comment.id === response.body.id)
    expect(found.body).toBe(payload)
  })

  it('has no edit or delete route (append-only by construction, CN-06, BR-L3-16)', async () => {
    const ticket = await createTicketAs(agentA)
    const created = await agentA.post(`/api/tickets/${ticket.id}/comments`).send({ body: 'Original text.' })

    const patchAttempt = await agentA
      .patch(`/api/tickets/${ticket.id}/comments/${created.body.id}`)
      .send({ body: 'Edited text.' })
    expect(patchAttempt.status).toBe(404)

    const deleteAttempt = await agentA.delete(`/api/tickets/${ticket.id}/comments/${created.body.id}`)
    expect(deleteAttempt.status).toBe(404)
  })
})

describe('GET /api/tickets/:id/comments', () => {
  it('returns comments oldest-first (CN-07)', async () => {
    const ticket = await createTicketAs(agentA)
    await agentA.post(`/api/tickets/${ticket.id}/comments`).send({ body: 'First comment.' })
    await agentA.post(`/api/tickets/${ticket.id}/comments`).send({ body: 'Second comment.' })

    const response = await agentA.get(`/api/tickets/${ticket.id}/comments`)

    expect(response.status).toBe(200)
    expect(response.body.length).toBe(2)
    expect(response.body[0].body).toBe('First comment.')
    expect(response.body[1].body).toBe('Second comment.')
  })

  it('rejects reading comments on a ticket owned by a different Requester', async () => {
    const ticket = await createTicketAs(agentA)
    await agentA.post(`/api/tickets/${ticket.id}/comments`).send({ body: 'Owner-only comment.' })

    const response = await agentB.get(`/api/tickets/${ticket.id}/comments`)

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('TICKET_FORBIDDEN')
  })

  it('returns an empty array for a ticket with no comments yet', async () => {
    const ticket = await createTicketAs(agentA)

    const response = await agentA.get(`/api/tickets/${ticket.id}/comments`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })
})

describe('IT Staff comment access on any ticket (Issue 19)', () => {
  it('lets IT Staff read and post comments on a ticket they do not own', async () => {
    const ticket = await createTicketAs(agentA)

    const posted = await staffAgent.post(`/api/tickets/${ticket.id}/comments`).send({ body: 'Looking into this.' })
    expect(posted.status).toBe(201)

    const listed = await staffAgent.get(`/api/tickets/${ticket.id}/comments`)
    expect(listed.status).toBe(200)
    expect(listed.body.some((comment: { body: string }) => comment.body === 'Looking into this.')).toBe(true)
  })
})

describe('POST /api/tickets/:id/notes (CN-04, FR-L3-08)', () => {
  it('creates an internal note in InternalNote, not PublicComment', async () => {
    const ticket = await createTicketAs(agentA)

    const response = await staffAgent.post(`/api/tickets/${ticket.id}/notes`).send({ body: 'Escalating to network team.' })

    expect(response.status).toBe(201)
    expect(response.body.body).toBe('Escalating to network team.')

    const note = await prisma.internalNote.findUnique({ where: { id: response.body.id } })
    expect(note).not.toBeNull()

    // PublicComment and InternalNote have independent id sequences, so a
    // matching id in both tables is expected and not a bug -- the real
    // check is that this note's body never landed in PublicComment too.
    const commentsForTicket = await prisma.publicComment.findMany({ where: { ticketId: ticket.id } })
    expect(commentsForTicket.some((comment) => comment.body === 'Escalating to network team.')).toBe(false)
  })

  it('rejects a Requester posting a note, even on their own ticket, with 403 not 404 (BR-L3-17)', async () => {
    const ticket = await createTicketAs(agentA)

    const response = await agentA.post(`/api/tickets/${ticket.id}/notes`).send({ body: 'Should never be allowed.' })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })
})

describe('GET /api/tickets/:id/notes (CN-05, AC-L3-08, BR-L3-17)', () => {
  it('rejects a Requester reading notes on their own ticket, leaking no note content', async () => {
    const ticket = await createTicketAs(agentA)
    await staffAgent.post(`/api/tickets/${ticket.id}/notes`).send({ body: 'Secret internal detail.' })

    const response = await agentA.get(`/api/tickets/${ticket.id}/notes`)

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('FORBIDDEN')
    expect(JSON.stringify(response.body)).not.toContain('Secret internal detail')
  })

  it('lets IT Staff read notes on any ticket', async () => {
    const ticket = await createTicketAs(agentA)
    await staffAgent.post(`/api/tickets/${ticket.id}/notes`).send({ body: 'Visible to staff only.' })

    const response = await staffAgent.get(`/api/tickets/${ticket.id}/notes`)

    expect(response.status).toBe(200)
    expect(response.body.some((note: { body: string }) => note.body === 'Visible to staff only.')).toBe(true)
  })

  it('rejects an unauthenticated request', async () => {
    const ticket = await createTicketAs(agentA)

    const response = await request(app).get(`/api/tickets/${ticket.id}/notes`)

    expect(response.status).toBe(401)
  })
})
