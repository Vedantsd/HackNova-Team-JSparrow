import { useState, useEffect } from 'react'
import { BarChart3, Users, CheckSquare, Sparkles, RefreshCw, TrendingUp, CheckCircle, Clock, XCircle } from 'lucide-react'
import { api } from '../../services/api.js'

export default function AdminAnalytics() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStats = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAdminStats()
      setStats(data)
    } catch (err) {
      setError(err.message || 'Failed to load platform analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const totalUsers = stats?.total_users || 0
  const activeUsers = stats?.active_users || 0
  const userActivePct = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0

  const totalTasks = stats?.total_action_items || 0
  const approvedTasks = stats?.approved_action_items || 0
  const pendingTasks = stats?.pending_action_items || 0
  const rejectedTasks = stats?.rejected_action_items || 0

  const approvedPct = totalTasks > 0 ? Math.round((approvedTasks / totalTasks) * 100) : 0
  const pendingPct = totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0
  const rejectedPct = totalTasks > 0 ? Math.round((rejectedTasks / totalTasks) * 100) : 0

  const totalMeetings = stats?.total_meetings || 0
  const processedMeetings = stats?.processed_meetings || 0
  const meetingSuccessPct = totalMeetings > 0 ? Math.round((processedMeetings / totalMeetings) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Platform Analytics & Health Metrics
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Database-backed operational rates and governance execution analytics.
          </p>
        </div>
        <button className="btn" onClick={loadStats} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Analytics</span>
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

      {/* 3 Overview Rate Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {/* User Engagement Rate */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div className="between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-muted)' }}>Account Active Rate</span>
            <Users size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-text)' }}>
            {userActivePct}%
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', margin: '4px 0 14px' }}>
            {activeUsers} of {totalUsers} accounts active
          </div>
          {/* Progress bar */}
          <div style={{ height: '8px', background: 'var(--color-soft)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${userActivePct}%`, background: 'linear-gradient(90deg, #4f46e5, #6366f1)', borderRadius: '4px' }} />
          </div>
        </div>

        {/* Task Approval Rate */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div className="between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-muted)' }}>Action Item Approval Rate</span>
            <CheckSquare size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-text)' }}>
            {approvedPct}%
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', margin: '4px 0 14px' }}>
            {approvedTasks} approved of {totalTasks} tracked tasks
          </div>
          <div style={{ height: '8px', background: 'var(--color-soft)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${approvedPct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px' }} />
          </div>
        </div>

        {/* AI Success Rate */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div className="between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-muted)' }}>AI Processing Success</span>
            <Sparkles size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-text)' }}>
            {meetingSuccessPct}%
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', margin: '4px 0 14px' }}>
            {processedMeetings} of {totalMeetings} transcripts processed
          </div>
          <div style={{ height: '8px', background: 'var(--color-soft)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${meetingSuccessPct}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '4px' }} />
          </div>
        </div>
      </div>

      {/* Task Governance Distribution Breakdown */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>
          Action Item Governance Breakdown
        </h2>
        <p className="muted" style={{ fontSize: '13px', margin: '0 0 20px' }}>
          Human-in-the-loop task decisions across all meetings.
        </p>

        {/* Multi-segment bar */}
        <div style={{
          height: '14px',
          background: 'var(--color-soft)',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          marginBottom: '20px'
        }}>
          <div style={{ width: `${approvedPct}%`, background: '#10b981', transition: 'width 300ms ease' }} title={`Approved: ${approvedPct}%`} />
          <div style={{ width: `${pendingPct}%`, background: '#f59e0b', transition: 'width 300ms ease' }} title={`Pending: ${pendingPct}%`} />
          <div style={{ width: `${rejectedPct}%`, background: '#ef4444', transition: 'width 300ms ease' }} title={`Rejected: ${rejectedPct}%`} />
        </div>

        {/* Legend */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <CheckCircle size={20} style={{ color: '#10b981' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Approved Tasks</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{approvedTasks} ({approvedPct}%)</div>
            </div>
          </div>

          <div style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Clock size={20} style={{ color: '#f59e0b' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Pending Human Review</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{pendingTasks} ({pendingPct}%)</div>
            </div>
          </div>

          <div style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <XCircle size={20} style={{ color: '#ef4444' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Rejected Tasks</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{rejectedTasks} ({rejectedPct}%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
