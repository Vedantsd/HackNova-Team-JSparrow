import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, FileText, Lightbulb, BarChart3 } from 'lucide-react'
import MeetingCard from '../components/MeetingCard.jsx'
import { meetings, upcoming, transcript, insights } from '../data/demo.js'
const hl = t => t.split(/(\{[^}]+\})/).map((p, i) => p.startsWith('{') ? <mark key={i}>{p.slice(1, -1)}</mark> : p)
const ini = n => n.split(' ').map(x => x[0]).join('')
export default function Dashboard() {
  const { query } = useOutletContext(), q = query.toLowerCase()
  const list = meetings.filter(m => m.title.toLowerCase().includes(q))
  return (
    <div className="grid2">
      <section className="panel">
        <div className="phead"><h2>Recent Meetings</h2><Link to="/meetings" className="link">View All <ArrowRight size={12} /></Link></div>
        <div className="pbody">
          {list.length ? list.map(m => <MeetingCard key={m.id} m={m} />) : <p className="muted">No meetings match “{query}”.</p>}
          <div className="mcard col">
            <div className="between"><b className="row"><FileText size={14} />Live Transcript</b><span className="tag">Sample data</span></div>
            {transcript.map(s => (
              <div className="line" key={s.who}><span className="avatar">{ini(s.who)}</span>
                <div><b className="sm">{s.who}</b><p>{hl(s.text)}</p></div></div>))}
          </div>
        </div>
      </section>
      <div className="stack">
        <section className="panel">
          <div className="phead"><h2>Upcoming Today</h2><Link to="/calendar" className="link">Calendar <ArrowRight size={12} /></Link></div>
          <div className="pbody">
            {upcoming.map(u => (
              <div className="mcard" key={u.id}>
                <div className="time"><b>{u.time}</b><span>{u.ap}</span></div>
                <div><b className="sm">{u.title}</b>
                  <div className="avs">{u.people.map(p => <span key={p} className="avatar sm">{p}</span>)}</div></div>
              </div>))}
          </div>
        </section>
        <section className="panel">
          <div className="phead"><h2>AI Insights</h2><span className="tag">Demo</span></div>
          <div className="pbody">
            {insights.map((i, k) => (
              <div className="mcard" key={i.title}>
                <span className="micon soft">{k ? <BarChart3 size={18} /> : <Lightbulb size={18} />}</span>
                <div><b className="sm">{i.title}</b><p className="muted sm">{i.body}</p></div></div>))}
          </div>
        </section>
      </div>
    </div>)
}
