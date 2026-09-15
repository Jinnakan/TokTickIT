import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangePassword } from '../../src/components/ChangePassword.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function fillForm(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: confirm } })
}

describe('ChangePassword', () => {
  it('blocks submission client-side when the new/confirm passwords mismatch', () => {
    vi.stubGlobal('fetch', vi.fn())

    render(<ChangePassword mandatory onChanged={vi.fn()} />)
    fillForm('OldPass123!', 'BrandNewPass1!', 'DoesNotMatch1!')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows a field-level error for a wrong current password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'CURRENT_PASSWORD_INVALID' }) }),
    )

    render(<ChangePassword mandatory onChanged={vi.fn()} />)
    fillForm('WrongCurrent1!', 'BrandNewPass1!', 'BrandNewPass1!')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Current password is incorrect.')).toBeInTheDocument()
    })
  })

  it('calls onChanged after a successful change', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))

    const onChanged = vi.fn()
    render(<ChangePassword mandatory onChanged={onChanged} />)
    fillForm('OldPass123!', 'BrandNewPass1!', 'BrandNewPass1!')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled()
    })
  })

  it('shows the mandatory explanation and hides Cancel when mandatory', () => {
    render(<ChangePassword mandatory onChanged={vi.fn()} />)

    expect(screen.getByText(/You must set a new password before continuing/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('shows Cancel and calls onCancel when not mandatory', () => {
    const onCancel = vi.fn()
    render(<ChangePassword mandatory={false} onChanged={vi.fn()} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
