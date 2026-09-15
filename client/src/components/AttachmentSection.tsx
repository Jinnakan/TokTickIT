import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  ALLOWED_EXTENSIONS,
  isAllowedExtensionMimePair,
  isFileSizeAllowed,
  isRemovalReasonValid,
  MAX_ACTIVE_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
} from '@toktickit/shared'
import { downloadAttachment, fetchAttachments, removeAttachment, uploadAttachment } from '../api/attachments.js'
import type { Attachment } from '../types/attachment.js'

type Status = 'loading' | 'ready' | 'error'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AttachmentSection({ ticketId, requesterId }: { ticketId: number; requesterId: number }) {
  const [status, setStatus] = useState<Status>('loading')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadError, setUploadError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [pendingRemovalId, setPendingRemovalId] = useState<number | null>(null)
  const [removalReason, setRemovalReason] = useState('')
  const [removalError, setRemovalError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeCount = attachments.filter((attachment) => !attachment.isRemoved).length

  async function reload() {
    setStatus('loading')
    try {
      const loaded = await fetchAttachments(ticketId, requesterId)
      setAttachments(loaded)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    let ignore = false
    setStatus('loading')

    fetchAttachments(ticketId, requesterId)
      .then((loaded) => {
        if (ignore) return
        setAttachments(loaded)
        setStatus('ready')
      })
      .catch(() => {
        if (ignore) return
        setStatus('error')
      })

    return () => {
      ignore = true
    }
  }, [ticketId, requesterId])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setUploadError('')

    if (!isAllowedExtensionMimePair(file.name, file.type)) {
      setUploadError(`Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}.`)
      return
    }
    if (!isFileSizeAllowed(file.size)) {
      setUploadError(`Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`)
      return
    }

    setIsUploading(true)
    try {
      await uploadAttachment(ticketId, file, requesterId)
      await reload()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to upload the file.')
    } finally {
      setIsUploading(false)
    }
  }

  function startRemoval(attachmentId: number) {
    setPendingRemovalId(attachmentId)
    setRemovalReason('')
    setRemovalError('')
  }

  function cancelRemoval() {
    setPendingRemovalId(null)
    setRemovalReason('')
    setRemovalError('')
  }

  async function confirmRemoval() {
    if (pendingRemovalId === null) return
    if (!isRemovalReasonValid(removalReason)) {
      setRemovalError('Provide a reason (3-200 characters).')
      return
    }

    try {
      await removeAttachment(pendingRemovalId, removalReason.trim(), requesterId)
      setPendingRemovalId(null)
      setRemovalReason('')
      await reload()
    } catch (error) {
      setRemovalError(error instanceof Error ? error.message : 'Unable to remove the attachment.')
    }
  }

  async function handleDownload(attachment: Attachment) {
    try {
      await downloadAttachment(attachment.id, attachment.originalFilename, requesterId)
    } catch {
      setUploadError('Unable to download this attachment.')
    }
  }

  return (
    <div className="card shadow-sm mt-4">
      <div className="card-body">
        <h2 className="h5 fw-bold mb-3">Attachments</h2>

        {status === 'loading' && (
          <p className="status-message text-body-secondary" role="status">
            <span aria-hidden="true">⌛</span> Loading attachments…
          </p>
        )}

        {status === 'error' && (
          <div className="alert alert-danger" role="alert">
            Unable to load attachments.
          </div>
        )}

        {status === 'ready' && (
          <>
            <ul className="list-group mb-3">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className={`list-group-item d-flex justify-content-between align-items-center${attachment.isRemoved ? ' text-body-secondary' : ''}`}
                >
                  <div>
                    <div className={attachment.isRemoved ? 'text-decoration-line-through' : ''}>
                      {attachment.originalFilename}
                    </div>
                    <small>
                      {formatSize(attachment.sizeBytes)} · uploaded {formatDate(attachment.uploadedAt)}
                      {attachment.isRemoved && attachment.removedAt && (
                        <> · removed {formatDate(attachment.removedAt)}: {attachment.removedReason}</>
                      )}
                    </small>
                  </div>

                  {!attachment.isRemoved && (
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleDownload(attachment)}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => startRemoval(attachment.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {attachment.isRemoved && (
                    <span className="badge text-bg-secondary" title="Removed attachments cannot be downloaded">
                      Removed
                    </span>
                  )}
                </li>
              ))}
              {attachments.length === 0 && (
                <li className="list-group-item text-body-secondary">No attachments yet.</li>
              )}
            </ul>

            {pendingRemovalId !== null && (
              <div className="alert alert-warning mb-3">
                <label htmlFor="removal-reason" className="form-label fw-semibold">
                  Reason for removal <span className="text-danger">*</span>
                </label>
                <input
                  id="removal-reason"
                  type="text"
                  className={`form-control mb-2${removalError ? ' is-invalid' : ''}`}
                  value={removalReason}
                  onChange={(event) => setRemovalReason(event.target.value)}
                  maxLength={200}
                />
                {removalError && <div className="invalid-feedback d-block mb-2">{removalError}</div>}
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-danger btn-sm" onClick={confirmRemoval}>
                    Confirm Removal
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelRemoval}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="alert alert-danger" role="alert">
                {uploadError}
              </div>
            )}

            {activeCount >= MAX_ACTIVE_ATTACHMENTS ? (
              <p className="text-body-secondary small mb-0">
                Maximum of {MAX_ACTIVE_ATTACHMENTS} active attachments reached. Remove one to add another.
              </p>
            ) : (
              <>
                <label htmlFor="attachment-file-input" className="form-label fw-semibold">
                  Add attachment
                </label>
                <input
                  id="attachment-file-input"
                  ref={fileInputRef}
                  type="file"
                  className="form-control"
                  accept={ALLOWED_EXTENSIONS.join(',')}
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <p className="form-text">
                  Allowed types: JPG, PNG, WEBP, PDF. Maximum {MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB, up to{' '}
                  {MAX_ACTIVE_ATTACHMENTS} active attachments.
                </p>
                {isUploading && (
                  <p className="status-message text-body-secondary" role="status">
                    <span aria-hidden="true">⌛</span> Uploading…
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
