import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle, Sun, Moon, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../theme.jsx'
import Logo from '../components/Logo.jsx'

export default function SignUp() {
  const { register } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      setError('Please enter your full name.')
      return
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please provide a valid email address.')
      return
    }
    if (!password) {
      setError('Please enter a password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register({
        name: trimmedName,
        email: trimmedEmail,
        password,
        confirmPassword
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
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
        maxWidth: '460px',
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '18px',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-elevated)'
      }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '12px' }}>
            <Logo size={36} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', color: 'var(--color-text)' }}>
            Create your Account
          </h1>
          <p className="muted" style={{ fontSize: '13.5px', margin: 0 }}>
            Start automating meetings with AI transcripts and action items.
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
              Full Name
            </label>
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
              <User size={16} className="muted" />
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              height: '42px'
            }}>
              <Mail size={16} className="muted" />
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="alex@company.com"
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
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
              Password
            </label>
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
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimum 6 characters"
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

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
              Confirm Password
            </label>
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
                id="signup-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

          <button
            id="signup-submit-btn"
            type="submit"
            className="btn primary"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              height: '44px',
              marginTop: '8px',
              fontSize: '14.5px',
              fontWeight: 600
            }}
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <UserPlus size={17} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Security badge notice */}
        <div style={{
          marginTop: '20px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--color-soft)',
          fontSize: '12px',
          color: 'var(--color-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
          <span>Accounts are protected with salted scrypt hashing & encrypted sessions.</span>
        </div>

        {/* Login link */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '13px',
          color: 'var(--color-muted)'
        }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: 'var(--color-primary)',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
