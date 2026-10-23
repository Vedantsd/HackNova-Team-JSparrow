import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Sparkles, Sun, Moon, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../theme.jsx'
import Logo from '../components/Logo.jsx'

export default function Login() {
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      const user = await login(trimmedEmail, password)
      // Redirect strictly based on role to correct isolated dashboard
      if (user.role === 'admin') {
        navigate(from.startsWith('/admin') ? from : '/admin/dashboard', { replace: true })
      } else if (user.role === 'team_lead') {
        navigate(from.startsWith('/team-lead') ? from : '/team-lead/dashboard', { replace: true })
      } else {
        navigate(from.startsWith('/user') ? from : '/user/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const fillQuickCredentials = (userEmail, userPwd) => {
    setEmail(userEmail)
    setPassword(userPwd)
    setError('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 16px',
      background: 'radial-gradient(circle at 50% 15%, rgba(99, 102, 241, 0.12), transparent 70%), var(--color-background)',
      position: 'relative'
    }}>
      {/* Theme toggle in top right */}
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <button
          type="button"
          className="icon-btn"
          aria-label="Toggle color theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '18px',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-elevated)'
      }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '12px' }}>
            <Logo size={36} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', color: 'var(--color-text)' }}>
            Welcome to CommitFlow
          </h1>
          <p className="muted" style={{ fontSize: '13.5px', margin: 0 }}>
            Sign in to access your meeting transcripts and action items.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#ef4444',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--color-soft)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '0 12px',
              height: '42px',
              transition: 'border-color 200ms ease, box-shadow 200ms ease'
            }}>
              <Mail size={16} className="muted" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{
                  border: 0,
                  background: 'none',
                  outline: 0,
                  flex: 1,
                  fontSize: '14px',
                  color: 'var(--color-text)'
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Password
              </label>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--color-soft)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '0 12px',
              height: '42px'
            }}>
              <Lock size={16} className="muted" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{
                  border: 0,
                  background: 'none',
                  outline: 0,
                  flex: 1,
                  fontSize: '14px',
                  color: 'var(--color-text)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  border: 0,
                  background: 'none',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--color-muted)'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn primary"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              height: '44px',
              marginTop: '6px',
              fontSize: '14.5px',
              fontWeight: 600
            }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <LogIn size={17} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Logins for judges / evaluators */}
        <div style={{
          marginTop: '24px',
          paddingTop: '18px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '12px',
          color: 'var(--color-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600 }}>
            <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
            <span>Quick Test Credentials:</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              style={{ height: '30px', fontSize: '11.5px', padding: '0 10px' }}
              onClick={() => fillQuickCredentials('admin@commitflow.dev', 'Admin@CommitFlow2026!')}
            >
              <ShieldCheck size={13} style={{ color: '#4ade80' }} />
              Admin: admin@commitflow.dev
            </button>
            <button
              type="button"
              className="btn"
              style={{ height: '30px', fontSize: '11.5px', padding: '0 10px' }}
              onClick={() => fillQuickCredentials('teamlead@commitflow.dev', 'Lead@CommitFlow2026!')}
            >
              <Users size={13} style={{ color: '#6366f1' }} />
              Team Lead: teamlead@commitflow.dev
            </button>
            <button
              type="button"
              className="btn"
              style={{ height: '30px', fontSize: '11.5px', padding: '0 10px' }}
              onClick={() => fillQuickCredentials('testuser1@example.com', 'TestPassword123!')}
            >
              User: testuser1@example.com
            </button>
          </div>
        </div>

        {/* Sign up link */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '13px',
          color: 'var(--color-muted)'
        }}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{
              color: 'var(--color-primary)',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  )
}
