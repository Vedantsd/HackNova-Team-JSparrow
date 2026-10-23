import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Video,
  CheckSquare,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Plus,
  RefreshCw,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { api } from '../../services/api.js'

export default function TeamLeadDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getTeamLeadDashboard()
      setData(res)
    } catch (err) {
      setError(err.message || 'Failed to load team dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--color-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={28} className="spin" style={{ color: '#06b6d4', margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontSize: '14px' }}>Loading team metrics and activities...</p>
        </div>
      </div>
    )
  }

  const team = data?.team
  const stats = data?.stats || {
    totalMembers: 0,
    upcomingMeetings: 0,
    completedMeetings: 0,
    actionItems: { pending: 0, inProgress: 0, completed: 0, overdue: 0 }
  }
  const recentMeetings = data?.recentMeetings || []
  const recentActionItems = data?.recentActionItems || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(8, 145, 178, 0.04))',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{
              background: 'rgba(6, 182, 212, 0.2)',
              color: '#22d3ee',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em'
            }}>
              ASSIGNED TEAM
            </span>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--color-text)' }}>
              {team ? team.name : 'Team Lead Workspace'}
            </h1>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px', maxWidth: '600px' }}>
            {team?.description || 'Monitor your team members, coordinate upcoming meetings, track action items, and review transcripts.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={loadDashboard}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <Link to="/team-lead/meetings" className="btn primary" style={{ background: '#0891b2', borderColor: '#0891b2' }}>
            <Plus size={15} />
            <span>Schedule Meeting</span>
          </Link>
        </div>
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

      {/* Real Statistics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        {/* Team Members */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Active Members</span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.15)',
              color: '#22d3ee',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text)' }}>
            {stats.membersCount ?? stats.totalMembers ?? 0}
          </div>
          <Link to="/team-lead/team" style={{ fontSize: '12px', color: '#22d3ee', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            <span>Manage team roster</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Upcoming Meetings */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Upcoming Meetings</span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Video size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text)' }}>
            {stats.upcomingMeetingsCount ?? stats.upcomingMeetings ?? 0}
          </div>
          <Link to="/team-lead/meetings" style={{ fontSize: '12px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            <span>View calendar & schedule</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Completed Meetings */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Completed Meetings</span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              display: 'grid',
              placeItems: 'center'
            }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text)' }}>
            {stats.completedMeetingsCount ?? stats.completedMeetings ?? 0}
          </div>
          <Link to="/team-lead/transcripts" style={{ fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            <span>Review transcripts</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Action Items Breakdown */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div className="between">
            <span className="muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>Action Items</span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#facc15',
              display: 'grid',
              placeItems: 'center'
            }}>
              <CheckSquare size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text)' }}>
              {(stats.pendingActionItemsCount ?? stats.actionItems?.pending ?? 0)}
            </span>
            <span className="muted" style={{ fontSize: '12px' }}>
              open ({(stats.completedActionItemsCount ?? stats.actionItems?.completed ?? 0)} completed)
            </span>
          </div>
          <Link to="/team-lead/action-items" style={{ fontSize: '12px', color: '#facc15', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            <span>Assign & review tasks</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Main Grid: Recent Meetings & Action Items */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* Recent Meetings Panel */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="between">
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Video size={16} style={{ color: '#06b6d4' }} />
              <span>Recent Team Meetings</span>
            </h3>
            <Link to="/team-lead/meetings" className="muted" style={{ fontSize: '12px', textDecoration: 'none' }}>
              View all
            </Link>
          </div>

          {recentMeetings.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
              No meetings scheduled for this team yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentMeetings.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--color-soft)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', display: 'flex', gap: '10px', marginTop: '3px' }}>
                      <span>{m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString() : 'Scheduled'}</span>
                      <span>•</span>
                      <span>{m.participant_count || 0} participants</span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: m.status === 'completed' ? 'rgba(34, 197, 94, 0.12)' : m.status === 'live' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                    color: m.status === 'completed' ? '#4ade80' : m.status === 'live' ? '#f87171' : '#60a5fa',
                    textTransform: 'capitalize',
                    flexShrink: 0
                  }}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Action Items Panel */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="between">
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={16} style={{ color: '#facc15' }} />
              <span>Pending Team Action Items</span>
            </h3>
            <Link to="/team-lead/action-items" className="muted" style={{ fontSize: '12px', textDecoration: 'none' }}>
              View all
            </Link>
          </div>

          {recentActionItems.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
              No open action items for this team.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentActionItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--color-soft)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', display: 'flex', gap: '8px', marginTop: '3px' }}>
                      <span>Assignee: <strong>{item.assignee_name || 'Unassigned'}</strong></span>
                      {item.due_date && (
                        <>
                          <span>•</span>
                          <span>Due: {item.due_date}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: item.status === 'Completed' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                    color: item.status === 'Completed' ? '#4ade80' : '#facc15',
                    flexShrink: 0
                  }}>
                    {item.status || 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
