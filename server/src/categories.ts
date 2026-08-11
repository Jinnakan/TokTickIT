export type Category = {
  id: number
  name: string
}

// Starter categories keep the Lab 01 endpoint usable without requiring a
// database connection. Move these records to Prisma when category management
// is added in a later lab.
export const categories: Category[] = [
  { id: 1, name: 'Account and Access' },
  { id: 2, name: 'Hardware' },
  { id: 3, name: 'Software' },
  { id: 4, name: 'Network' },
]
