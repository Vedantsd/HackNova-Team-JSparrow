import { useState, useEffect } from 'react'
import { 
  Users, 
  Search, 
  Filter, 
  Shield, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  AlertTriangle
} from 'lucide-react'
import { api } from '../../services/api.js'
import Modal from '../../components/Modal.jsx'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(null) // { type: 'status'|'role', user, targetVal }
  const [actionLoading, setActionLoading] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getAdminUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined
      })
      setUsers(res.users || [])
    } catch (err) {
      setError(err.message || 'Failed to load user accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [roleFilter, statusFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadUsers()
  }

  const handleExecuteAction = async () => {
    if (!confirmModal) return
    setActionLoading(true)
    setError('')
    setSuccessMsg('')

    try {
      if (confirmModal.type === 'status') {
        await api.updateUserStatus(confirmModal.user.id, confirmModal.targetVal)
        setSuccessMsg(`User status updated to '${confirmModal.targetVal}' successfully.`)
      } else if (confirmModal.type === 'role') {
        await api.updateUserRole(confirmModal.user.id, confirmModal.targetVal)
        setSuccessMsg(`User role changed to '${confirmModal.targetVal}' successfully.`)
      }
      setConfirmModal(null)
      loadUsers()
    } catch (err) {
      setError(err.message || 'Operation failed.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Title & Stats */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            User Management & RBAC
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Inspect registered accounts, toggle activation, and manage administrative privileges.
          </p>
        </div>
        <button className="btn" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          color: '#4ade80',
          borderRadius: '10px',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={17} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 0, color: 'inherit', padding: 4 }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#ef4444',
          borderRadius: '10px',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 0, color: 'inherit', padding: 4 }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px', maxWidth: '420px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '0 12px',
            height: '38px',
            flex: 1
          }}>
            <Search size={15} className="muted" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 0, background: 'none', outline: 0, flex: 1, fontSize: '13px', color: 'var(--color-text)' }}
            />
          </div>
          <button type="submit" className="btn" style={{ height: '38px', fontSize: '13px' }}>
            Search
          </button>
        </form>

        {/* Dropdown Filters */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-muted)' }}>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-soft)',
                color: 'var(--color-text)',
                padding: '0 10px',
                fontSize: '13px'
              }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-muted)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-soft)',
                color: 'var(--color-text)',
                padding: '0 10px',
                fontSize: '13px'
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{
                background: 'var(--color-soft)',
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <th style={{ padding: '12px 18px' }}>User</th>
                <th style={{ padding: '12px 16px' }}>Role</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Meetings</th>
                <th style={{ padding: '12px 16px' }}>Registered</th>
                <th style={{ padding: '12px 16px' }}>Last Login</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--color-muted)' }}>
                    {loading ? 'Loading users...' : 'No matching users found.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isAdmin = u.role === 'admin'
                  const isActive = u.status === 'active'

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 150ms ease'
                      }}
                    >
                      {/* Name & Email */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: isAdmin ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--color-soft)',
                            color: isAdmin ? '#fff' : 'var(--color-primary)',
                            border: '1px solid var(--color-border)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                            flexShrink: 0
                          }}>
                            {u.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{u.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isAdmin ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-soft)',
                          color: isAdmin ? 'var(--color-primary)' : 'var(--color-muted)',
                          border: `1px solid ${isAdmin ? 'rgba(99, 102, 241, 0.35)' : 'var(--color-border)'}`
                        }}>
                          {isAdmin ? <ShieldCheck size={13} /> : <Shield size={13} />}
                          <span>{isAdmin ? 'Admin' : 'User'}</span>
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isActive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: isActive ? '#4ade80' : '#ef4444',
                          border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isActive ? '#4ade80' : '#ef4444'
                          }} />
                          <span>{isActive ? 'Active' : 'Deactivated'}</span>
                        </span>
                      </td>

                      {/* Meetings */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-muted)' }}>
                        {u.meetingsCount || 0}
                      </td>

                      {/* Created At */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-muted)', fontSize: '12.5px' }}>
                        {u.createdAt || 'N/A'}
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-muted)', fontSize: '12.5px' }}>
                        {u.lastLoginAt || 'Never'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {/* Status toggle */}
                          <button
                            type="button"
                            className="btn"
                            style={{
                              height: '30px',
                              padding: '0 8px',
                              fontSize: '11.5px',
                              color: isActive ? 'var(--color-danger)' : '#4ade80'
                            }}
                            onClick={() => setConfirmModal({
                              type: 'status',
                              user: u,
                              targetVal: isActive ? 'deactivated' : 'active'
                            })}
                            title={isActive ? 'Deactivate user' : 'Activate user'}
                          >
                            {isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                            <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                          </button>

                          {/* Role toggle */}
                          <button
                            type="button"
                            className="btn"
                            style={{ height: '30px', padding: '0 8px', fontSize: '11.5px' }}
                            onClick={() => setConfirmModal({
                              type: 'role',
                              user: u,
                              targetVal: isAdmin ? 'user' : 'admin'
                            })}
                            title={isAdmin ? 'Demote to regular user' : 'Promote to admin'}
                          >
                            {isAdmin ? <Shield size={13} /> : <ShieldCheck size={13} />}
                            <span>{isAdmin ? 'Make User' : 'Make Admin'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmModal && (
        <Modal
          title={
            confirmModal.type === 'status'
              ? `${confirmModal.targetVal === 'deactivated' ? 'Deactivate' : 'Activate'} Account`
              : `${confirmModal.targetVal === 'admin' ? 'Promote to Administrator' : 'Demote to Regular User'}`
          }
          onClose={() => setConfirmModal(null)}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', margin: '8px 0 16px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#eab308',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
                Are you sure you want to proceed?
              </p>
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                Target user: <strong>{confirmModal.user.name}</strong> ({confirmModal.user.email}).
                {confirmModal.type === 'status' && confirmModal.targetVal === 'deactivated' && (
                  <span> Deactivating will immediately invalidate all active sessions for this account.</span>
                )}
                {confirmModal.type === 'role' && confirmModal.targetVal === 'user' && (
                  <span> Demoting will revoke all administrative portal access immediately.</span>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button className="btn" onClick={() => setConfirmModal(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button
              className={`btn ${confirmModal.targetVal === 'deactivated' ? 'danger' : 'primary'}`}
              onClick={handleExecuteAction}
              disabled={actionLoading}
            >
              {actionLoading ? 'Updating...' : 'Confirm & Apply'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
