import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { app } from '../helpers/app.js'
import { prisma } from '../../src/prisma.js'
import { loginAsNewUser } from '../helpers/users.js'

afterEach(() => {
  vi.restoreAllMocks()
})

const looksLikeLeak = (text: string) => /\bat\s+\S+\s+\(|node_modules|SyntaxError|prisma|boom/i.test(text)

describe('JSON error contract (SEC4-04, api-spec §0)', () => {
  it('answers malformed JSON with 400 INVALID_JSON as JSON, with no stack trace', async () => {
    const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json')
    expect(response.status).toBe(400)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual({ error: 'INVALID_JSON' })
    expect(looksLikeLeak(response.text)).toBe(false)
  })

  it('answers an unknown route with 404 NOT_FOUND as JSON', async () => {
    const response = await request(app).get('/api/this-route-does-not-exist')
    expect(response.status).toBe(404)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual({ error: 'NOT_FOUND' })
  })

  it('answers an oversized JSON body with 413 PAYLOAD_TOO_LARGE', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'x@y.test', password: 'a'.repeat(2_000_000) }))
    expect(response.status).toBe(413)
    expect(response.body).toEqual({ error: 'PAYLOAD_TOO_LARGE' })
  })

  it('answers an unexpected failure with 500 INTERNAL_ERROR and hides the cause', async () => {
    const { agent } = await loginAsNewUser('IT_STAFF')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(prisma.ticket, 'findUnique').mockRejectedValueOnce(new Error('boom: secret database detail'))

    const response = await agent.get('/api/tickets/1')
    expect(response.status).toBe(500)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual({ error: 'INTERNAL_ERROR' })
    expect(looksLikeLeak(response.text)).toBe(false)
  })

  it('logs the cause on the server so it can be found', async () => {
    const { agent } = await loginAsNewUser('IT_STAFF')
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(prisma.ticket, 'findUnique').mockRejectedValueOnce(new Error('boom: secret database detail'))

    await agent.get('/api/tickets/1')
    expect(logged).toHaveBeenCalled()
    expect(String(logged.mock.calls[0].join(' '))).toMatch(/GET \/api\/tickets\/1/)
  })
})
