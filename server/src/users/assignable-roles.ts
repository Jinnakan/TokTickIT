import type { Prisma, Role } from '@prisma/client'

/** Roles that may own a Ticket or be assigned an Action (BR-L4-03). */
export const ASSIGNABLE_ROLES: readonly Role[] = ['IT_STAFF', 'ADMINISTRATOR']

/** The user when they exist, are active, and hold an assignable role; otherwise null. */
export async function findAssignableUser(
  client: Pick<Prisma.TransactionClient, 'user'>,
  userId: number,
): Promise<{ id: number } | null> {
  const user = await client.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } })
  if (!user || !user.isActive || !ASSIGNABLE_ROLES.includes(user.role)) return null
  return { id: user.id }
}
