import { Video, CalendarDays, Users, Clock, FileText, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
export default function MeetingCard({ m }) {
  const nav = useNavigate()
  if (m.status === 'live') return (
    <div className="mcard live">
      <span className="livepill">● LIVE</span>
      <div className="grow"><b>{m.title}</b><div className="muted sm">{m.when} • {m.people} participants • {m.duration}</div></div>
      <button className="btn danger sm" onClick={() => nav(`/meetings/${m.id}/live`)}><Video size={14} />Join Now</button>
    </div>)
  return (
    <div className="mcard">
      <span className="micon" style={{ background: m.color }}><Video size={18} /></span>
      <div className="grow"><b>{m.title}</b>
        <div className="muted sm meta"><span><CalendarDays size={13} />{m.when}</span><span><Users size={13} />{m.people} attendees</span><span><Clock size={13} />{m.duration}</span></div></div>
      <button className="icon-btn sq" aria-label="Transcript" onClick={() => nav('/transcripts')}><FileText size={15} /></button>
      <button className="icon-btn sq" aria-label="AI summary" onClick={() => nav('/summaries')}><Sparkles size={15} /></button>
    </div>)
}
