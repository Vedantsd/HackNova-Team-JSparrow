import { MicOff, Mic, AudioLines, VideoOff } from 'lucide-react'
// Placeholder tile. Replace the .vid contents with a <video> track from your SDK later.
export default function ParticipantTile({ p, camOverride }) {
  const cam = camOverride ?? p.cam
  return (<div className={'tile' + (p.speaking ? ' speaking' : '')}>
    <div className="vid">{cam ? <span className="avatar xl">{p.name.split(' ').map(x => x[0]).join('')}</span>
      : <span className="camoff"><VideoOff size={26} />Camera off</span>}</div>
    {p.speaking && <span className="wave"><AudioLines size={16} /></span>}
    <span className="nametag">{p.name}</span>
    <span className="mic" aria-label={p.muted ? 'Muted' : 'Mic on'}>{p.muted ? <MicOff size={14} /> : <Mic size={14} />}</span>
  </div>)
}
