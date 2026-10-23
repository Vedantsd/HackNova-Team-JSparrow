import { useState } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Video, 
  BarChart3, 
  Activity, 
  ScrollText, 
  Sliders, 
  LogOut, 
  ArrowLeft, 
  Sun, 
  Moon, 
  ShieldAlert, 
  Menu, 
  X,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../theme.jsx'
import Logo from './Logo.jsx'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileMenu, setMobileMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/meetings', label: 'Meeting Oversight', icon: Video },
    { to: '/admin/analytics', label: 'Platform Analytics', icon: BarChart3 },
    { to: '/admin/system-health', label: 'System Health', icon: Activity },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
    { to: '/admin/settings', label: 'Platform Settings', icon: Sliders },
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

      {/* Admin Sidebar */}
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
              background: 'rgba(99, 102, 241, 0.16)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: '6px',
              letterSpacing: '0.04em'
            }}>
              ADMIN
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: 'var(--color-muted)' }}>
            System Administration & RBAC Portal
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
            Governance & Controls
          </div>

          {navLinks.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
                  color: isActive ? 'var(--color-nav-text)' : 'var(--color-text)',
                  background: isActive ? 'var(--color-nav)' : 'transparent',
                  transition: 'background 150ms ease, color 150ms ease'
                })}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}

          <div style={{ margin: '16px 0 8px', borderTop: '1px solid var(--color-border)' }} />

          {/* Link back to user dashboard */}
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '13px',
              color: 'var(--color-muted)',
              marginBottom: '4px',
              transition: 'background 150ms ease, color 150ms ease'
            }}
            className="admin-return-link"
          >
            <ArrowLeft size={16} />
            <span>Return to User Panel</span>
          </Link>
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
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0
              }}>
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, truncate: 'true', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Administrator'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', truncate: 'true', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {/* Main admin content container */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Admin topbar */}
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
              <ShieldAlert size={17} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>CommitFlow Administration Console</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Live DB connection pill */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#4ade80',
              border: '1px solid rgba(34, 197, 94, 0.25)'
            }}>
              <CheckCircle2 size={13} />
              Neon PostgreSQL Connected
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

            {/* Return to App Button */}
            <Link to="/" className="btn" style={{ height: '34px', fontSize: '12.5px' }}>
              <ArrowLeft size={14} />
              <span>User Panel</span>
            </Link>
          </div>
        </header>

        {/* Render child admin view */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
