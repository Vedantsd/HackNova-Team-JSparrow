import { MicOff, Mic, AudioLines, VideoOff, Hand } from 'lucide-react'

export default function ParticipantTile({ p, camOverride, handOverride, videoRef }) {
  const cam = camOverride ?? p.cam
  const hand = handOverride ?? p.hand

  return (
    <div className={'tile' + (p.speaking ? ' speaking' : '')}>
      <div className="vid">
        {cam ? (
          videoRef ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <span className="avatar xl">{p.name.split(' ').map(x => x[0]).join('')}</span>
          )
        ) : (
          <span className="camoff"><VideoOff size={26} />Camera off</span>
        )}
      </div>

      {/* Raised Hand Badge */}
      {hand && (
        <span className="hand-badge" title={`${p.name} raised their hand`}>
          <Hand size={14} /> Hand Raised
        </span>
      )}

      {p.speaking && <span className="wave"><AudioLines size={16} /></span>}
      <span className="nametag">{p.name}</span>
      <span className="mic" aria-label={p.muted ? 'Muted' : 'Mic on'}>
        {p.muted ? <MicOff size={14} color="var(--color-danger)" /> : <Mic size={14} color="#10b981" />}
      </span>
    </div>
  )
}
