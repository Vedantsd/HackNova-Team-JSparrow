import { useState, useEffect } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { Video, Plus, Loader2 } from 'lucide-react'
import MeetingCard from '../components/MeetingCard.jsx'
import { api } from '../services/api.js'

export default function Meetings() {
  const { query = '' } = useOutletContext() || {}
  const nav = useNavigate()
  const [f, setF] = useState('all')
  const [meetingsList, setMeetingsList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const loadMeetings = async () => {
      setLoading(true)
      try {
        const live = await api.listMeetings()
        if (mounted && Array.isArray(live)) {
          setMeetingsList(live)
        }
      } catch (err) {
        console.error('Failed to load meetings:', err)
        if (mounted) setMeetingsList([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadMeetings()
    return () => { mounted = false }
  }, [])

  const list = meetingsList.filter(m => (f === 'all' || m.status === f) && (m.title || '').toLowerCase().includes((query || '').toLowerCase()))

  return (
    <section className="panel">
      <div className="phead">
        <h2>My Meetings</h2>
        <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'live', 'done'].map(x => (
            <button key={x} className={'chip' + (f === x ? ' on' : '')} onClick={() => setF(x)}>
              {x === 'done' ? 'completed' : x}
            </button>
          ))}
          <button className="btn primary sm" onClick={() => nav('/meetings/new/live')}>
            <Plus size={14} /> New Instant Call
          </button>
        </div>
      </div>
      <div className="pbody">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 8px' }} />
            <p className="muted">Loading meetings...</p>
          </div>
        ) : list.length ? (
          list.map(m => <MeetingCard key={m.id} m={m} />)
        ) : (
          <div className="mcard col" style={{ textAlign: 'center', padding: '36px 16px' }}>
            <Video size={36} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
            <b>No meetings found</b>
            <p className="muted sm" style={{ maxWidth: '400px', margin: '4px auto 12px' }}>
              {query || f !== 'all'
                ? 'No meetings match your active search or filter.'
                : 'You do not have any meetings scheduled or recorded yet.'}
            </p>
            <div>
              <button className="btn primary sm" onClick={() => nav('/meetings/new/live')}>
                <Plus size={14} /> Start Instant Meeting
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

