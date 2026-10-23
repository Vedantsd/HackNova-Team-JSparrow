import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
// entries = [{who,t,text,hl?,notes?}] — feed real transcription segments here later.
export default function TranscriptPanel({ entries }) {
  const [menu, setMenu] = useState(false)
  return (<aside className="tpanel" aria-label="Transcript">
    <div className="between"><h3>Transcript</h3>
      <div className="rel"><button className="icon-btn" aria-label="Transcript menu" onClick={() => setMenu(m => !m)}><MoreHorizontal size={18} /></button>
        {menu && <div className="dropdown"><button onClick={() => { navigator.clipboard?.writeText(entries.map(e => `${e.who}: ${e.text}`).join('\n')); setMenu(false) }}>Copy transcript</button></div>}</div></div>
    <p className="tag">Sample transcript, not live transcription</p>
    <div className="tscroll" tabIndex={0}>{entries.map(e => {
      const i = e.hl ? e.text.indexOf(e.hl) : -1
      return (<div key={e.who + e.t} className="tentry">
        <p><b>{e.who}</b> <span className="muted sm">{e.t}</span>: {i < 0 ? e.text : <>{e.text.slice(0, i)}<mark>{e.hl}</mark>{e.text.slice(i + e.hl.length)}</>}</p>
        {e.notes && <span className="chip on">{e.notes} note</span>}</div>)})}</div>
  </aside>)
}
