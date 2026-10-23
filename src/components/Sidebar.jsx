import { NavLink } from 'react-router-dom'
import { Home, Video, CalendarDays, FileText, Sparkles, CheckSquare, Users, FolderOpen, BarChart3, Plug } from 'lucide-react'
import Logo from './Logo.jsx'
const groups = [
  ['Overview', [['/', 'Dashboard', Home], ['/meetings', 'My Meetings', Video, 3], ['/calendar', 'Calendar', CalendarDays]]],
  ['Intelligence', [['/transcripts', 'Transcripts', FileText], ['/summaries', 'AI Summaries', Sparkles], ['/actions', 'Action Items', CheckSquare, 5]]],
  ['Workspace', [['/team', 'Team', Users], ['/projects', 'Projects', FolderOpen], ['/analytics', 'Analytics', BarChart3], ['/integrations', 'Integrations', Plug]]],
]
export default function Sidebar({ open, onClose }) {
  return (<>
    {open && <div className="scrim" onClick={onClose} />}
    <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Primary">
      <div className="brand"><Logo /></div>
      {groups.map(([label, items]) => (
        <nav key={label}><h4>{label}</h4>
          {items.map(([to, text, Icon, badge]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className="navlink">
              <Icon size={18} /><span>{text}</span>{badge && <em className="badge">{badge}</em>}
            </NavLink>))}
        </nav>))}
    </aside></>)
}
