import { useState, useEffect } from 'react'
import { ScrollText, RefreshCw, Filter, Search, ShieldAlert, CheckCircle2, AlertTriangle, Key } from 'lucide-react'
import { api } from '../../services/api.js'

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const loadLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getAdminAuditLogs({
        action: actionFilter || undefined
      })
      setLogs(res.logs || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch audit records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [actionFilter])

  const getActionBadge = (action) => {
    if (action.includes('LOGIN_SUCCESS')) {
      return { bg: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.35)' }
    }
    if (action.includes('FAIL') || action.includes('BLOCKED')) {
      return { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' }
    }
    if (action.includes('ROLE') || action.includes('STATUS')) {
      return { bg: 'rgba(234, 179, 8, 0.12)', color: '#facc15', border: 'rgba(234, 179, 8, 0.35)' }
    }
    if (action.includes('INVESTIGATE')) {
      return { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' }
    }
    return { bg: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)', border: 'rgba(99, 102, 241, 0.35)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Title */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Immutable Audit Trail
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Verifiable logs of logins, role mutations, status updates, and sensitive actions.
          </p>
        </div>
        <button className="btn" onClick={loadLogs} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#ef4444',
          borderRadius: '10px',
          fontSize: '13.5px'
        }}>
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} className="muted" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Filter by Event Type:</span>
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            height: '36px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-soft)',
            color: 'var(--color-text)',
            padding: '0 12px',
            fontSize: '13px'
          }}
        >
          <option value="">All Events</option>
          <option value="USER_REGISTERED">User Registrations</option>
          <option value="LOGIN_SUCCESS">Successful Logins</option>
          <option value="LOGIN_FAILED">Failed Logins</option>
          <option value="USER_LOGOUT">User Logouts</option>
          <option value="USER_STATUS_CHANGE">Status Changes</option>
          <option value="USER_ROLE_CHANGE">Role Changes</option>
          <option value="ADMIN_INVESTIGATE_MEETING">Meeting Investigations</option>
          <option value="PLATFORM_SETTINGS_UPDATED">Settings Modifications</option>
        </select>
      </div>

      {/* Logs Table */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                background: 'var(--color-soft)',
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
                fontSize: '11.5px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <th style={{ padding: '12px 18px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px' }}>Event Action</th>
                <th style={{ padding: '12px 16px' }}>User / Actor</th>
                <th style={{ padding: '12px 16px' }}>Event Details</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--color-muted)' }}>
                    {loading ? 'Loading audit records...' : 'No audit records found.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action)
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 150ms ease'
                      }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '12px 18px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {log.createdAt}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          letterSpacing: '0.03em'
                        }}>
                          {log.action}
                        </span>
                      </td>

                      {/* User email */}
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {log.userEmail || <span className="muted">System</span>}
                      </td>

                      {/* Details JSON */}
                      <td style={{ padding: '12px 16px', maxWidth: '340px' }}>
                        <code style={{
                          fontSize: '11.5px',
                          color: 'var(--color-text)',
                          wordBreak: 'break-all',
                          background: 'var(--color-soft)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-border)'
                        }}>
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                        </code>
                      </td>

                      {/* IP */}
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--color-muted)', fontSize: '12px' }}>
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
