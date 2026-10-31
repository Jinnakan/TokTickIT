import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionsTakenPanel } from '../../src/components/ActionsTakenPanel.js'
import { assignableUsers, makeAction, stubActionsApi } from './actions-test-helpers.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mount(options: Parameters<typeof stubActionsApi>[0] = {}, props: Partial<Parameters<typeof ActionsTakenPanel>[0]> = {}) {
  const api = stubActionsApi(options)
  vi.stubGlobal('fetch', api.fetchStub)
  render(<ActionsTakenPanel ticketId={42} ticketStatus="IN_PROGRESS" canEdit={true} currentUserId={9} {...props} />)
  return api
}

async function openAddForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Add action' }))
  return screen.findByRole('form', { name: 'Add action' })
}

describe('Actions list (UI4-08, FR-L4-01)', () => {
  it('shows a count in the heading and the cards in order', async () => {
    mount({
      initial: [
        makeAction({ id: 1, description: 'First thing', actionAt: '2026-10-30T07:00:00.000Z' }),
        makeAction({ id: 2, description: 'Second thing', status: 'COMPLETED', result: 'Done', actionAt: '2026-10-30T09:00:00.000Z' }),
      ],
    })

    expect(await screen.findByRole('heading', { name: 'Actions Taken (2)' })).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('First thing')).toBeInTheDocument()
    expect(within(items[1]).getByText('Second thing')).toBeInTheDocument()
    expect(within(items[1]).getByText('Completed')).toBeInTheDocument()
    expect(within(items[1]).getByText(/Performed by Alex Rivera/)).toBeInTheDocument()
  })

  it('shows the empty message and still offers Add action to staff', async () => {
    mount()
    expect(await screen.findByText('No actions recorded yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add action' })).toBeInTheDocument()
  })

  it('shows a safe failure with a working Retry', async () => {
    const api = stubActionsApi({ listOk: false })
    vi.stubGlobal('fetch', api.fetchStub)
    render(<ActionsTakenPanel ticketId={42} ticketStatus="OPEN" canEdit={true} currentUserId={9} />)
    expect(await screen.findByText('Unable to load the actions.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('Create form', () => {
  it('UI4-09 reveals the follow-up note and blocks a save without one', async () => {
    const api = mount()
    const form = await openAddForm()

    fireEvent.change(within(form).getByLabelText('Description *'), { target: { value: 'Replaced the dock.' } })
    expect(within(form).queryByLabelText('Follow-up note *')).not.toBeInTheDocument()
    fireEvent.click(within(form).getByLabelText('Follow-up required'))
    expect(within(form).getByLabelText('Follow-up note *')).toBeInTheDocument()

    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByText('Follow-up note is required when follow-up is needed.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Follow-up note *')).toHaveAttribute('aria-invalid', 'true')
    expect(api.requests).toHaveLength(0)
  })

  it('sends a trimmed body with a requestId and the current user as assignee, then lists the new card and announces it', async () => {
    const api = mount()
    const form = await openAddForm()

    fireEvent.change(within(form).getByLabelText('Description *'), { target: { value: '  Replaced the dock.  ' } })
    await waitFor(() => expect(within(form).getByLabelText('Assigned to')).toHaveValue('9'))
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.requests).toHaveLength(1))
    expect(api.requests[0].method).toBe('POST')
    expect(api.requests[0].body).toMatchObject({ description: 'Replaced the dock.', status: 'PLANNED', assigneeId: 9 })
    expect(String(api.requests[0].body?.requestId)).toMatch(/^act-/)

    expect(await screen.findByText('Replaced the dock.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Actions Taken (1)' })).toBeInTheDocument()
    expect(screen.getByText('Action saved')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Add action' })).not.toBeInTheDocument()
  })

  it('UI4-15 lists only the backend assignable users and defaults to the current user', async () => {
    mount()
    const form = await openAddForm()
    const select = within(form).getByLabelText('Assigned to')
    await waitFor(() => {
      expect(within(select).getAllByRole('option')).toHaveLength(assignableUsers.length)
    })
    expect(within(select).getByRole('option', { name: 'Morgan Kim (Administrator)' })).toBeInTheDocument()
    expect(select).toHaveValue('9')
  })

  it('UI4-10 keeps every entered value and shows the safe message when the save fails', async () => {
    const api = mount({ writeOverride: () => ({ status: 500, body: { error: 'INTERNAL_ERROR' } }) })
    const form = await openAddForm()

    fireEvent.change(within(form).getByLabelText('Description *'), { target: { value: 'Keep this text.' } })
    fireEvent.click(within(form).getByLabelText('Follow-up required'))
    fireEvent.change(within(form).getByLabelText('Follow-up note *'), { target: { value: 'Check Friday' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Unable to save the action. Your text is still here.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Description *')).toHaveValue('Keep this text.')
    expect(within(form).getByLabelText('Follow-up note *')).toHaveValue('Check Friday')
    expect(api.requests).toHaveLength(1)
  })

  it('UI4-11 sends one request for rapid repeated Save clicks', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const api = mount({})
    const original = api.fetchStub.getMockImplementation()!
    api.fetchStub.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') await gate
      return original(url, init)
    })

    const form = await openAddForm()
    fireEvent.change(within(form).getByLabelText('Description *'), { target: { value: 'Once only.' } })
    // Three submits inside one act(): React cannot re-render (and disable the
    // button) between them, so only the synchronous ref guard can stop the extras.
    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
      fireEvent.submit(form)
    })
    release()

    await screen.findByText('Once only.')
    expect(api.requests.filter((request) => request.method === 'POST')).toHaveLength(1)
  })
})

