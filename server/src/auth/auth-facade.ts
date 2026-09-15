import type { PrismaClient, Session, User } from '@prisma/client'
import { PasswordHasher } from './password-hasher.js'
import { SessionTokenService } from './session-token-service.js'
import { validateNewPassword } from './password-policy.js'

export type LoginResult =
  | { status: 'ok'; user: User; session: Session }
  | { status: 'invalid' }

export type ChangePasswordResult =
  | { status: 'ok' }
  | { status: 'invalid-current-password' }
  | { status: 'validation-failed'; message: string }

export interface AuthenticatedContext {
  user: User
  sessionId: string
}

/**
 * Facade: hides the coordination between PasswordHasher, SessionTokenService,
 * and the User/Session tables behind four operations a route handler can
 * call without knowing any of that plumbing.
 */
export class AuthFacade {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hasher: PasswordHasher = PasswordHasher.getInstance(),
    private readonly sessionTokens: SessionTokenService = SessionTokenService.getInstance(),
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } })

    if (!user || !user.isActive) {
      return { status: 'invalid' }
    }

    const passwordMatches = await this.hasher.verify(password, user.passwordHash)
    if (!passwordMatches) {
      return { status: 'invalid' }
    }

    // A brand new session row is created on every successful login (never
    // reused), which is what satisfies BR-L3-06's regeneration requirement.
    const session = await this.prisma.session.create({
      data: {
        id: this.sessionTokens.generateToken(),
        userId: user.id,
        expiresAt: this.sessionTokens.computeExpiresAt(),
      },
    })

    return { status: 'ok', user, session }
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } })
  }

  async getCurrentUser(sessionId: string): Promise<AuthenticatedContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    })

    if (!session) return null

    if (this.sessionTokens.isExpired(session.expiresAt)) {
      await this.prisma.session.delete({ where: { id: session.id } })
      return null
    }

    if (!session.user.isActive) {
      // Deactivation should already have deleted this session (BR-L3-18);
      // this is a defensive second check, not the primary enforcement path.
      await this.prisma.session.deleteMany({ where: { userId: session.user.id } })
      return null
    }

    return { user: session.user, sessionId: session.id }
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })

    const currentMatches = await this.hasher.verify(currentPassword, user.passwordHash)
    if (!currentMatches) {
      return { status: 'invalid-current-password' }
    }

    const validationError = validateNewPassword(newPassword)
    if (validationError) {
      return { status: 'validation-failed', message: validationError }
    }

    const passwordHash = await this.hasher.hash(newPassword)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    })

    return { status: 'ok' }
  }
}
