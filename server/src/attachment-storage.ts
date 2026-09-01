import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Never inside a directory Express serves statically — the only way to read
// a file back is through the ownership-checked download route.
export const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads', 'lab-02')

/**
 * Magic-byte signatures for the four allowed types. A client can set any
 * `Content-Type` header it wants, so the declared MIME type alone is not
 * trustworthy — this checks the actual leading bytes of the uploaded content.
 * (WEBP needs two checks: RIFF container at offset 0, "WEBP" tag at offset 8.)
 */
function matchesKnownSignature(buffer: Buffer): boolean {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  const isPdf = buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF'

  return isJpeg || isPng || isWebp || isPdf
}

export function isFileContentValid(buffer: Buffer): boolean {
  return matchesKnownSignature(buffer)
}

function extensionOf(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase()
  // Reject anything with no extension or an unexpected shape rather than
  // blindly embedding attacker-controlled text into a filesystem path.
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ''
}

/**
 * Builds a storage path from a fully server-generated filename (random UUID
 * + a validated extension) — the caller's `originalFilename` never touches
 * the filesystem path, so there is no path-traversal surface from it. The
 * resolved path is verified to stay inside UPLOADS_ROOT as a second,
 * independent check (defense in depth, not the only thing preventing escape).
 */
export function buildStoragePath(ticketId: number, originalFilename: string): { relativePath: string; absolutePath: string } {
  const extension = extensionOf(originalFilename)
  const storedFilename = `${randomUUID()}${extension}`
  const relativePath = path.join(String(ticketId), storedFilename)
  const absolutePath = path.resolve(UPLOADS_ROOT, relativePath)

  if (!absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error('Resolved attachment path escaped the uploads root.')
  }

  return { relativePath, absolutePath }
}

export async function saveAttachmentFile(absolutePath: string, buffer: Buffer): Promise<void> {
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, buffer)
}

export async function readAttachmentFile(relativePath: string): Promise<Buffer> {
  const absolutePath = path.resolve(UPLOADS_ROOT, relativePath)
  if (!absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error('Resolved attachment path escaped the uploads root.')
  }
  return readFile(absolutePath)
}

/** Strips path separators and control characters for a safe Content-Disposition filename. */
export function sanitizeDownloadFilename(originalFilename: string): string {
  const withoutPathParts = originalFilename.replace(/[/\\]/g, '_')
  // eslint-disable-next-line no-control-regex
  const withoutControlChars = withoutPathParts.replace(/[\x00-\x1f"]/g, '_')
  return withoutControlChars || 'attachment'
}
