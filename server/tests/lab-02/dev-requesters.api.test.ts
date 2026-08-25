import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'

describe('GET /api/dev-requesters', () => {
  it('returns only active development requesters', async () => {
    const response = await request(app).get('/api/dev-requesters')

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body.length).toBeGreaterThanOrEqual(4)

    const emails = response.body.map((requester: { email: string }) => requester.email)
    expect(emails).toContain('jennifer.anderson@toktickit.test')
    expect(emails).not.toContain('former.student@toktickit.test')

    for (const requester of response.body) {
      expect(requester).toHaveProperty('id')
      expect(requester).toHaveProperty('name')
      expect(requester).toHaveProperty('email')
    }
  })
})
