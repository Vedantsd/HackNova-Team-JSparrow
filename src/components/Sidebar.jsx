import { NavLink } from 'react-router-dom'
import { Home, Video, CalendarDays, FileText, Sparkles, CheckSquare, HelpCircle, Users, FolderOpen, BarChart3, Plug, ShieldCheck, Trello } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo.jsx'

const groups = [
  ['Overview', [['/user/dashboard', 'Dashboard', Home], ['/user/meetings', 'My Meetings', Video], ['/user/calendar', 'Calendar', CalendarDays]]],
  ['Intelligence', [['/user/transcripts', 'Transcripts', FileText], ['/user/analysis', 'Meeting Analysis', Sparkles], ['/user/action-items', 'Action Items', CheckSquare], ['/user/follow-ups', 'Follow-ups & Questions', HelpCircle]]],
  ['Workspace', [['/user/profile', 'My Profile', Users], ['/user/trello', 'Trello Board', Trello], ['/user/settings', 'Settings', Plug]]],
]

export default function Sidebar({ open, onClose }) {
  return (<>
    {open && <div className="scrim" onClick={onClose} />}
    <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Primary">
      <div className="brand"><Logo /></div>
      {groups.map(([label, items]) => (
        <nav key={label}><h4>{label}</h4>
          {items.map(([to, text, Icon, badge]) => (
            <NavLink key={to} to={to} end={to === '/user/dashboard'} onClick={onClose} className="navlink">
              <Icon size={18} /><span>{text}</span>{badge && <em className="badge">{badge}</em>}
            </NavLink>))}
        </nav>))}
    </aside></>)
}

