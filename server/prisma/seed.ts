import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categoryNames = [
  'Account and Access',
  'Hardware',
  'Software',
  'Network',
]

async function main() {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log(`Seeded ${categoryNames.length} IT request categories.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
