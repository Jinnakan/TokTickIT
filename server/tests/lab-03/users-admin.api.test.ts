import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'
import { PasswordHasher } from '../../src/auth/password-hasher.js'
import { loginAsAdministrator, loginAsRequester } from '../helpers/session.js'

async function createUniqueAdmin() {
  const hasher = PasswordHasher.getInstance()
  const email = `extra-admin-${Date.now()}@toktickit.test`
  return prisma.user.create({
    data: {
      name: 'Extra Admin',
      email,
      role: 'ADMINISTRATOR',
      isActive: true,
      passwordHash: await hasher.hash('DevPass123!'),
    },
  })
}

describe('GET /api/users (USER-01, FR-L3-13)', () => {
  it('filters by search, role, and isActive', async () => {
    const { agent } = await loginAsAdministrator()

    const byRole = await agent.get('/api/users').query({ role: 'IT_STAFF', pageSize: 50 })
    expect(byRole.status).toBe(200)
    expect(byRole.body.data.every((user: { role: string }) => user.role === 'IT_STAFF')).toBe(true)

    const bySearch = await agent.get('/api/users').query({ search: 'jennifer' })
    expect(bySearch.status).toBe(200)
    expect(bySearch.body.data.some((user: { name: string }) => user.name.includes('Jennifer'))).toBe(true)

    const byActive = await agent.get('/api/users').query({ isActive: 'false', pageSize: 50 })
    expect(byActive.status).toBe(200)
    expect(byActive.body.data.every((user: { isActive: boolean }) => user.isActive === false)).toBe(true)
  })

  it('rejects a Requester', async () => {
    const { agent } = await loginAsRequester()
    const response = await agent.get('/api/users')
    expect(response.status).toBe(403)
  })
})

describe('POST /api/users (USER-02, USER-03, AC-L3-14, BR-L3-19)', () => {
  it('creates a user and returns initialPassword only in this response', async () => {
    const { agent } = await loginAsAdministrator()
    const email = `new-user-${Date.now()}@toktickit.test`

    const created = await agent.post('/api/users').send({ name: 'New Person', email, role: 'IT_STAFF' })

    expect(created.status).toBe(201)
    expect(created.body.initialPassword).toBeTruthy()
    expect(created.body.mustChangePassword).toBe(true)

    const listed = await agent.get('/api/users').query({ search: email })
    const found = listed.body.data.find((user: { email: string }) => user.email === email)
    expect(found.initialPassword).toBeUndefined()
  })

  it('rejects a duplicate email with 400 EMAIL_TAKEN', async () => {
    const { agent } = await loginAsAdministrator()
    const email = `dup-user-${Date.now()}@toktickit.test`
    await agent.post('/api/users').send({ name: 'First', email, role: 'REQUESTER' })

    const dup = await agent.post('/api/users').send({ name: 'Second', email, role: 'REQUESTER' })

    expect(dup.status).toBe(400)
    expect(dup.body.error).toBe('EMAIL_TAKEN')
  })

  it('rejects a missing/invalid role', async () => {
    const { agent } = await loginAsAdministrator()
    const response = await agent.post('/api/users').send({ name: 'X', email: `x-${Date.now()}@toktickit.test`, role: 'SUPERUSER' })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('VALIDATION_FAILED')
  })
})

describe('POST /api/users/:id/reset-password (USER-04, FR-L3-16, BR-L3-19)', () => {
  it('sets a new password shown once and invalidates the old one', async () => {
    const { agent } = await loginAsAdministrator()
    const email = `reset-target-${Date.now()}@toktickit.test`
    const created = await agent.post('/api/users').send({ name: 'Reset Target', email, role: 'REQUESTER' })
    const oldPassword = created.body.initialPassword

    const reset = await agent.post(`/api/users/${created.body.id}/reset-password`)
    expect(reset.status).toBe(200)
    expect(reset.body.initialPassword).toBeTruthy()
    expect(reset.body.initialPassword).not.toBe(oldPassword)

    const oldLogin = await agent.post('/api/auth/login').send({ email, password: oldPassword })
    expect(oldLogin.status).toBe(401)

    const newLogin = await agent.post('/api/auth/login').send({ email, password: reset.body.initialPassword })
    expect(newLogin.status).toBe(200)
    expect(newLogin.body.mustChangePassword).toBe(true)
  })
})

