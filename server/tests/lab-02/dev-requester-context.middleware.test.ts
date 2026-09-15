import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { requireDevRequester } from '../../src/dev-requester-context.js'
import { prisma } from '../../src/prisma.js'

function buildTestApp() {
  const testApp = express()
  testApp.get('/protected', requireDevRequester, (_request, response) => {
    response.status(200).json({ devRequesterId: response.locals.devRequesterId })
  })
  return testApp
}

describe('requireDevRequester middleware', () => {
  it('rejects a missing header', async () => {
    const response = await request(buildTestApp()).get('/protected')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_REQUIRED')
  })

  it('rejects a non-numeric header', async () => {
    const response = await request(buildTestApp())
      .get('/protected')
      .set('X-Dev-Requester-Id', 'abc')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_REQUIRED')
  })

  it('rejects an unknown requester id', async () => {
    const response = await request(buildTestApp())
      .get('/protected')
      .set('X-Dev-Requester-Id', '999999')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_INVALID')
  })

  it('rejects an inactive requester id', async () => {
    const inactive = await prisma.devRequester.findFirstOrThrow({ where: { isActive: false } })

    const response = await request(buildTestApp())
      .get('/protected')
      .set('X-Dev-Requester-Id', String(inactive.id))

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_INVALID')
  })

  it('accepts an active requester id and sets res.locals.devRequesterId', async () => {
    const active = await prisma.devRequester.findFirstOrThrow({ where: { isActive: true } })

    const response = await request(buildTestApp())
      .get('/protected')
      .set('X-Dev-Requester-Id', String(active.id))

    expect(response.status).toBe(200)
    expect(response.body.devRequesterId).toBe(active.id)
  })
})
