import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'
import { requirePasswordAlreadyChanged, requireSession } from '../../src/auth/require-session.js'
import { SEED_PASSWORD } from '../../prisma/seed-data.js'

const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5173'
const ACTIVE_REQUESTER_EMAIL = 'jennifer.anderson@toktickit.test'
const INACTIVE_REQUESTER_EMAIL = 'former.student@toktickit.test'

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and sets a session cookie (AC-L3-01)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    expect(response.status).toBe(200)
    expect(response.body.email).toBe(ACTIVE_REQUESTER_EMAIL)
    expect(response.body.role).toBe('REQUESTER')
    expect(response.headers['set-cookie']?.[0]).toMatch(/toktickit_session=/)
  })

  it('rejects a wrong password with the generic invalid-credentials message (AC-L3-02)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_REQUESTER_EMAIL, password: 'not-the-password' })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('INVALID_CREDENTIALS')
    expect(response.body.message).toBe('Invalid email or password.')
  })

  it('rejects an unknown email with the identical message (AC-L3-02)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-such-person@toktickit.test', password: SEED_PASSWORD })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('INVALID_CREDENTIALS')
    expect(response.body.message).toBe('Invalid email or password.')
  })

  it('rejects an inactive account with the identical message (AC-L3-02)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: INACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('INVALID_CREDENTIALS')
    expect(response.body.message).toBe('Invalid email or password.')
  })

  it('regenerates the session id on every successful login (BR-L3-06)', async () => {
    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })
    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    const firstCookie = first.headers['set-cookie']?.[0]
    const secondCookie = second.headers['set-cookie']?.[0]

    expect(firstCookie).toBeDefined()
    expect(secondCookie).toBeDefined()
    expect(firstCookie).not.toBe(secondCookie)
  })

  it('locks out an email+IP after repeated failures and clears after the window (AC-L3-06, BR-L3-08)', async () => {
    process.env.LOGIN_LOCKOUT_MAX_ATTEMPTS = '3'
    process.env.LOGIN_LOCKOUT_WINDOW_MS = '200'
    const email = 'lockout-target@toktickit.test'

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const failed = await request(app).post('/api/auth/login').send({ email, password: 'wrong' })
      expect(failed.status).toBe(401)
    }

    const lockedOut = await request(app)
      .post('/api/auth/login')
      .send({ email, password: SEED_PASSWORD }) // correct password, still locked out
    expect(lockedOut.status).toBe(429)
    expect(lockedOut.body.error).toBe('TOO_MANY_ATTEMPTS')

    await new Promise((resolve) => setTimeout(resolve, 250))

    const afterWindow = await request(app).post('/api/auth/login').send({ email, password: 'wrong' })
    expect(afterWindow.status).toBe(401) // window cleared -- rejected for wrong password, not locked out

    delete process.env.LOGIN_LOCKOUT_MAX_ATTEMPTS
    delete process.env.LOGIN_LOCKOUT_WINDOW_MS
  })

  it('rejects a missing email or password before touching the database', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: '', password: '' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('VALIDATION_FAILED')
    expect(response.body.fields.email).toBeDefined()
    expect(response.body.fields.password).toBeDefined()
  })
})

describe('POST /api/auth/logout', () => {
  it('deletes the session server-side, not just the cookie (FR-L3-03)', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    const logoutResponse = await agent.post('/api/auth/logout').set('Origin', ALLOWED_ORIGIN)
    expect(logoutResponse.status).toBe(200)

    const meAfterLogout = await agent.get('/api/auth/me')
    expect(meAfterLogout.status).toBe(401)
  })

  it('rejects logout with no session (AC-L3-04)', async () => {
    const response = await request(app).post('/api/auth/logout').set('Origin', ALLOWED_ORIGIN)
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('UNAUTHENTICATED')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid session', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    const response = await agent.get('/api/auth/me')
    expect(response.status).toBe(200)
    expect(response.body.email).toBe(ACTIVE_REQUESTER_EMAIL)
  })

  it('rejects an unauthenticated request (AC-L3-04)', async () => {
    const response = await request(app).get('/api/auth/me')
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('UNAUTHENTICATED')
  })
})

