import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

const activeDevRequesters = [
  { name: 'Jennifer Anderson', email: 'jennifer.anderson@toktickit.test' },
  { name: 'Sarah Johnson', email: 'sarah.johnson@toktickit.test' },
  { name: 'David Lee', email: 'david.lee@toktickit.test' },
  { name: 'Michael Brown', email: 'michael.brown@toktickit.test' },
]

const inactiveDevRequesters = [
  { name: 'Former Student', email: 'former.student@toktickit.test' },
]

async function main() {
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

  for (const requester of activeDevRequesters) {
    await prisma.devRequester.upsert({
      where: { email: requester.email },
      update: {},
      create: { ...requester, isActive: true },
    })
  }

  for (const requester of inactiveDevRequesters) {
    await prisma.devRequester.upsert({
      where: { email: requester.email },
      update: {},
      create: { ...requester, isActive: false },
    })
  }

  console.log(`Seeded ${categoryNames.length} IT request categories.`)
  console.log(`Seeded ${relatedSystemNames.length} related systems.`)
  console.log(`Seeded ${activeDevRequesters.length} active and ${inactiveDevRequesters.length} inactive development requesters.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
