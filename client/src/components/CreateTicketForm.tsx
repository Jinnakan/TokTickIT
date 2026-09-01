import { useEffect, useState, type FormEvent } from 'react'
import { fetchActiveCategories, fetchActiveRelatedSystems, type ReferenceItem } from '../api/referenceData.js'
import { createTicket, TicketValidationError } from '../api/tickets.js'
import type { CreateTicketInput, FieldErrors, Priority, Ticket } from '../types/ticket.js'

const SUMMARY_MIN = 5
const SUMMARY_MAX = 150
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000

type ReferenceStatus = 'loading' | 'ready' | 'error'

function validate(input: {
  categoryId: string
  relatedSystemId: string
  requestedPriority: string
  summary: string
  description: string
}): FieldErrors {
  const fields: FieldErrors = {}
  const summary = input.summary.trim()
  const description = input.description.trim()

  if (input.categoryId === '') {
    fields.categoryId = 'Category is required.'
  }
  if (input.relatedSystemId === '') {
    fields.relatedSystemId = 'Related System is required.'
  }
  if (input.requestedPriority === '') {
    fields.requestedPriority = 'Requested Priority is required.'
  }
  if (summary.length < SUMMARY_MIN || summary.length > SUMMARY_MAX) {
    fields.summary = `Summary must be ${SUMMARY_MIN}-${SUMMARY_MAX} characters.`
  }
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    fields.description = `Description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters.`
  }

  return fields
}

export function CreateTicketForm({ requesterId }: { requesterId: number }) {
  const [categories, setCategories] = useState<ReferenceItem[]>([])
  const [relatedSystems, setRelatedSystems] = useState<ReferenceItem[]>([])
  const [referenceStatus, setReferenceStatus] = useState<ReferenceStatus>('loading')

  const [categoryId, setCategoryId] = useState('')
  const [relatedSystemId, setRelatedSystemId] = useState('')
  const [requestedPriority, setRequestedPriority] = useState<Priority | ''>('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let ignore = false
    setReferenceStatus('loading')

    Promise.all([
      fetchActiveCategories(controller.signal),
      fetchActiveRelatedSystems(controller.signal),
    ])
      .then(([loadedCategories, loadedRelatedSystems]) => {
        if (ignore) return
        setCategories(loadedCategories)
        setRelatedSystems(loadedRelatedSystems)
        setReferenceStatus('ready')
      })
      .catch(() => {
        if (ignore) return
        setReferenceStatus('error')
      })

    return () => {
      ignore = true
      controller.abort()
    }
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError('')

    const errors = validate({ categoryId, relatedSystemId, requestedPriority, summary, description })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    const input: CreateTicketInput = {
      categoryId: Number(categoryId),
      relatedSystemId: Number(relatedSystemId),
      requestedPriority: requestedPriority as Priority,
      summary: summary.trim(),
      description: description.trim(),
    }

    setIsSubmitting(true)
    try {
      const ticket = await createTicket(input, requesterId)
      setCreatedTicket(ticket)
    } catch (error) {
      if (error instanceof TicketValidationError) {
        setFieldErrors(error.fields)
      } else {
        setSubmitError('Unable to submit the ticket. Check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCreateAnother() {
    setCreatedTicket(null)
    setCategoryId('')
    setRelatedSystemId('')
    setRequestedPriority('')
    setSummary('')
    setDescription('')
    setFieldErrors({})
    setSubmitError('')
  }

  if (createdTicket) {
    return (
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="alert alert-success mb-4" role="status">
            <strong>Ticket created.</strong> Your official Ticket Number is{' '}
            <strong>{createdTicket.ticketNumber}</strong>.
          </div>
          <button type="button" className="btn btn-primary" onClick={handleCreateAnother}>
            Create Another Ticket
          </button>
        </div>
      </div>
    )
  }

  if (referenceStatus === 'loading') {
    return (
      <p className="status-message text-body-secondary" role="status">
        <span aria-hidden="true">⌛</span> Loading form data…
      </p>
    )
  }

  if (referenceStatus === 'error') {
    return (
      <div className="alert alert-danger" role="alert">
        <strong>Unable to load Categories or Related Systems.</strong>
        <br />
        Start the backend and check the database connection.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card shadow-sm">
      <div className="card-body">
        <h1 className="h4 fw-bold mb-4">Create Ticket</h1>

        {submitError && (
          <div className="alert alert-danger" role="alert">
            {submitError}
          </div>
        )}

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label htmlFor="ticket-category" className="form-label fw-semibold">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="ticket-category"
              className={`form-select${fieldErrors.categoryId ? ' is-invalid' : ''}`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && <div className="invalid-feedback d-block">{fieldErrors.categoryId}</div>}
          </div>

          <div className="col-md-6">
            <label htmlFor="ticket-related-system" className="form-label fw-semibold">
              Related System <span className="text-danger">*</span>
            </label>
            <select
              id="ticket-related-system"
              className={`form-select${fieldErrors.relatedSystemId ? ' is-invalid' : ''}`}
              value={relatedSystemId}
              onChange={(event) => setRelatedSystemId(event.target.value)}
            >
              <option value="">Select a related system…</option>
              {relatedSystems.map((relatedSystem) => (
                <option key={relatedSystem.id} value={relatedSystem.id}>
                  {relatedSystem.name}
                </option>
              ))}
            </select>
            {fieldErrors.relatedSystemId && (
              <div className="invalid-feedback d-block">{fieldErrors.relatedSystemId}</div>
            )}
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="ticket-priority" className="form-label fw-semibold">
            Requested Priority <span className="text-danger">*</span>
          </label>
          <select
            id="ticket-priority"
            className={`form-select${fieldErrors.requestedPriority ? ' is-invalid' : ''}`}
            value={requestedPriority}
            onChange={(event) => setRequestedPriority(event.target.value as Priority | '')}
          >
            <option value="">Select a priority…</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          {fieldErrors.requestedPriority && (
            <div className="invalid-feedback d-block">{fieldErrors.requestedPriority}</div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="ticket-summary" className="form-label fw-semibold">
            Ticket Summary <span className="text-danger">*</span>
          </label>
          <input
            id="ticket-summary"
            type="text"
            className={`form-control${fieldErrors.summary ? ' is-invalid' : ''}`}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={SUMMARY_MAX}
          />
          {fieldErrors.summary && <div className="invalid-feedback d-block">{fieldErrors.summary}</div>}
        </div>

        <div className="mb-4">
          <label htmlFor="ticket-description" className="form-label fw-semibold">
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="ticket-description"
            className={`form-control${fieldErrors.description ? ' is-invalid' : ''}`}
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {fieldErrors.description && <div className="invalid-feedback d-block">{fieldErrors.description}</div>}
        </div>

        <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  )
}
