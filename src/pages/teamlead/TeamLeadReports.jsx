import { useState, useEffect } from 'react'
import {
  BarChart3,
  Users,
  Video,
  CheckSquare,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { api } from '../../services/api.js'

export default function TeamLeadReports() {
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReports = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getTeamLeadReports()
      setReports(res)
    } catch (err) {
      setError(err.message || 'Failed to load team metrics and reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--color-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={28} className="spin" style={{ color: '#06b6d4', margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontSize: '14px' }}>Compiling verified team analytics...</p>
        </div>
      </div>
    )
  }

  const repData = reports?.reports || reports || {}
  const meetingStats = repData.meetings || {}
  const actionStats = repData.actionItems || {}
  const membersList = repData.members || reports?.member_attendance || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Team Performance & Meeting Metrics
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Empirical data computed directly from team meetings and action item completions.
          </p>
        </div>

        <button className="btn" onClick={loadReports}>
          <RefreshCw size={14} />
          <span>Recalculate Metrics</span>
        </button>
      </div>

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
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* Total Meetings */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Total Team Meetings</span>
            <Video size={17} style={{ color: '#06b6d4' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)' }}>
            {meetingStats.total || 0}
          </div>
          <span className="muted" style={{ fontSize: '12px' }}>
            {meetingStats.completed || 0} completed, {meetingStats.scheduled || 0} upcoming
          </span>
        </div>

        {/* Action Items Completion Rate */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Task Completion Rate</span>
            <Percent size={17} style={{ color: '#4ade80' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)' }}>
            {actionStats.completionRate ?? 0}%
          </div>
          <span className="muted" style={{ fontSize: '12px' }}>
            {actionStats.completed || 0} of {actionStats.total || 0} tasks completed
          </span>
        </div>

        {/* Attendance Rate */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Meeting Attendance Rate</span>
            <TrendingUp size={17} style={{ color: '#60a5fa' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)' }}>
            {meetingStats.attendanceRate ?? 0}%
          </div>
          <span className="muted" style={{ fontSize: '12px' }}>
            Across all team participants
          </span>
        </div>

        {/* Data Provenance */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Data Provenance</span>
            <CheckCircle2 size={17} style={{ color: '#22d3ee' }} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#22d3ee', marginTop: '6px' }}>
            PostgreSQL Verified
          </div>
          <span className="muted" style={{ fontSize: '12px' }}>
            Real records only (no simulation)
          </span>
        </div>
      </div>

      {/* Member Attendance Breakdown */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
            Member Participation Breakdown
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
            Attendance and tasks completed across your team roster.
          </p>
        </div>

        {membersList.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
            No team attendance records found yet.
          </div>
        ) : (
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
                  <th style={{ padding: '10px 14px' }}>Member</th>
                  <th style={{ padding: '10px 14px' }}>Email</th>
                  <th style={{ padding: '10px 14px' }}>Meetings Attended</th>
                  <th style={{ padding: '10px 14px' }}>Assigned Tasks</th>
                  <th style={{ padding: '10px 14px' }}>Participation Status</th>
                </tr>
              </thead>
              <tbody>
                {membersList.map((m) => {
                  const attended = m.teamMeetingsAttended ?? m.meetings_attended ?? 0
                  const tasks = m.assignedActionItemsCount ?? 0

                  return (
                    <tr key={m.userId || m.user_id || m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {m.name}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-muted)', fontSize: '12.5px' }}>
                        {m.email}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text)', fontWeight: 600 }}>
                        {attended}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text)' }}>
                        {tasks}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: attended > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(100, 116, 139, 0.14)',
                          color: attended > 0 ? '#4ade80' : '#94a3b8',
                          fontWeight: 600
                        }}>
                          {attended > 0 ? 'Active Contributor' : 'No Sessions Yet'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
