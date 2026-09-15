export const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const
export type RoleValue = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleValue, string> = {
  REQUESTER: 'Requester',
  IT_STAFF: 'IT Staff',
  ADMINISTRATOR: 'Administrator',
}
