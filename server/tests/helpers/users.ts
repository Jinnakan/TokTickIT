import type { Role } from '@prisma/client'
import { prisma } from '../../src/prisma.js'
import { PasswordHasher } from '../../src/auth/password-hasher.js'
import { SEED_PASSWORD } from '../../prisma/seed-data.js'
import { loginAsEmail, type AuthenticatedAgent } from './session.js'

let counter = 0

/**
 * Creates a user that belongs to one test alone. Tests that need a Requester,
 * staff member, or Administrator to mutate (deactivate, edit, own a Ticket)
 * use this instead of picking a seeded account by its position in the id
 * order, so one test can never change what another test's "index 2" means.
 */
export async function createUser(input: { role: Role; isActive?: boolean; name?: string }): Promise<{ id: number; email: string; name: string }> {
  counter += 1
  const stamp = `${Date.now()}-${process.pid}-${counter}`
  const email = `test-${input.role.toLowerCase()}-${stamp}@toktickit.test`
  const name = input.name ?? `Test ${input.role} ${counter}`
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: input.role,
      isActive: input.isActive ?? true,
      mustChangePassword: false,
      passwordHash: await PasswordHasher.getInstance().hash(SEED_PASSWORD),
    },
  })
  return { id: user.id, email, name }
}

export async function loginAsNewUser(role: Role): Promise<{ agent: AuthenticatedAgent; userId: number; email: string }> {
  const user = await createUser({ role })
  const session = await loginAsEmail(user.email)
  return { ...session, email: user.email }
}
