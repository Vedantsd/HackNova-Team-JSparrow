import { useState, useEffect } from 'react'
import {
  CheckSquare,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  User,
  Calendar,
  AlertTriangle,
  Download,
  Layers
} from 'lucide-react'
import { api } from '../../services/api.js'

export default function TeamLeadActionItems() {
  const [actionItems, setActionItems] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [itemsRes, teamRes] = await Promise.all([
        api.getTeamLeadActionItems(),
        api.getTeamLeadTeam()
      ])
      setActionItems(itemsRes.action_items || [])
      setTeamMembers(teamRes.members || [])
    } catch (err) {
      setError(err.message || 'Failed to load team action items.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAssignChange = async (itemId, assigneeId) => {
    setUpdatingId(itemId)
    setError('')
    setSuccessMsg('')
    try {
      await api.assignTeamLeadActionItem(itemId, assigneeId ? Number(assigneeId) : null)
      setSuccessMsg('Assignee updated successfully.')
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to assign action item.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleStatusChange = async (itemId, newStatus) => {
    setUpdatingId(itemId)
    setError('')
    setSuccessMsg('')
    try {
      await api.updateTeamLeadActionItem(itemId, { status: newStatus })
      setSuccessMsg(`Status updated to "${newStatus}".`)
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to update action item status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDueDateChange = async (itemId, newDate) => {
    setUpdatingId(itemId)
    setError('')
    setSuccessMsg('')
    try {
      await api.updateTeamLeadActionItem(itemId, { due_date: newDate || null })
      setSuccessMsg('Due date updated.')
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to update deadline.')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredItems = actionItems.filter(item => {
    const matchesSearch = item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.meeting_title?.toLowerCase().includes(search.toLowerCase()) ||
      item.assignee_name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Team Action Items & Deliverables
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Assign deliverables to real team members, track status, and manage deadlines.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn sm"
            onClick={() => { window.location.href = api.getExportTasksUrl('csv') }}
            title="Download CSV export"
            style={{ gap: '5px' }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button
            className="btn sm"
            onClick={async () => {
              try {
                const data = await api.exportTasksJson()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `team_approved_tasks.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              } catch (e) {
                alert('Export failed')
              }
            }}
            title="Download JSON export"
            style={{ gap: '5px' }}
          >
            <Layers size={13} />
            <span>Export JSON</span>
          </button>
          <button className="btn" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '0 12px',
            height: '38px',
            flex: 1,
            maxWidth: '360px'
          }}>
            <Search size={15} className="muted" />
            <input
              type="text"
              placeholder="Search by task title, meeting, or assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 0, background: 'none', outline: 0, flex: 1, fontSize: '13px', color: 'var(--color-text)' }}
            />
          </div>

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
            <option value="Pending Review">Pending Review</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div className="muted" style={{ fontSize: '13px' }}>
          Total Tasks: <strong>{actionItems.length}</strong>
        </div>
      </div>

      {/* Action Items Table */}
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
                <th style={{ padding: '12px 18px' }}>Action Item Title</th>
                <th style={{ padding: '12px 16px' }}>Meeting Source</th>
                <th style={{ padding: '12px 16px' }}>Assigned Member</th>
                <th style={{ padding: '12px 16px' }}>Deadline</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--color-muted)' }}>
                    {loading ? 'Loading tasks...' : 'No matching action items found.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 150ms ease'
                    }}
                  >
                    {/* Title */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {item.title}
                        </span>
                        <span className={`classification-badge ${item.itemType || 'commitment'}`}>
                          {item.itemType ? item.itemType.replace(/_/g, ' ') : 'Commitment'}
                        </span>
                      </div>
                      {item.description && (
                        <div className="muted" style={{ fontSize: '12px', marginTop: '3px', lineHeight: 1.4 }}>
                          {item.description}
                        </div>
                      )}
                      {(item.isDuplicate || item.duplicateWarning) && (
                        <div className="duplicate-callout" style={{ marginTop: '4px', padding: '4px 8px', fontSize: '11px' }}>
                          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                          <span>{item.duplicateWarning || 'Duplicate detected'}</span>
                        </div>
                      )}
                      {(item.isConflict || item.conflictWarning) && (
                        <div className="conflict-callout" style={{ marginTop: '4px', padding: '4px 8px', fontSize: '11px' }}>
                          <AlertCircle size={12} style={{ flexShrink: 0 }} />
                          <span>{item.conflictWarning || 'Conflict detected'}</span>
                        </div>
                      )}
                    </td>

                    {/* Meeting */}
                    <td style={{ padding: '14px 16px', color: 'var(--color-muted)', fontSize: '12.5px' }}>
                      {item.sourceMeetingTitle || item.meeting_title || 'Team Meeting'}
                    </td>

                    {/* Assigned Member Select */}
                    <td style={{ padding: '14px 16px' }}>
                      <select
                        value={item.assigneeId || item.assignee_id || ''}
                        disabled={updatingId === item.id}
                        onChange={(e) => handleAssignChange(item.id, e.target.value)}
                        style={{
                          height: '32px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-soft)',
                          color: 'var(--color-text)',
                          padding: '0 8px',
                          fontSize: '12px',
                          minWidth: '150px'
                        }}
                      >
                        <option value="">-- Unassigned --</option>
                        {teamMembers.map(m => {
                          const mId = m.userId || m.user_id || m.id
                          return (
                            <option key={mId} value={mId}>
                              {m.name} ({m.email})
                            </option>
                          )
                        })}
                      </select>
                    </td>

                    {/* Deadline Input */}
                    <td style={{ padding: '14px 16px' }}>
                      <input
                        type="date"
                        defaultValue={item.deadline || item.due_date || ''}
                        disabled={updatingId === item.id}
                        onBlur={(e) => {
                          const currentVal = item.deadline || item.due_date || ''
                          if (e.target.value !== currentVal) {
                            handleDueDateChange(item.id, e.target.value)
                          }
                        }}
                        style={{
                          height: '32px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-soft)',
                          color: 'var(--color-text)',
                          padding: '0 8px',
                          fontSize: '12px'
                        }}
                      />
                    </td>

                    {/* Status Select */}
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <select
                        value={item.status || 'Pending Review'}
                        disabled={updatingId === item.id}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        style={{
                          height: '32px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          background: item.status === 'Completed'
                            ? 'rgba(34, 197, 94, 0.12)'
                            : item.status === 'In Progress'
                            ? 'rgba(59, 130, 246, 0.12)'
                            : 'rgba(234, 179, 8, 0.12)',
                          color: item.status === 'Completed'
                            ? '#4ade80'
                            : item.status === 'In Progress'
                            ? '#60a5fa'
                            : '#facc15',
                          padding: '0 8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Pending Review">Pending Review</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
