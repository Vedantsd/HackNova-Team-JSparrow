import { useState, useEffect } from 'react'
import { 
  Activity, 
  Database, 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Server
} from 'lucide-react'
import { api } from '../../services/api.js'

export default function AdminSystemHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState(null)

  const checkHealth = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAdminSystemHealth()
      setHealth(data)
      setLastChecked(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err.message || 'Failed to query system health.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  const isHealthy = health?.status === 'healthy'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Title */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            System Health & Service Connectivity
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Live status of Neon PostgreSQL, Google Gemini AI, and backend services.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastChecked && (
            <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              Last checked: {lastChecked}
            </span>
          )}
          <button className="btn" onClick={checkHealth} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Run Diagnostic</span>
          </button>
        </div>
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

      {/* Main overall status card */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: isHealthy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
            color: isHealthy ? '#4ade80' : '#facc15',
            display: 'grid',
            placeItems: 'center'
          }}>
            {isHealthy ? <CheckCircle2 size={26} /> : <AlertCircle size={26} />}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>
              Platform Status: {isHealthy ? 'Healthy & Operational' : 'Degraded'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '2px' }}>
              All core services reporting back from host environment.
            </div>
          </div>
        </div>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '30px',
          fontSize: '12.5px',
          fontWeight: 600,
          background: isHealthy ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
          color: isHealthy ? '#4ade80' : '#facc15',
          border: `1px solid ${isHealthy ? 'rgba(34, 197, 94, 0.35)' : 'rgba(234, 179, 8, 0.35)'}`
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isHealthy ? '#4ade80' : '#facc15' }} />
          <span>{isHealthy ? 'All Systems Go' : 'Attention Required'}</span>
        </span>
      </div>

      {/* Grid of Subsystems */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '18px'
      }}>
        {/* Neon PostgreSQL Database */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div className="between" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Database size={18} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>Database Layer</span>
            </div>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '6px',
              background: health?.database?.status === 'connected' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: health?.database?.status === 'connected' ? '#4ade80' : '#ef4444'
            }}>
              {health?.database?.status === 'connected' ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span className="muted">Engine</span>
              <strong>{health?.database?.provider || 'Neon PostgreSQL'}</strong>
            </div>
            <div className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span className="muted">Active Admins</span>
              <strong>{health?.database?.activeAdmins ?? 1} configured</strong>
            </div>
            <div style={{ paddingTop: '8px', color: 'var(--color-muted)', fontSize: '12px' }}>
              {health?.database?.message}
            </div>
          </div>
        </div>

        {/* Google Gemini AI */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div className="between" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#a855f7',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Sparkles size={18} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>AI Integration</span>
            </div>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '6px',
              background: health?.ai?.status === 'configured' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              color: health?.ai?.status === 'configured' ? '#4ade80' : '#facc15'
            }}>
              {health?.ai?.status === 'configured' ? 'Active' : 'Unconfigured'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span className="muted">Provider</span>
              <strong>{health?.ai?.provider || 'Google Gemini'}</strong>
            </div>
            <div className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span className="muted">Active Model</span>
              <strong>{health?.ai?.model || 'gemini-3.1-flash-lite'}</strong>
            </div>
            <div style={{ paddingTop: '8px', color: 'var(--color-muted)', fontSize: '12px' }}>
              {health?.ai?.message}
            </div>
          </div>
        </div>

        {/* Runtime Environment */}
        <div style={{
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div className="between" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Server size={18} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>Backend Runtime</span>
            </div>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80'
            }}>
              Online
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span className="muted">Python Version</span>
              <strong>Python {health?.system?.pythonVersion || '3.13'}</strong>
            </div>
            <div className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span className="muted">Operating System</span>
              <strong>{health?.system?.os || 'Windows'}</strong>
            </div>
            <div className="between" style={{ padding: '8px 0' }}>
              <span className="muted">Total Records</span>
              <strong>{health?.system?.totalMeetings || 0} Meetings • {health?.system?.totalUsers || 0} Users</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