describe('Card buttons by status (UI4-16, FR-L4-04)', () => {
  it('offers Start, Complete, Edit and Cancel action on a Planned card, and Start sends the right PATCH', async () => {
    const api = mount({ initial: [makeAction({ id: 1, version: 4 })] })
    const card = (await screen.findAllByRole('listitem'))[0]

    expect(within(card).getByRole('button', { name: 'Complete' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Cancel action' })).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(api.requests).toHaveLength(1))
    expect(api.requests[0]).toMatchObject({ method: 'PATCH', url: '/api/tickets/42/actions/1', body: { version: 4, status: 'IN_PROGRESS' } })
    expect(await within(card).findByText('In Progress')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })

  it('asks before cancelling and sends CANCELLED only after confirmation', async () => {
    const api = mount({ initial: [makeAction({ id: 1, status: 'IN_PROGRESS' })] })
    const card = (await screen.findAllByRole('listitem'))[0]

    fireEvent.click(within(card).getByRole('button', { name: 'Cancel action' }))
    const dialog = within(card).getByRole('alertdialog')
    expect(api.requests).toHaveLength(0)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep action' }))
    expect(within(card).queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(api.requests).toHaveLength(0)

    fireEvent.click(within(card).getByRole('button', { name: 'Cancel action' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Confirm cancel' }))
    await waitFor(() => expect(api.requests).toHaveLength(1))
    expect(api.requests[0].body).toMatchObject({ status: 'CANCELLED' })
  })

  it('Complete opens the edit form with Completed preselected and Result focused', async () => {
    mount({ initial: [makeAction({ id: 1 })] })
    const card = (await screen.findAllByRole('listitem'))[0]
    fireEvent.click(within(card).getByRole('button', { name: 'Complete' }))

    const form = await screen.findByRole('form', { name: 'Edit action' })
    expect(within(form).getByLabelText('Status')).toHaveValue('COMPLETED')
    expect(within(form).getByLabelText('Result *')).toHaveFocus()
  })

  it('Mark follow-up done sends followUpDone true for an open follow-up', async () => {
    const api = mount({
      initial: [makeAction({ id: 1, status: 'COMPLETED', result: 'Fixed.', followUpRequired: true, followUpNote: 'Check Friday' })],
    })
    const card = (await screen.findAllByRole('listitem'))[0]
    expect(within(card).getByText('Open')).toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: 'Mark follow-up done' }))

    await waitFor(() => expect(api.requests).toHaveLength(1))
    expect(api.requests[0].body).toMatchObject({ followUpDone: true })
    expect(await within(card).findByText(/Done /)).toBeInTheDocument()
  })
})

describe('Locks (UI4-12, AC-L4-09)', () => {
  it('shows a Cancelled card with no Edit and no buttons', async () => {
    mount({ initial: [makeAction({ id: 1, status: 'CANCELLED' })] })
    const card = (await screen.findAllByRole('listitem'))[0]
    expect(within(card).getByText('Cancelled')).toBeInTheDocument()
    expect(within(card).queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens a Completed action with the locked fields read-only and follow-up still editable', async () => {
    const api = mount({ initial: [makeAction({ id: 1, status: 'COMPLETED', result: 'Fixed.' })] })
    const card = (await screen.findAllByRole('listitem'))[0]
    expect(within(card).queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }))

    const form = await screen.findByRole('form', { name: 'Edit action' })
    expect(within(form).getByLabelText('Description *')).toHaveAttribute('readonly')
    expect(within(form).getByLabelText('Result *')).toHaveAttribute('readonly')
    expect(within(form).getByLabelText('Status')).toBeDisabled()
    expect(within(form).getByLabelText('Follow-up required')).toBeEnabled()

    fireEvent.click(within(form).getByLabelText('Follow-up required'))
    fireEvent.change(within(form).getByLabelText('Follow-up note *'), { target: { value: 'Check Friday' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.requests).toHaveLength(1))
    expect(Object.keys(api.requests[0].body ?? {}).sort()).toEqual(['attachmentNotes', 'followUpNote', 'followUpRequired', 'version'])
  })

  it('replaces Add action with a sentence on a Closed ticket and shows no card buttons', async () => {
    mount({ initial: [makeAction({ id: 1 })] }, { ticketStatus: 'CLOSED' })
    expect(await screen.findByText('This ticket is closed, so actions can no longer be changed.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add action' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })
})

describe('Requester view (UI4-13, AC-L4-05)', () => {
  it('shows the cards with no Add, Edit, buttons, or assignee control, and never loads the staff list', async () => {
    const api = mount({ initial: [makeAction({ id: 1, followUpRequired: true, followUpNote: 'Check Friday' })] }, { canEdit: false })
    expect(await screen.findByText('Checked the docking station.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('This ticket is closed, so actions can no longer be changed.')).not.toBeInTheDocument()
    expect(api.fetchStub.mock.calls.some(([url]) => url === '/api/users/assignable')).toBe(false)
  })
})

describe('Forbidden write', () => {
  it('shows the specific message in the form when the server answers 403 FORBIDDEN', async () => {
    mount({ writeOverride: () => ({ status: 403, body: { error: 'FORBIDDEN' } }) })
    const form = await openAddForm()
    fireEvent.change(within(form).getByLabelText('Description *'), { target: { value: 'Try anyway.' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('You cannot change actions on this ticket.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Description *')).toHaveValue('Try anyway.')
  })
})

describe('Stale update (UI4-14, AC-L4-08)', () => {
  it('shows the conflict message with Reload, keeps the typed text, and re-saves against the fresh version', async () => {
    let calls = 0
    const api = mount({
      initial: [makeAction({ id: 1, version: 1 })],
      writeOverride: () => (++calls === 1 ? { status: 409, body: { error: 'STALE_UPDATE', currentVersion: 2 } } : undefined),
      bumpOnConflict: true,
    })
    const card = (await screen.findAllByRole('listitem'))[0]
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }))
    const form = await screen.findByRole('form', { name: 'Edit action' })
    fireEvent.change(within(form).getByLabelText('Description *'), { target: { value: 'My edit.' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('This action was changed by someone else. Reload to see the latest.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Description *')).toHaveValue('My edit.')

    fireEvent.click(within(form).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(api.fetchStub.mock.calls.filter(([url, init]) => url === '/api/tickets/42/actions' && !init?.method)).toHaveLength(2))
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.requests).toHaveLength(2))
    expect(api.requests[1].body).toMatchObject({ version: 2, description: 'My edit.' })
  })
})
