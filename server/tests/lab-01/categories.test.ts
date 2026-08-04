import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'

describe('GET /api/categories', () => {
  it('returns the starter category list', async () => {
    const response = await request(app).get('/api/categories')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { id: 1, name: 'Account and Access' },
      { id: 2, name: 'Hardware' },
      { id: 3, name: 'Software' },
      { id: 4, name: 'Network' },
    ])
  })
})
