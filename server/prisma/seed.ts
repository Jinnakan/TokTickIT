import { PrismaClient } from '@prisma/client'
import { runSeed, SEED_PASSWORD } from './seed-data.js'

const prisma = new PrismaClient()

runSeed(prisma)
  .then((result) => {
    console.log(`Seeded ${result.categoryCount} IT request categories.`)
    console.log(`Seeded ${result.relatedSystemCount} related systems.`)
    console.log(`Seeded ${result.requesterCount} Requesters.`)
    console.log(`Seeded ${result.itStaffCount} IT Staff.`)
    console.log(`Seeded ${result.administratorCount} Administrator(s).`)
    console.log(`All seeded accounts share the password "${SEED_PASSWORD}" (dev/course use only).`)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
