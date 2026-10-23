import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import MeetingCard from '../components/MeetingCard.jsx'
import { meetings as demoMeetings } from '../data/demo.js'
import { api } from '../services/api.js'

export default function Meetings() {
  const { query } = useOutletContext()
  const [f, setF] = useState('all')
  const [meetingsList, setMeetingsList] = useState(demoMeetings)

  useEffect(() => {
    let mounted = true
    const loadMeetings = async () => {
      try {
        const live = await api.listMeetings()
        if (mounted && Array.isArray(live) && live.length > 0) {
          const liveIds = new Set(live.map(m => m.id))
          const merged = [...live, ...demoMeetings.filter(d => !liveIds.has(d.id))]
          setMeetingsList(merged)
        }
      } catch (err) {
        // Fallback to demo
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
        <div className="row">
          {['all', 'live', 'done'].map(x => (
            <button key={x} className={'chip' + (f === x ? ' on' : '')} onClick={() => setF(x)}>
              {x === 'done' ? 'completed' : x}
            </button>
          ))}
        </div>
      </div>
      <div className="pbody">
        {list.length ? list.map(m => <MeetingCard key={m.id} m={m} />) : <p className="muted">No meetings found.</p>}
      </div>
    </section>
  )
}
