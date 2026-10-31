import type { FieldErrors } from '@toktickit/shared'

/** What a service returns to its router: an HTTP status and a JSON body. */
export type ServiceResult = { httpStatus: number; body: unknown }

export const reply = (httpStatus: number, body: unknown): ServiceResult => ({ httpStatus, body })

export const validationFailed = (fields: FieldErrors): ServiceResult =>
  reply(400, { error: 'VALIDATION_FAILED', fields })
