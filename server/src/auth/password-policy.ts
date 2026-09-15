const MIN_LENGTH = 8
const MAX_LENGTH = 72 // bcrypt silently truncates beyond this

export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`
  }
  if (password.length > MAX_LENGTH) {
    return `Password must be at most ${MAX_LENGTH} characters.`
  }
  return null
}