describe('POST /api/auth/change-password', () => {
  const email = 'change-password-target@toktickit.test'

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash: await hashSeedPassword(), mustChangePassword: true },
      create: {
        email,
        name: 'Change Password Target',
        role: 'REQUESTER',
        isActive: true,
        mustChangePassword: true,
        passwordHash: await hashSeedPassword(),
      },
    })
  })

  it('rejects a wrong current password (400 CURRENT_PASSWORD_INVALID)', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email, password: SEED_PASSWORD })

    const response = await agent
      .post('/api/auth/change-password')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ currentPassword: 'wrong-current', newPassword: 'BrandNewPass1!' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('CURRENT_PASSWORD_INVALID')
  })

  it('changes the password, clears mustChangePassword, and the new password authenticates next login', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email, password: SEED_PASSWORD })

    const changeResponse = await agent
      .post('/api/auth/change-password')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ currentPassword: SEED_PASSWORD, newPassword: 'BrandNewPass1!' })
    expect(changeResponse.status).toBe(200)

    const meResponse = await agent.get('/api/auth/me')
    expect(meResponse.body.mustChangePassword).toBe(false)

    const reloginOld = await request(app).post('/api/auth/login').send({ email, password: SEED_PASSWORD })
    expect(reloginOld.status).toBe(401)

    const reloginNew = await request(app).post('/api/auth/login').send({ email, password: 'BrandNewPass1!' })
    expect(reloginNew.status).toBe(200)
  })

  it('is reachable even while mustChangePassword is true (not blocked by the password-change gate)', async () => {
    const agent = request.agent(app)
    const loginResponse = await agent.post('/api/auth/login').send({ email, password: SEED_PASSWORD })
    expect(loginResponse.body.mustChangePassword).toBe(true)

    const response = await agent
      .post('/api/auth/change-password')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ currentPassword: SEED_PASSWORD, newPassword: 'BrandNewPass1!' })

    expect(response.status).toBe(200)
  })
})

// AUTH-06 (AC-L3-03, BR-L3-07): requirePasswordAlreadyChanged has no real
// protected non-auth route to guard yet in Issue 15 (every other route
// still runs on the Lab 2 X-Dev-Requester-Id header, migrated to sessions
// in Issue 16+). A minimal test-only app exercises the middleware pair in
// isolation, the same pattern Lab 2's dev-requester-context test used.
describe('requirePasswordAlreadyChanged middleware (AUTH-06)', () => {
  const testApp = express()
  testApp.use(cookieParser())
  testApp.get('/protected', requireSession, requirePasswordAlreadyChanged, (_request, response) => {
    response.status(200).json({ ok: true })
  })

  it('blocks a session with mustChangePassword true', async () => {
    const email = 'gate-target@toktickit.test'
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash: await hashSeedPassword(), mustChangePassword: true },
      create: {
        email,
        name: 'Gate Target',
        role: 'REQUESTER',
        isActive: true,
        mustChangePassword: true,
        passwordHash: await hashSeedPassword(),
      },
    })

    const cookie = await loginCookieFor(email)
    const response = await request(testApp).get('/protected').set('Cookie', cookie)

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('PASSWORD_CHANGE_REQUIRED')
  })

  it('allows a session with mustChangePassword false', async () => {
    const cookie = await loginCookieFor(ACTIVE_REQUESTER_EMAIL)

    const response = await request(testApp).get('/protected').set('Cookie', cookie)

    expect(response.status).toBe(200)
  })
})

describe('Origin/Referer check on mutating session-protected routes (AUTH-10, AC-L3-16)', () => {
  it('rejects a mutating request with no Origin/Referer header', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    const response = await agent.post('/api/auth/logout')

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('ORIGIN_MISMATCH')
  })

  it('rejects a mutating request with a mismatched Origin', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    const response = await agent.post('/api/auth/logout').set('Origin', 'https://evil.example.com')

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('ORIGIN_MISMATCH')
  })

  it('allows a mutating request with a matching Origin', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD })

    const response = await agent.post('/api/auth/logout').set('Origin', ALLOWED_ORIGIN)

    expect(response.status).toBe(200)
  })
})

async function hashSeedPassword(): Promise<string> {
  const { PasswordHasher } = await import('../../src/auth/password-hasher.js')
  return PasswordHasher.getInstance().hash(SEED_PASSWORD)
}

async function loginCookieFor(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password: SEED_PASSWORD })
  const cookie = response.headers['set-cookie']?.[0]
  if (!cookie) throw new Error(`login failed for ${email} while building a test cookie`)
  return cookie
}
