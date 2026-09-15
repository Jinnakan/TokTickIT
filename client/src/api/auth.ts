export type CurrentUser = {
  id: number
  email: string
  name: string
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  mustChangePassword: boolean
}

export class LoginError extends Error {
  constructor(
    public readonly kind: 'invalid-credentials' | 'too-many-attempts' | 'validation' | 'unknown',
    message: string,
  ) {
    super(message)
  }
}

export class ChangePasswordError extends Error {
  constructor(
    public readonly kind: 'invalid-current-password' | 'validation' | 'unknown',
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
  }
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  if (response.status === 429) {
    throw new LoginError('too-many-attempts', 'Too many failed attempts. Try again later.')
  }
  if (response.status === 401) {
    throw new LoginError('invalid-credentials', 'Invalid email or password.')
  }
  if (response.status === 400) {
    throw new LoginError('validation', 'Enter both an email and a password.')
  }
  if (!response.ok) {
    throw new LoginError('unknown', 'Unable to log in right now.')
  }

  return response.json() as Promise<CurrentUser>
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Unable to log out.')
  }
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<CurrentUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include', signal })

  if (response.status === 401) {
    return null
  }
  if (!response.ok) {
    throw new Error('Unable to load the current user.')
  }

  return response.json() as Promise<CurrentUser>
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  if (response.ok) return

  const body = (await response.json().catch(() => ({}))) as {
    error?: string
    fields?: Record<string, string>
  }

  if (body.error === 'CURRENT_PASSWORD_INVALID') {
    throw new ChangePasswordError('invalid-current-password', 'Current password is incorrect.')
  }
  if (body.error === 'VALIDATION_FAILED') {
    throw new ChangePasswordError('validation', 'New password does not meet the requirements.', body.fields ?? {})
  }
  throw new ChangePasswordError('unknown', 'Unable to change the password right now.')
}
