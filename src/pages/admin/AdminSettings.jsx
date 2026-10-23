import { useState, useEffect } from 'react'
import { Sliders, Save, CheckCircle2, AlertCircle, RefreshCw, Shield } from 'lucide-react'
import { api } from '../../services/api.js'

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    platform_name: 'CommitFlow Enterprise',
    allow_public_registration: true,
    default_session_days: 7,
    require_task_approval: true,
    maintenance_mode: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const loadSettings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getAdminSettings()
      if (res && res.settings) {
        setSettings((prev) => ({ ...prev, ...res.settings }))
      }
    } catch (err) {
      setError(err.message || 'Failed to load platform settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSuccess('')
    setError('')

    try {
      await api.updateAdminSettings(settings)
      setSuccess('Platform configuration updated and saved to Neon PostgreSQL.')
    } catch (err) {
      setError(err.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '780px' }}>
      {/* Title */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Platform Governance Settings
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            System-wide registration rules, session durations, and task approval defaults.
          </p>
        </div>
        <button className="btn" onClick={loadSettings} disabled={loading || saving}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Reload</span>
        </button>
      </div>

      {success && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          color: '#4ade80',
          borderRadius: '10px',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={17} />
          <span>{success}</span>
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
          gap: '8px'
        }}>
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '28px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Platform Name */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Platform Deployment Name
          </label>
          <input
            type="text"
            value={settings.platform_name || ''}
            onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
            style={{
              width: '100%',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-soft)',
              color: 'var(--color-text)',
              padding: '0 12px',
              fontSize: '13.5px'
            }}
          />
          <span style={{ fontSize: '11.5px', color: 'var(--color-muted)', display: 'block', marginTop: '4px' }}>
            Displayed across platform headers and invitations.
          </span>
        </div>

        {/* Public Registration Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'var(--color-soft)',
          borderRadius: '10px',
          border: '1px solid var(--color-border)'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Allow Public Sign Up</div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              When enabled, visitors can register accounts (strictly assigned the 'user' role).
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!settings.allow_public_registration}
            onChange={(e) => setSettings({ ...settings, allow_public_registration: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>

        {/* Session Timeout */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Session Expiration Duration (Days)
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={settings.default_session_days || 7}
            onChange={(e) => setSettings({ ...settings, default_session_days: parseInt(e.target.value) || 7 })}
            style={{
              width: '120px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-soft)',
              color: 'var(--color-text)',
              padding: '0 12px',
              fontSize: '13.5px'
            }}
          />
          <span style={{ fontSize: '11.5px', color: 'var(--color-muted)', display: 'block', marginTop: '4px' }}>
            Number of days before an idle cookie/token session expires.
          </span>
        </div>

        {/* Require Task Approval Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'var(--color-soft)',
          borderRadius: '10px',
          border: '1px solid var(--color-border)'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Human-in-the-Loop Task Governance</div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              Requires explicit user or admin approval before AI action items are finalized.
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!settings.require_task_approval}
            onChange={(e) => setSettings({ ...settings, require_task_approval: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="submit"
            className="btn primary"
            disabled={saving || loading}
            style={{ height: '42px', padding: '0 20px', fontSize: '14px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving Settings...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
