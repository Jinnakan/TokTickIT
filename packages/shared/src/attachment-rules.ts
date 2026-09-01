export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_ACTIVE_ATTACHMENTS = 5
export const REMOVAL_REASON_MIN_LENGTH = 3
export const REMOVAL_REASON_MAX_LENGTH = 200

export type AllowedAttachmentType = {
  extensions: string[]
  mimeTypes: string[]
}

/**
 * The single allowlist for attachment types. Extension and MIME are checked
 * together on the server (plus a magic-byte sniff there, which needs the
 * actual file bytes and so can't live in this pure, environment-agnostic
 * module). The client uses this same list for fast client-side rejection
 * before ever starting an upload.
 */
export const ALLOWED_ATTACHMENT_TYPES: AllowedAttachmentType[] = [
  { extensions: ['.jpg', '.jpeg'], mimeTypes: ['image/jpeg'] },
  { extensions: ['.png'], mimeTypes: ['image/png'] },
  { extensions: ['.webp'], mimeTypes: ['image/webp'] },
  { extensions: ['.pdf'], mimeTypes: ['application/pdf'] },
]

export const ALLOWED_EXTENSIONS = ALLOWED_ATTACHMENT_TYPES.flatMap((type) => type.extensions)
export const ALLOWED_MIME_TYPES = ALLOWED_ATTACHMENT_TYPES.flatMap((type) => type.mimeTypes)

/** Extension/MIME pairing check only — the server additionally sniffs file bytes. */
export function isAllowedExtensionMimePair(filename: string, mimeType: string): boolean {
  const lower = filename.toLowerCase()
  return ALLOWED_ATTACHMENT_TYPES.some(
    (type) => type.extensions.some((extension) => lower.endsWith(extension)) && type.mimeTypes.includes(mimeType),
  )
}

export function isFileSizeAllowed(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE_BYTES
}

export function isRemovalReasonValid(reason: string): boolean {
  const trimmed = reason.trim()
  return trimmed.length >= REMOVAL_REASON_MIN_LENGTH && trimmed.length <= REMOVAL_REASON_MAX_LENGTH
}
