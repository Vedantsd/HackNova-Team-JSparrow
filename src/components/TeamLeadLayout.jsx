import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  UsersRound,
  Video,
  CalendarDays,
  FileText,
  Sparkles,
  CheckSquare,
  BarChart3,
  User,
  LogOut,
  Sun,
  Moon,
  Users,
  Menu,
  CheckCircle2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../theme.jsx'
import Logo from './Logo.jsx'

export default function TeamLeadLayout() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileMenu, setMobileMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/team-lead/dashboard', label: 'Team Dashboard', icon: LayoutDashboard },
    { to: '/team-lead/team', label: 'My Team Members', icon: UsersRound },
    { to: '/team-lead/meetings', label: 'Team Meetings', icon: Video },
    { to: '/team-lead/calendar', label: 'Team Calendar', icon: CalendarDays },
    { to: '/team-lead/transcripts', label: 'Meeting Transcripts', icon: FileText },
    { to: '/team-lead/analysis', label: 'Decisions & Analysis', icon: Sparkles },
    { to: '/team-lead/action-items', label: 'Team Action Items', icon: CheckSquare },
    { to: '/team-lead/reports', label: 'Team Reports & Metrics', icon: BarChart3 },
    { to: '/team-lead/profile', label: 'Lead Profile', icon: User },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-background)' }}>
      {/* Mobile scrim */}
      {mobileMenu && (
        <div
          onClick={() => setMobileMenu(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            zIndex: 40,
            backdropFilter: 'blur(3px)'
          }}
        />
      )}

      {/* Team Lead Sidebar */}
      <aside style={{
        width: '260px',
        flexShrink: 0,
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50,
        transition: 'transform 200ms ease'
      }}>
        {/* Brand & Portal Badge */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Logo size={28} />
            <span style={{
              background: 'rgba(6, 182, 212, 0.16)',
              color: '#06b6d4',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: '6px',
              letterSpacing: '0.04em'
            }}>
              TEAM LEAD
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: 'var(--color-muted)' }}>
            Team Management & Operations
          </p>
        </div>

        {/* Navigation list */}
        <nav style={{ padding: '14px 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{
            fontSize: '10.5px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-muted)',
            padding: '4px 8px 8px',
            fontWeight: 600
          }}>
            Team Workspace
          </div>

          {navLinks.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenu(false)}
                className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  marginBottom: '3px',
                  color: isActive ? '#22d3ee' : 'var(--color-text)',
                  background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid transparent',
                  transition: 'background 150ms ease, color 150ms ease'
                })}
              >
                <Icon size={17} style={{ color: item.to === window.location.pathname ? '#22d3ee' : 'inherit' }} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom user profile & logout */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-soft-glass)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0
              }}>
                {user?.name?.[0]?.toUpperCase() || 'L'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Team Lead'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              height: '34px',
              fontSize: '12.5px',
              color: 'var(--color-danger)'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content container */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header style={{
          height: '60px',
          padding: '0 24px',
          background: 'var(--color-surface-glass)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              className="icon-btn menu-btn"
              onClick={() => setMobileMenu(true)}
              aria-label="Open navigation menu"
              style={{ display: 'none' }}
            >
              <Menu size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: '#06b6d4' }} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>CommitFlow Team Lead Console</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(6, 182, 212, 0.12)',
              color: '#22d3ee',
              border: '1px solid rgba(6, 182, 212, 0.25)'
            }}>
              <CheckCircle2 size={13} />
              Team Lead Authorized
            </span>

            {/* Theme Toggle */}
            <button
              className="icon-btn sq"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Render child view */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
