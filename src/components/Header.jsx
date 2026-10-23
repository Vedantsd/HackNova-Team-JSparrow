import { useState, useEffect, useRef } from 'react'
import { 
  Search, 
  Bell, 
  Settings, 
  Plus, 
  Menu, 
  Sun, 
  Moon, 
  Database, 
  Sparkles, 
  CheckSquare, 
  FileText, 
  Check, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  LogOut,
  User
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from './Modal.jsx'
import { api } from '../services/api.js'

export default function Header({ query, setQuery, onMenu }) {
  const nav = useNavigate()
  const { theme, setTheme } = useTheme()
  const { user, logout, isAdmin } = useAuth()
  const [modal, setModal] = useState(false)
  const [creatingMeeting, setCreatingMeeting] = useState(false)
  const [bell, setBell] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cf-read-notifs') || '[]')
    } catch {
      return []
    }
  })
  const dropdownRef = useRef(null)

  const loadNotifications = async () => {
    const list = []

    try {
      // 1. Backend & AI Status
      const health = await api.getHealth()
      if (health?.database?.connected) {
        list.push({
          id: 'notif-db-status',
          type: 'db',
          title: 'Neon PostgreSQL Active',
          desc: 'Connected to Neon PostgreSQL cloud database with full persistence.',
          time: 'System',
          link: null
        })
      }
      if (health?.gemini?.configured) {
        list.push({
          id: 'notif-gemini-status',
          type: 'ai',
          title: 'Google Gemini AI Ready',
          desc: `Model ${health.gemini.model || 'gemini-3.1-flash-lite'} is active for transcript analysis.`,
          time: 'System',
          link: null
        })
      }

      // 2. Action items pending human review
      const actions = await api.listActionItems()
      const pending = Array.isArray(actions) ? actions.filter(a => a.status === 'Pending Approval') : []
      if (pending.length > 0) {
        list.push({
          id: 'notif-pending-actions',
          type: 'action',
          title: `${pending.length} Action Item${pending.length > 1 ? 's' : ''} Pending Review`,
          desc: `Task governance requires approval for "${pending[0].title}"${pending.length > 1 ? ` and ${pending.length - 1} more` : ''}.`,
          time: 'Human Governance',
          link: '/actions'
        })
      }

      // 3. Recent Transcripts
      const transcripts = await api.listTranscripts()
      if (Array.isArray(transcripts) && transcripts.length > 0) {
        const latest = transcripts[0]
        list.push({
          id: `notif-tx-${latest.id}`,
          type: 'transcript',
          title: `Transcript: ${latest.title}`,
          desc: `Analysis completed (${latest.duration || '25 min'}). ${latest.actionItems?.length || 0} tasks tracked.`,
          time: latest.uploadedAt || 'Recent',
          link: `/transcripts/${latest.id}/analysis`
        })
      }
    } catch (e) {
      console.warn('Failed to fetch live notifications:', e)
    }

    setNotifications(list)
  }

  useEffect(() => {
    loadNotifications()
    const handleUpdate = () => loadNotifications()
    window.addEventListener('cf-actions-updated', handleUpdate)
    window.addEventListener('cf-transcripts-updated', handleUpdate)
    return () => {
      window.removeEventListener('cf-actions-updated', handleUpdate)
      window.removeEventListener('cf-transcripts-updated', handleUpdate)
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setBell(false)
      }
    }
    if (bell) {
      document.addEventListener('mousedown', handleOutside)
    }
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [bell])

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length

  const markAllRead = () => {
    const allIds = notifications.map(n => n.id)
    setReadIds(allIds)
    localStorage.setItem('cf-read-notifs', JSON.stringify(allIds))
  }

  const handleNotifClick = notif => {
    if (!readIds.includes(notif.id)) {
      const updated = [...readIds, notif.id]
      setReadIds(updated)
      localStorage.setItem('cf-read-notifs', JSON.stringify(updated))
    }
    setBell(false)
    if (notif.link) {
      nav(notif.link)
    }
  }

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" aria-label="Open menu" onClick={onMenu}>
        <Menu size={18} />
      </button>

      <label className="search">
        <Search size={16} />
        <input 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          placeholder="Search meetings, transcripts, action items..." 
          aria-label="Search" 
        />
      </label>

      <div className="spacer" />

      {/* Theme Toggle */}
      <button 
        className="icon-btn" 
        aria-label="Toggle theme" 
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* Notification Bell & Dropdown */}
      <div className="rel" ref={dropdownRef}>
        <button 
          className="icon-btn" 
          aria-label="Notifications" 
          onClick={() => {
            setBell(b => !b)
            loadNotifications()
          }}
        >
          <Bell size={17} />
          {unreadCount > 0 && <i className="dot" />}
        </button>

        {bell && (
          <div className="dropdown notifications-dropdown">
            <div className="notif-header">
              <b><Bell size={15} /> Notifications {unreadCount > 0 && <span className="badge">{unreadCount}</span>}</b>
              {unreadCount > 0 && (
                <button className="notif-clear-btn" onClick={markAllRead}>
                  Mark all as read
                </button>
              )}
            </div>

            <div className="notif-list">
              {notifications.length === 0 ? (
                <div className="notif-empty">
                  No notifications yet.
                </div>
              ) : (
                notifications.map(n => {
                  const isUnread = !readIds.includes(n.id)
                  return (
                    <button 
                      key={n.id} 
                      className={`notif-item ${isUnread ? 'unread' : ''}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div className={`notif-icon-box ${n.type}`}>
                        {n.type === 'db' && <Database size={16} />}
                        {n.type === 'ai' && <Sparkles size={16} />}
                        {n.type === 'action' && <CheckSquare size={16} />}
                        {n.type === 'transcript' && <FileText size={16} />}
                      </div>
                      <div className="notif-content">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-desc">{n.desc}</div>
                        <div className="notif-time">
                          <Clock size={11} /> {n.time}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <button className="icon-btn" aria-label="Settings" onClick={() => nav('/settings')}>
        <Settings size={17} />
      </button>

      {/* Admin Portal (Visible strictly to authenticated Administrators) */}
      {isAdmin && (
        <button
          className="btn"
          onClick={() => nav('/admin')}
          title="Open Admin Portal"
          style={{
            borderColor: 'rgba(99, 102, 241, 0.4)',
            background: 'rgba(99, 102, 241, 0.08)'
          }}
        >
          <ShieldCheck size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="hide-sm">Admin Portal</span>
        </button>
      )}

      {/* New Meeting */}
      <button className="btn primary" onClick={() => setModal(true)}>
        <Plus size={16} />
        <span className="hide-sm">New Meeting</span>
      </button>

      {/* User Profile & Logout */}
      {user && (
        <div className="row" style={{ gap: '6px', marginLeft: '2px' }}>
          <div
            title={`${user.name} (${user.email}) - Role: ${user.role}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '2px 8px 2px 2px',
              borderRadius: '8px',
              background: 'var(--color-soft)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: isAdmin ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--color-primary)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: '12px'
            }}>
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hide-sm" style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                {isAdmin ? 'Admin' : 'Member'}
              </div>
            </div>
          </div>

          <button
            className="icon-btn sq"
            onClick={async () => { await logout(); nav('/login') }}
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut size={14} style={{ color: 'var(--color-danger)' }} />
          </button>
        </div>
      )}

      {modal && (
        <Modal title="New meeting" onClose={() => setModal(false)}>
          <p className="muted">Start an instant meeting room or upload a transcript for AI analysis.</p>
          <div className="row" style={{ marginTop: '16px' }}>
            <button 
              className="btn primary" 
              disabled={creatingMeeting}
              onClick={async () => {
                setCreatingMeeting(true)
                try {
                  const m = await api.createMeeting({
                    title: `${user?.name || 'User'}'s Live Room`,
                    isPrivate: false
                  })
                  setModal(false)
                  nav(`/meetings/${m.id}/live`)
                } catch {
                  setModal(false)
                  nav('/meetings/new/live')
                } finally {
                  setCreatingMeeting(false)
                }
              }}
            >
              {creatingMeeting ? 'Starting...' : 'Start Meeting Room'}
            </button>
            <button className="btn" onClick={() => { setModal(false); nav('/transcripts') }}>
              Upload Transcript
            </button>
          </div>
        </Modal>
      )}
    </header>
  )
}
