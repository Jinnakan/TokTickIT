import type { RoleValue } from '@toktickit/shared'

export type AdminUser = {
  id: number
  email: string
  name: string
  role: RoleValue
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

export type AdminUserListMeta = { page: number; pageSize: number; totalItems: number; totalPages: number }
export type AdminUserListResponse = { data: AdminUser[]; meta: AdminUserListMeta }

export class UserActionError extends Error {
  constructor(public readonly code: string, message: string, public readonly fields: Record<string, string> = {}) {
    super(message)
  }
}

async function readError(response: Response): Promise<UserActionError> {
  const body = (await response.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string>; message?: string }
  return new UserActionError(body.error ?? 'UNKNOWN_ERROR', body.message ?? 'Request failed.', body.fields ?? {})
}

export async function fetchUsers(
  query: { search?: string; role?: RoleValue | ''; isActive?: boolean | ''; page?: number },
  signal?: AbortSignal,
): Promise<AdminUserListResponse> {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.role) params.set('role', query.role)
  if (query.isActive !== '' && query.isActive !== undefined) params.set('isActive', String(query.isActive))
  if (query.page !== undefined) params.set('page', String(query.page))

  const response = await fetch(`/api/users?${params.toString()}`, { credentials: 'include', signal })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<AdminUserListResponse>
}

export async function createUser(input: { name: string; email: string; role: RoleValue }): Promise<AdminUser & { initialPassword: string }> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<AdminUser & { initialPassword: string }>
}

export async function updateUser(
  userId: number,
  input: Partial<{ name: string; role: RoleValue; isActive: boolean }>,
): Promise<AdminUser> {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<AdminUser>
}

export async function resetPassword(userId: number): Promise<{ id: number; initialPassword: string }> {
  const response = await fetch(`/api/users/${userId}/reset-password`, { method: 'POST', credentials: 'include' })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<{ id: number; initialPassword: string }>
}

export async function deactivateUser(userId: number): Promise<{ id: number; isActive: boolean }> {
  const response = await fetch(`/api/users/${userId}/deactivate`, { method: 'POST', credentials: 'include' })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<{ id: number; isActive: boolean }>
}

export async function activateUser(userId: number): Promise<{ id: number; isActive: boolean }> {
  const response = await fetch(`/api/users/${userId}/activate`, { method: 'POST', credentials: 'include' })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<{ id: number; isActive: boolean }>
}
