import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Shield,
  UsersRound,
  LogOut,
  Calendar,
  CheckCircle2,
  KeyRound
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

export default function TeamLeadProfile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTeamLeadTeam()
      .then(res => setTeam(res.team))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '780px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
          Team Lead Profile
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
          Inspect your verified identity, role authorization, and assigned organizational team.
        </p>
      </div>

      {/* Profile Card */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        {/* User Identity Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: '24px',
            fontWeight: 700
          }}>
            {user?.name?.[0]?.toUpperCase() || 'L'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>
                {user?.name || 'Team Lead'}
              </h2>
              <span style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#22d3ee',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                TEAM LEAD
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '4px' }}>
              {user?.email}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Details List */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span className="muted" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={13} style={{ color: '#06b6d4' }} />
              Role Permission Scope
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
              Team Lead (Scoped to Assigned Team)
            </span>
          </div>

          <div style={{
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span className="muted" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UsersRound size={13} style={{ color: '#06b6d4' }} />
              Assigned Organizational Team
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
              {team ? team.name : 'Engineering Core'}
            </span>
          </div>

          <div style={{
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span className="muted" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <KeyRound size={13} style={{ color: '#06b6d4' }} />
              Authentication Method
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
              Secure Session Token (Neon PostgreSQL)
            </span>
          </div>

          <div style={{
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span className="muted" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={13} style={{ color: '#4ade80' }} />
              Account Status
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>
              Active
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn"
            onClick={handleLogout}
            style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <LogOut size={15} />
            <span>Sign Out of Console</span>
          </button>
        </div>
      </div>
    </div>
  )
}
