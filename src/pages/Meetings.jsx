import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import MeetingCard from '../components/MeetingCard.jsx'
import { meetings } from '../data/demo.js'
export default function Meetings() {
  const { query } = useOutletContext()
  const [f, setF] = useState('all')
  const list = meetings.filter(m => (f === 'all' || m.status === f) && m.title.toLowerCase().includes(query.toLowerCase()))
  return (<section className="panel">
    <div className="phead"><h2>My Meetings</h2>
      <div className="row">{['all', 'live', 'done'].map(x => <button key={x} className={'chip' + (f === x ? ' on' : '')} onClick={() => setF(x)}>{x === 'done' ? 'completed' : x}</button>)}</div></div>
    <div className="pbody">{list.length ? list.map(m => <MeetingCard key={m.id} m={m} />) : <p className="muted">No meetings found.</p>}</div>
  </section>)
}
