import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'
import { loginAsAdministrator, loginAsItStaff, loginAsRequester } from '../helpers/session.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_SRC = path.resolve(__dirname, '..', '..', 'src')

function walkTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walkTsFiles(full)
    return full.endsWith('.ts') ? [full] : []
  })
}

// --- SEC-02, BR-L3-21: command injection has no real attack surface here,
// so the mitigation is proving the surface stays at zero -- a static scan,
// not a runtime fix. ---
describe('Command injection guard (SEC-02, BR-L3-21)', () => {
  it('server/src never imports child_process, exec, or spawn', () => {
    const offenders: string[] = []
    for (const file of walkTsFiles(SERVER_SRC)) {
      const content = readFileSync(file, 'utf-8')
      if (/child_process|\bexec\(|\bspawn\(/.test(content)) {
        offenders.push(path.relative(SERVER_SRC, file))
      }
    }
    expect(offenders).toEqual([])
  })
})

// --- SQL injection: Prisma-only access is the design claim (BR-L3-11);
// this makes it an enforced invariant, not just documentation. The tagged-
// template $queryRaw calls that DO exist (ticket-row locking) are safe --
// Prisma parameterizes interpolated values in that form. What must never
// appear is the *Unsafe variant, which accepts raw concatenated strings. ---
describe('SQL injection guard (BR-L3-11)', () => {
  it('server/src never calls $queryRawUnsafe or $executeRawUnsafe', () => {
    const offenders: string[] = []
    for (const file of walkTsFiles(SERVER_SRC)) {
      const content = readFileSync(file, 'utf-8')
      if (/\$(queryRawUnsafe|executeRawUnsafe)/.test(content)) {
        offenders.push(path.relative(SERVER_SRC, file))
      }
    }
    expect(offenders).toEqual([])
  })
})

// --- SEC-04, BR-L3-12: CSP header present on API responses. ---
describe('Security headers (SEC-04, BR-L3-12)', () => {
  it('sends a Content-Security-Policy header', async () => {
    const request = (await import('supertest')).default
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers['content-security-policy']).toBeTruthy()
  })
})

// --- SEC-01, BR-L3-20: attachment path-containment regression. The
// mitigation itself (attachment-storage.ts) is unchanged since Lab 2 --
// this re-proves it works under the current session-based routes rather
// than re-implementing anything. Lab 2's own 19-test attachment suite
// (server/tests/lab-02/attachments.api.test.ts) already covers upload/
// download/removal in depth and still runs on every full suite; this adds
// the one angle that suite doesn't: an explicitly path-traversal-shaped
// filename. ---
describe('Attachment path-containment regression (SEC-01, BR-L3-20)', () => {
  it('a path-traversal-shaped filename never escapes the uploads root', async () => {
    const { agent } = await loginAsRequester()
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

    const ticket = await agent.post('/api/tickets').send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: 'MEDIUM',
      summary: 'Security audit path-traversal check',
      description: 'Verifies a malicious filename cannot escape the uploads root.',
    })

    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
    const uploaded = await agent
      .post(`/api/tickets/${ticket.body.id}/attachments`)
      .attach('file', validJpeg, { filename: '../../../../etc/passwd.jpg', contentType: 'image/jpeg' })

    expect(uploaded.status).toBe(201)

    const stored = await prisma.attachment.findUniqueOrThrow({ where: { id: uploaded.body.id } })
    // storedPath is always <ticketId>/<serverGeneratedUuid>.<ext> -- never
    // the attacker-supplied name, and never contains a traversal sequence.
    expect(stored.storedPath).not.toContain('..')
    expect(stored.storedPath.startsWith(`${ticket.body.id}${path.sep}`)).toBe(true)

    const download = await agent.get(`/api/attachments/${uploaded.body.id}/download`)
    expect(download.status).toBe(200)
  })
})

// --- SEC-03: consolidated IDOR sweep across every Lab 3 resource type in
// one file/pass. Each of these is already covered individually in its own
// issue's test file (Ticket/Attachment: Lab 2 + Issue 16; Comment: Issue
// 17; Note: Issue 19; User/Session: Issue 20) -- this re-probes all of
// them together so "is IDOR closed" has one place to check, rather than
// duplicating those suites' assertions here. ---
describe('Consolidated IDOR sweep (SEC-03)', () => {
  it('Requester cannot read a ticket, its comments, or its notes owned by another Requester', async () => {
    const { agent: ownerAgent } = await loginAsRequester(0)
    const { agent: otherAgent } = await loginAsRequester(1)
    const { agent: staffAgent } = await loginAsItStaff()
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

    const ticket = await ownerAgent.post('/api/tickets').send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: 'MEDIUM',
      summary: 'IDOR sweep target ticket',
      description: 'Used to verify cross-role/cross-owner access is closed everywhere.',
    })
    await staffAgent.post(`/api/tickets/${ticket.body.id}/notes`).send({ body: 'Internal note for the sweep.' })

    const ticketRead = await otherAgent.get(`/api/tickets/${ticket.body.id}`)
    expect(ticketRead.status).toBe(403)

    const commentsRead = await otherAgent.get(`/api/tickets/${ticket.body.id}/comments`)
    expect(commentsRead.status).toBe(403)

    // Even the ticket's *owner* cannot see Internal Notes -- role gate, not ownership.
    const notesReadByOwner = await ownerAgent.get(`/api/tickets/${ticket.body.id}/notes`)
    expect(notesReadByOwner.status).toBe(403)
    expect(JSON.stringify(notesReadByOwner.body)).not.toContain('sweep')
  })

  it('a non-Administrator cannot read the user list', async () => {
    const { agent: requesterAgent } = await loginAsRequester()
    const { agent: staffAgent } = await loginAsItStaff()

    expect((await requesterAgent.get('/api/users')).status).toBe(403)
    expect((await staffAgent.get('/api/users')).status).toBe(403)
  })

  it("a deactivated user's session is rejected on the very next request, not just at their next login", async () => {
    const { agent: adminAgent } = await loginAsAdministrator()
    const email = `idor-sweep-target-${Date.now()}@toktickit.test`
    const created = await adminAgent.post('/api/users').send({ name: 'Sweep Target', email, role: 'REQUESTER' })

    const request = (await import('supertest')).default
    const targetAgent = request.agent(app)
    await targetAgent
      .post('/api/auth/login')
      .set('Origin', process.env.APP_ORIGIN ?? 'http://localhost:5173')
      .send({ email, password: created.body.initialPassword })
    expect((await targetAgent.get('/api/auth/me')).status).toBe(200)

    await adminAgent.post(`/api/users/${created.body.id}/deactivate`)

    expect((await targetAgent.get('/api/auth/me')).status).toBe(401)
  })
})
