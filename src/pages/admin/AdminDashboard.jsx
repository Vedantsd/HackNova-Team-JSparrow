import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Users, 
  Video, 
  CheckSquare, 
  ShieldCheck, 
  Activity, 
  ArrowRight, 
  RefreshCw,
  Clock,
  Sparkles,
  FileText,
  AlertTriangle,
  UserCheck
} from 'lucide-react'
import { api } from '../../services/api.js'

export default function AdminDashboard() {
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
      setError(err.message || 'Failed to load platform statistics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading && !stats) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '300px' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)', marginBottom: '12px' }} />
          <div className="muted">Loading platform statistics...</div>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Users',
      val: stats?.total_users ?? 0,
      sub: `${stats?.active_users ?? 0} Active • ${stats?.deactivated_users ?? 0} Deactivated`,
      icon: Users,
      color: '#4f46e5',
      link: '/admin/users'
    },
    {
      title: 'Active Administrators',
      val: stats?.admin_users ?? 0,
      sub: 'Enforced with RBAC safeguards',
      icon: ShieldCheck,
      color: '#10b981',
      link: '/admin/users?role=admin'
    },
    {
      title: 'Meeting Transcripts',
      val: stats?.total_meetings ?? 0,
      sub: `${stats?.processed_meetings ?? 0} Processed • ${stats?.processing_meetings ?? 0} In Progress`,
      icon: Video,
      color: '#3b82f6',
      link: '/admin/meetings'
    },
    {
      title: 'Action Items Tracked',
      val: stats?.total_action_items ?? 0,
      sub: `${stats?.approved_action_items ?? 0} Approved • ${stats?.pending_action_items ?? 0} Pending`,
      icon: CheckSquare,
      color: '#f59e0b',
      link: '/admin/analytics'
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Admin Dashboard
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Platform-wide governance metrics backed by Neon PostgreSQL.
          </p>
        </div>
        <button className="btn" onClick={loadStats} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Data</span>
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

      {/* Metric Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        {statCards.map((c, i) => {
          const Icon = c.icon
          return (
            <div
              key={i}
              style={{
                background: 'var(--color-surface-glass)',
                backdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--color-border)',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 200ms ease, box-shadow 200ms ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-muted)' }}>{c.title}</span>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: `${c.color}20`,
                    color: c.color,
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    <Icon size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, margin: '4px 0 6px', color: 'var(--color-text)' }}>
                  {c.val}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  {c.sub}
                </div>
              </div>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                <Link
                  to={c.link}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    textDecoration: 'none'
                  }}
                >
                  <span>Manage</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* 2-column section: Recent Audit Activity & Governance Shortcuts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {/* Recent Platform Activity */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div className="between" style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Recent Platform Activity</h2>
            <Link to="/admin/audit-logs" style={{ fontSize: '12.5px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              View All Logs &rarr;
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!stats?.recent_activity || stats.recent_activity.length === 0) ? (
              <div className="muted" style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px' }}>
                No recent activity recorded.
              </div>
            ) : (
              stats.recent_activity.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--color-soft)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: act.action.includes('FAIL') ? 'var(--color-danger)' : 'var(--color-primary)'
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, truncate: 'true' }}>{act.action}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>{act.userEmail || 'System'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                    {act.createdAt}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Admin Actions & Overview */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px' }}>Security & Governance Status</h2>
            <p className="muted" style={{ fontSize: '13px', margin: '0 0 16px' }}>
              Summary of authentication enforcement and access policies.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-soft)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <ShieldCheck size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Backend RBAC Strict Enforcement</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>
                    All routes and mutations validate role on Flask server. HTTP 401 & 403 status codes returned.
                  </div>
                </div>
              </div>

              <div style={{
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-soft)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Last Active Administrator Protection</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>
                    Accidental deactivation or demotion of the final administrator is strictly prevented.
                  </div>
                </div>
              </div>

              <div style={{
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-soft)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Activity size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Audit Logging Active</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>
                    Administrative actions, status modifications, and sensitive inspections are logged into Neon.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link to="/admin/users" className="btn primary" style={{ height: '36px', fontSize: '13px' }}>
              <Users size={15} />
              <span>Manage Users</span>
            </Link>
            <Link to="/admin/system-health" className="btn" style={{ height: '36px', fontSize: '13px' }}>
              <Activity size={15} />
              <span>System Health</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
