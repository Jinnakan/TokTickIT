import type { PrismaClient, Role, User } from '@prisma/client'
import { PasswordHasher } from '../auth/password-hasher.js'
import { generateInitialPassword } from './initial-password.js'
import { emitUserDeactivated } from './user-events.js'

export type CreateUserResult = { user: User; initialPassword: string }

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hasher: PasswordHasher = PasswordHasher.getInstance(),
  ) {}

  async createUser(input: { name: string; email: string; role: Role }): Promise<CreateUserResult> {
    const initialPassword = generateInitialPassword()
    const passwordHash = await this.hasher.hash(initialPassword)

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash,
        isActive: true,
        mustChangePassword: true,
      },
    })

    return { user, initialPassword }
  }

  async resetPassword(userId: number): Promise<{ userId: number; initialPassword: string }> {
    const initialPassword = generateInitialPassword()
    const passwordHash = await this.hasher.hash(initialPassword)

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    })

    return { userId, initialPassword }
  }

  /**
   * Sets isActive false and, via the Observer (userEvents), invalidates
   * every session for this user before returning -- BR-L3-18 requires
   * this to have already happened by the time the caller's HTTP response
   * goes out, not merely be scheduled.
   */
  async deactivateUser(userId: number): Promise<User> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } })
    await emitUserDeactivated(userId)
    return user
  }

  async activateUser(userId: number): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { isActive: true } })
  }
}