describe('POST /api/users/:id/deactivate (USER-05, USER-06, AC-L3-15, BR-L3-18, FR-L3-17)', () => {
  it('deactivates a user and immediately invalidates their session', async () => {
    // A dedicated throwaway account, never a shared seeded Requester --
    // deactivating one of those would shift what loginAsRequester(0) picks
    // for every other test file sharing this database.
    const { agent: adminAgent } = await loginAsAdministrator()
    const email = `deactivate-target-${Date.now()}@toktickit.test`
    const created = await adminAgent.post('/api/users').send({ name: 'Deactivate Target', email, role: 'REQUESTER' })

    const requesterAgent = request.agent(app)
    const login = await requesterAgent
      .post('/api/auth/login')
      .set('Origin', process.env.APP_ORIGIN ?? 'http://localhost:5173')
      .send({ email, password: created.body.initialPassword })
    expect(login.status).toBe(200)

    const meBefore = await requesterAgent.get('/api/auth/me')
    expect(meBefore.status).toBe(200)

    const response = await adminAgent.post(`/api/users/${created.body.id}/deactivate`)
    expect(response.status).toBe(200)
    expect(response.body.isActive).toBe(false)

    const meAfter = await requesterAgent.get('/api/auth/me')
    expect(meAfter.status).toBe(401)
  })

  it('is idempotent when called twice', async () => {
    const { agent: adminAgent } = await loginAsAdministrator()
    const email = `deactivate-twice-${Date.now()}@toktickit.test`
    const created = await adminAgent.post('/api/users').send({ name: 'Twice', email, role: 'REQUESTER' })

    const first = await adminAgent.post(`/api/users/${created.body.id}/deactivate`)
    expect(first.status).toBe(200)

    const second = await adminAgent.post(`/api/users/${created.body.id}/deactivate`)
    expect(second.status).toBe(200)
    expect(second.body.isActive).toBe(false)
  })

  it('rejects an Administrator deactivating their own account', async () => {
    const { agent, userId } = await loginAsAdministrator()
    const response = await agent.post(`/api/users/${userId}/deactivate`)
    expect(response.status).toBe(409)
    expect(response.body.error).toBe('SELF_DEACTIVATION')
  })

})

describe('Last-Administrator protection (defense-in-depth)', () => {
  it('rejects an Administrator demoting their own role when they are the last active Administrator', async () => {
    // Deactivating yourself is already blocked by SELF_DEACTIVATION, and
    // deactivating anyone else always leaves the acting admin active -- so
    // the realistic path to "zero active Administrators" is self-demotion
    // via role change while being the last one, which PATCH allows unless
    // guarded. Directly deactivate every other admin (bypassing their
    // sessions, since we're not testing those) so exactly one remains,
    // then log in as that one (loginAsAdministrator filters isActive: true,
    // so it naturally finds this survivor).
    const extraAdmin = await createUniqueAdmin()
    const otherAdminIds = (
      await prisma.user.findMany({ where: { role: 'ADMINISTRATOR', id: { not: extraAdmin.id } } })
    ).map((user) => user.id)
    await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { isActive: false } })

    try {
      const { agent } = await loginAsAdministrator()

      const response = await agent.patch(`/api/users/${extraAdmin.id}`).send({ role: 'REQUESTER' })

      expect(response.status).toBe(409)
      expect(response.body.error).toBe('LAST_ADMINISTRATOR')
    } finally {
      // Restore so later tests (in this file and others sharing this DB)
      // still have an active seeded admin to log in as.
      await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { isActive: true } })
    }
  })
})

describe('PATCH /api/users/:id (USER-07, BR-L3-01)', () => {
  it('rejects a role value outside the three valid roles', async () => {
    const { agent } = await loginAsAdministrator()
    const email = `patch-role-${Date.now()}@toktickit.test`
    const created = await agent.post('/api/users').send({ name: 'Patchable', email, role: 'REQUESTER' })

    const response = await agent.patch(`/api/users/${created.body.id}`).send({ role: 'SUPER_ADMIN' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('VALIDATION_FAILED')

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(stored.role).toBe('REQUESTER')
  })

  it('updates name and role for a valid request', async () => {
    const { agent } = await loginAsAdministrator()
    const email = `patch-valid-${Date.now()}@toktickit.test`
    const created = await agent.post('/api/users').send({ name: 'Before', email, role: 'REQUESTER' })

    const response = await agent.patch(`/api/users/${created.body.id}`).send({ name: 'After', role: 'IT_STAFF' })

    expect(response.status).toBe(200)
    expect(response.body.name).toBe('After')
    expect(response.body.role).toBe('IT_STAFF')
  })

  it('returns 404 for an unknown user', async () => {
    const { agent } = await loginAsAdministrator()
    const response = await agent.patch('/api/users/9999999').send({ name: 'X' })
    expect(response.status).toBe(404)
    expect(response.body.error).toBe('USER_NOT_FOUND')
  })
})
