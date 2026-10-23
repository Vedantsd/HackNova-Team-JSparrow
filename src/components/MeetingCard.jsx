import { Video, CalendarDays, Users, Clock, FileText, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function MeetingCard({ m }) {
  const nav = useNavigate()
  const participantCount = m.people ?? m.participantCount ?? 0
  const timeLabel = m.when || m.createdAt || 'Recent'
  const durationLabel = m.duration || (m.status === 'live' ? 'Live Room' : 'Recorded')

  if (m.status === 'live') {
    return (
      <div className="mcard live">
        <span className="livepill">● LIVE</span>
        <div className="grow">
          <b>{m.title}</b>
          <div className="muted sm">
            {timeLabel} • {participantCount} {participantCount === 1 ? 'participant' : 'participants'} • {durationLabel}
          </div>
        </div>
        <button className="btn danger sm" onClick={() => nav(`/meetings/${m.id}/live`)}>
          <Video size={14} />Join Now
        </button>
      </div>
    )
  }

  return (
    <div className="mcard">
      <span className="micon" style={{ background: m.color || 'var(--color-primary)' }}>
        <Video size={18} />
      </span>
      <div className="grow">
        <b>{m.title}</b>
        <div className="muted sm meta">
          <span><CalendarDays size={13} />{timeLabel}</span>
          <span><Users size={13} />{participantCount} attendees</span>
          <span><Clock size={13} />{durationLabel}</span>
        </div>
      </div>
      <button className="icon-btn sq" aria-label="Join Room" title="Join Room" onClick={() => nav(`/meetings/${m.id}/live`)}>
        <Video size={15} />
      </button>
      <button className="icon-btn sq" aria-label="Transcript" title="Transcript" onClick={() => nav('/transcripts')}>
        <FileText size={15} />
      </button>
      <button className="icon-btn sq" aria-label="AI summary" title="AI Summary" onClick={() => nav('/summaries')}>
        <Sparkles size={15} />
      </button>
    </div>
  )
}
