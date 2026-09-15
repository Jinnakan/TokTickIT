export type Attachment = {
  id: number
  originalFilename: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  isRemoved: boolean
  removedAt: string | null
  removedReason: string | null
}
