import { useState, type FormEvent } from 'react'
import { changePassword, ChangePasswordError } from '../api/auth.js'

export function ChangePassword({
  mandatory,
  onChanged,
  onCancel,
}: {
  mandatory: boolean
  onChanged: () => void
  onCancel?: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function runClientValidation(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.'
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }
    return errors
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const clientErrors = runClientValidation()
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setIsSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      onChanged()
    } catch (error) {
      if (error instanceof ChangePasswordError && error.kind === 'invalid-current-password') {
        setFieldErrors({ currentPassword: error.message })
      } else if (error instanceof ChangePasswordError && error.kind === 'validation') {
        setFieldErrors(error.fieldErrors)
      } else {
        setFieldErrors({ form: 'Unable to change the password right now.' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell d-flex align-items-center py-5">
      <section className="container" aria-labelledby="change-password-title">
        <div className="service-card mx-auto shadow-sm">
          <div className="service-card__header">
            <span className="brand-mark" aria-hidden="true">T</span>
            <div>
              <h1 id="change-password-title" className="h2 mb-1 fw-bold">Change Password</h1>
            </div>
          </div>

          <hr className="my-4" />

          {mandatory && (
            <p className="mb-4 text-body-secondary">
              You must set a new password before continuing.
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <fieldset disabled={isSubmitting} className="border-0 p-0 m-0">
              <label htmlFor="current-password" className="form-label fw-semibold">
                Current Password <span className="text-danger">*</span>
              </label>
              <input
                id="current-password"
                type="password"
                className={`form-control mb-3${fieldErrors.currentPassword ? ' is-invalid' : ''}`}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              {fieldErrors.currentPassword && (
                <div className="invalid-feedback d-block">{fieldErrors.currentPassword}</div>
              )}

              <label htmlFor="new-password" className="form-label fw-semibold">
                New Password <span className="text-danger">*</span>
              </label>
              <input
                id="new-password"
                type="password"
                className={`form-control mb-3${fieldErrors.newPassword ? ' is-invalid' : ''}`}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              {fieldErrors.newPassword && <div className="invalid-feedback d-block">{fieldErrors.newPassword}</div>}

              <label htmlFor="confirm-new-password" className="form-label fw-semibold">
                Confirm New Password <span className="text-danger">*</span>
              </label>
              <input
                id="confirm-new-password"
                type="password"
                className={`form-control mb-3${fieldErrors.confirmPassword ? ' is-invalid' : ''}`}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              {fieldErrors.confirmPassword && (
                <div className="invalid-feedback d-block">{fieldErrors.confirmPassword}</div>
              )}

              {fieldErrors.form && (
                <div className="alert alert-danger" role="alert">
                  {fieldErrors.form}
                </div>
              )}

              <div className="d-flex gap-2">
                {!mandatory && onCancel && (
                  <button type="button" className="btn btn-outline-primary px-4 py-2 fw-semibold" onClick={onCancel}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </section>
    </main>
  )
}
