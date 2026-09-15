import type { PrismaClient } from '@prisma/client'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const BCRYPT_SALT_ROUNDS = 10

// Known, documented password for every seeded account (dev/course use only
// -- never used for an Administrator-created production account, which
// always gets a random generated password per BR-L3-19). Lets graders and
// E2E specs log in as any seeded user without hunting for credentials.
export const SEED_PASSWORD = 'DevPass123!'

const categoryNames = [
  'Account and Access',
  'Hardware',
  'Software',
  'Network',
]

const relatedSystemNames = [
  'Email',
  'Campus Wi-Fi',
  'VPN',
  'LEB2 App',
  'Grade Submission App',
  'Printer',
  'Corporate Laptop',
]

export const activeRequesters = [
  { name: 'Jennifer Anderson', email: 'jennifer.anderson@toktickit.test' },
  { name: 'Sarah Johnson', email: 'sarah.johnson@toktickit.test' },
  { name: 'David Lee', email: 'david.lee@toktickit.test' },
  { name: 'Michael Brown', email: 'michael.brown@toktickit.test' },
]

export const inactiveRequesters = [
  { name: 'Former Student', email: 'former.student@toktickit.test' },
]

export const activeItStaff = [
  { name: 'Alex Rivera', email: 'alex.rivera@toktickit.test' },
  { name: 'Priya Nair', email: 'priya.nair@toktickit.test' },
  { name: 'Tom Walker', email: 'tom.walker@toktickit.test' },
]

export const inactiveItStaff = [
  { name: 'Former IT Staff', email: 'former.itstaff@toktickit.test' },
]

export const activeAdministrators = [
  { name: 'Morgan Kim', email: 'morgan.kim@toktickit.test' },
]

// Dedicated account for exercising the mandatory first-login password
// change (AC-L3-03) in e2e/lab-03/authentication.spec.ts and manual
// verification -- always re-seeded with mustChangePassword: true, unlike
// every other seeded account above.
export const pendingPasswordChangeUser = { name: 'New Hire', email: 'new.hire@toktickit.test' }

async function seedUser(
  prisma: PrismaClient,
  user: { name: string; email: string },
  role: Role,
  isActive: boolean,
  passwordHash: string,
) {
  await prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.name, role, isActive, passwordHash, mustChangePassword: false },
    create: { ...user, role, isActive, passwordHash, mustChangePassword: false },
  })
}

export async function runSeed(prisma: PrismaClient) {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_SALT_ROUNDS)

  for (const requester of activeRequesters) {
    await seedUser(prisma, requester, Role.REQUESTER, true, passwordHash)
  }
  for (const requester of inactiveRequesters) {
    await seedUser(prisma, requester, Role.REQUESTER, false, passwordHash)
  }
  for (const staff of activeItStaff) {
    await seedUser(prisma, staff, Role.IT_STAFF, true, passwordHash)
  }
  for (const staff of inactiveItStaff) {
    await seedUser(prisma, staff, Role.IT_STAFF, false, passwordHash)
  }
  for (const admin of activeAdministrators) {
    await seedUser(prisma, admin, Role.ADMINISTRATOR, true, passwordHash)
  }

  await prisma.user.upsert({
    where: { email: pendingPasswordChangeUser.email },
    update: { name: pendingPasswordChangeUser.name, role: Role.REQUESTER, isActive: true, passwordHash, mustChangePassword: true },
    create: { ...pendingPasswordChangeUser, role: Role.REQUESTER, isActive: true, passwordHash, mustChangePassword: true },
  })

  return {
    categoryCount: categoryNames.length,
    relatedSystemCount: relatedSystemNames.length,
    requesterCount: activeRequesters.length + inactiveRequesters.length,
    itStaffCount: activeItStaff.length + inactiveItStaff.length,
    administratorCount: activeAdministrators.length,
  }
}
