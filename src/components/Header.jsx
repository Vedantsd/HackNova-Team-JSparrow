import { useState } from 'react'
import { Search, Bell, Settings, Plus, Menu, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme.jsx'
import Modal from './Modal.jsx'
export default function Header({ query, setQuery, onMenu }) {
  const nav = useNavigate(), { theme, setTheme } = useTheme()
  const [modal, setModal] = useState(false), [bell, setBell] = useState(false)
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" aria-label="Open menu" onClick={onMenu}><Menu size={18} /></button>
      <label className="search"><Search size={16} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search meetings, transcripts, action items..." aria-label="Search" /></label>
      <div className="spacer" />
      <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      <div className="rel">
        <button className="icon-btn" aria-label="Notifications" onClick={() => setBell(b => !b)}><Bell size={17} /><i className="dot" /></button>
        {bell && <div className="dropdown">No notifications yet. Alerts appear here once the backend is connected.</div>}
      </div>
      <button className="icon-btn" aria-label="Settings" onClick={() => nav('/settings')}><Settings size={17} /></button>
      <button className="btn primary" onClick={() => setModal(true)}><Plus size={16} /><span className="hide-sm">New Meeting</span></button>
      {modal && <Modal title="New meeting" onClose={() => setModal(false)}>
        <p className="muted">Start a room now, or import a transcript for summary and action-item extraction.</p>
        <div className="row">
          <button className="btn primary" onClick={() => { setModal(false); nav('/meetings/new/live') }}>Start meeting</button>
          <label className="btn">Import transcript<input type="file" accept=".txt,.vtt,.srt" hidden
            onChange={() => { setModal(false); alert('Transcript upload needs POST /api/transcripts (not implemented yet).') }} /></label>
        </div></Modal>}
    </header>)
}
