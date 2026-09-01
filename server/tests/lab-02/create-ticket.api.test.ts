import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'

async function activeRequesterId(): Promise<number> {
  const requester = await prisma.devRequester.findFirstOrThrow({ where: { isActive: true } })
  return requester.id
}

async function activeCategoryId(): Promise<number> {
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
  return category.id
}

async function activeRelatedSystemId(): Promise<number> {
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  return relatedSystem.id
}

async function validBody() {
  return {
    categoryId: await activeCategoryId(),
    relatedSystemId: await activeRelatedSystemId(),
    requestedPriority: 'MEDIUM',
    summary: 'Laptop battery drains quickly',
    description: 'My laptop battery is draining much faster than usual even when idle.',
  }
}

describe('POST /api/tickets', () => {
  it('creates a ticket and returns a unique Ticket Number (AC-01)', async () => {
    const requesterId = await activeRequesterId()
    const body = await validBody()

    const response = await request(app)
      .post('/api/tickets')
      .set('X-Dev-Requester-Id', String(requesterId))
      .send(body)

    expect(response.status).toBe(201)
    expect(response.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/)
    expect(response.body.currentStatus).toBe('NEW')
    expect(response.body.requesterId).toBe(requesterId)
  })

  it('rejects a request with no Development Requester context', async () => {
    const body = await validBody()

    const response = await request(app).post('/api/tickets').send(body)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_REQUIRED')
  })

  it('rejects a missing summary with a field-level message and creates no row (AC-04)', async () => {
    const requesterId = await activeRequesterId()
    const body = await validBody()
    const beforeCount = await prisma.ticket.count()

    const response = await request(app)
      .post('/api/tickets')
      .set('X-Dev-Requester-Id', String(requesterId))
      .send({ ...body, summary: '' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('VALIDATION_FAILED')
    expect(response.body.fields.summary).toBeDefined()
    expect(await prisma.ticket.count()).toBe(beforeCount)
  })

  it('rejects a summary shorter than 5 or longer than 150 characters (AC-05)', async () => {
    const requesterId = await activeRequesterId()
    const body = await validBody()

    const tooShort = await request(app)
      .post('/api/tickets')
      .set('X-Dev-Requester-Id', String(requesterId))
      .send({ ...body, summary: 'Hi' })
    expect(tooShort.status).toBe(400)
    expect(tooShort.body.fields.summary).toBeDefined()

    const tooLong = await request(app)
      .post('/api/tickets')
      .set('X-Dev-Requester-Id', String(requesterId))
      .send({ ...body, summary: 'x'.repeat(151) })
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.fields.summary).toBeDefined()
  })

  it('rejects an inactive or unknown Category and creates no row (AC-06)', async () => {
    const requesterId = await activeRequesterId()
    const body = await validBody()
    const beforeCount = await prisma.ticket.count()

    const response = await request(app)
      .post('/api/tickets')
      .set('X-Dev-Requester-Id', String(requesterId))
      .send({ ...body, categoryId: 999999 })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('VALIDATION_FAILED')
    expect(response.body.fields.categoryId).toBeDefined()
    expect(await prisma.ticket.count()).toBe(beforeCount)
  })
})
