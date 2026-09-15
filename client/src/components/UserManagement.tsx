import { useEffect, useState, type FormEvent } from 'react'
import { ROLES, ROLE_LABELS, type RoleValue } from '@toktickit/shared'
import {
  activateUser,
  createUser,
  deactivateUser,
  fetchUsers,
  resetPassword,
  updateUser,
  UserActionError,
  type AdminUser,
} from '../api/users.js'

type Status = 'loading' | 'ready' | 'error'

export function UserManagement() {
  const [status, setStatus] = useState<Status>('loading')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleValue | ''>('')
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('')
  const [reloadToken, setReloadToken] = useState(0)

  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleValue>('REQUESTER')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [shownPassword, setShownPassword] = useState<{ email: string; password: string } | null>(null)
  const [pendingDeactivate, setPendingDeactivate] = useState<AdminUser | null>(null)

  useEffect(() => {
    let ignore = false
    setStatus('loading')

    fetchUsers({ search: search || undefined, role: roleFilter, isActive: activeFilter === '' ? '' : activeFilter === 'true' })
      .then((result) => {
        if (ignore) return
        setUsers(result.data)
        setStatus('ready')
      })
      .catch(() => {
        if (ignore) return
        setStatus('error')
      })

    return () => {
      ignore = true
    }
  }, [search, roleFilter, activeFilter, reloadToken])

  function reload() {
    setReloadToken((token) => token + 1)
  }

  function beginCreate() {
    setEditing(null)
    setName('')
    setEmail('')
    setRole('REQUESTER')
    setFormError('')
  }

  function beginEdit(user: AdminUser) {
    setEditing(user)
    setName(user.name)
    setEmail(user.email)
    setRole(user.role)
    setFormError('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    setIsSaving(true)
    try {
      if (editing) {
        await updateUser(editing.id, { name, role })
      } else {
        const created = await createUser({ name, email, role })
        setShownPassword({ email: created.email, password: created.initialPassword })
      }
      beginCreate()
      reload()
    } catch (error) {
      setFormError(error instanceof UserActionError ? error.message : 'Unable to save this user.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResetPassword(user: AdminUser) {
    try {
      const result = await resetPassword(user.id)
      setShownPassword({ email: user.email, password: result.initialPassword })
    } catch {
      setFormError('Unable to reset the password.')
    }
  }

  async function confirmDeactivate() {
    if (!pendingDeactivate) return
    try {
      await deactivateUser(pendingDeactivate.id)
      setPendingDeactivate(null)
      reload()
    } catch {
      setFormError('Unable to deactivate this user.')
      setPendingDeactivate(null)
    }
  }

  async function handleActivate(user: AdminUser) {
    try {
      await activateUser(user.id)
      reload()
    } catch {
      setFormError('Unable to activate this user.')
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h1 className="h4 fw-bold mb-1">Users</h1>
          <p className="text-body-secondary mb-0">Manage TokTickIT user accounts.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={beginCreate}>
          Create User
        </button>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input
            type="search"
            className="form-control"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search users"
          />
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleValue | '')}
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>{ROLE_LABELS[value]}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as '' | 'true' | 'false')}
            aria-label="Filter by active status"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {shownPassword && (
        <div className="alert alert-success" role="status">
          <strong>Initial password for {shownPassword.email}:</strong>{' '}
          <code>{shownPassword.password}</code>
          <br />
          This will not be shown again.
          <div className="mt-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShownPassword(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {formError && (
        <div className="alert alert-danger" role="alert">
          {formError}
        </div>
      )}

      {pendingDeactivate && (
        <div className="alert alert-warning" role="alertdialog" aria-label="Confirm deactivation">
          Deactivating <strong>{pendingDeactivate.name}</strong> will immediately end all of their active sessions.
          Continue?
          <div className="mt-2 d-flex gap-2">
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void confirmDeactivate()}>
              Deactivate
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPendingDeactivate(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-8">
          {status === 'loading' && (
            <p className="status-message text-body-secondary" role="status">
              <span aria-hidden="true">⌛</span> Loading users…
            </p>
          )}
          {status === 'error' && (
            <div className="alert alert-danger" role="alert">Unable to load users.</div>
          )}
          {status === 'ready' && users.length === 0 && (
            <div className="alert alert-secondary" role="status">No users match your filters.</div>
          )}
          {status === 'ready' && users.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{ROLE_LABELS[user.role]}</td>
                      <td>
                        <span className={`badge rounded-pill ${user.isActive ? 'bg-success-subtle text-success-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="d-flex gap-2 flex-wrap">
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => beginEdit(user)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void handleResetPassword(user)}>
                          Reset Password
                        </button>
                        {user.isActive ? (
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setPendingDeactivate(user)}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void handleActivate(user)}>
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h2 className="h5 fw-bold mb-3">{editing ? `Edit ${editing.name}` : 'Create User'}</h2>
              <form onSubmit={handleSubmit}>
                <fieldset disabled={isSaving} className="border-0 p-0 m-0">
                  <label htmlFor="user-name" className="form-label fw-semibold">Name</label>
                  <input
                    id="user-name"
                    className="form-control mb-3"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />

                  <label htmlFor="user-email" className="form-label fw-semibold">Email</label>
                  <input
                    id="user-email"
                    type="email"
                    className="form-control mb-3"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={!!editing}
                    required
                  />

                  <label htmlFor="user-role" className="form-label fw-semibold">Role</label>
                  <select
                    id="user-role"
                    className="form-select mb-3"
                    value={role}
                    onChange={(event) => setRole(event.target.value as RoleValue)}
                  >
                    {ROLES.map((value) => (
                      <option key={value} value={value}>{ROLE_LABELS[value]}</option>
                    ))}
                  </select>

                  <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" disabled={isSaving}>
                    {isSaving ? 'Saving…' : editing ? 'Save User' : 'Create User'}
                  </button>
                  {editing && (
                    <button type="button" className="btn btn-outline-secondary ms-2" onClick={beginCreate}>
                      Cancel
                    </button>
                  )}
                </fieldset>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
