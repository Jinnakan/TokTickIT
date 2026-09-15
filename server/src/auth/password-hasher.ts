import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * Singleton: one shared instance holds the hashing configuration
 * (salt rounds) so it can't silently drift between call sites -- every
 * hash/verify in the app goes through the same cost factor.
 */
export class PasswordHasher {
  private static instance: PasswordHasher | undefined

  private constructor(private readonly saltRounds: number) {}

  static getInstance(): PasswordHasher {
    if (!PasswordHasher.instance) {
      PasswordHasher.instance = new PasswordHasher(SALT_ROUNDS)
    }
    return PasswordHasher.instance
  }

  hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.saltRounds)
  }

  verify(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash)
  }
}
