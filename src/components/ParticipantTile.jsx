import { MicOff, Mic, AudioLines, VideoOff, Hand } from 'lucide-react'
import { VideoTrack } from '@livekit/components-react'
import { Track } from 'livekit-client'

export default function ParticipantTile({ 
  participant, 
  p, 
  camOverride, 
  handOverride, 
  videoRef 
}) {
  // If LiveKit participant is provided
  if (participant) {
    const isSpeaking = participant.isSpeaking
    const isMicOn = participant.isMicrophoneEnabled
    const isCamOn = camOverride ?? participant.isCameraEnabled
    const isHandRaised = handOverride ?? false
    const displayName = participant.name || participant.identity || 'Participant'
    const isLocal = participant.isLocal
    const camPub = participant.getTrackPublication(Track.Source.Camera)
    const hasActiveTrack = camPub && !camPub.isMuted && camPub.track

    const initials = displayName
      ? displayName.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
      : 'U'

    return (
      <div className={'tile' + (isSpeaking ? ' speaking' : '')}>
        <div className="vid">
          {isCamOn && hasActiveTrack ? (
            <VideoTrack
              trackRef={{
                participant,
                source: Track.Source.Camera,
                publication: camPub
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="camoff">
              <span className="avatar xl">{initials}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginTop: '8px' }}>
                <VideoOff size={16} /> Camera off
              </span>
            </div>
          )}
        </div>

        {/* Raised Hand Badge */}
        {isHandRaised && (
          <span className="hand-badge" title={`${displayName} raised their hand`}>
            <Hand size={14} /> Hand Raised
          </span>
        )}

        {isSpeaking && <span className="wave"><AudioLines size={16} /></span>}
        <span className="nametag">{isLocal ? `${displayName} (You)` : displayName}</span>
        <span className="mic" aria-label={isMicOn ? 'Mic on' : 'Muted'}>
          {isMicOn ? <Mic size={14} color="#10b981" /> : <MicOff size={14} color="var(--color-danger)" />}
        </span>
      </div>
    )
  }

  // Fallback for non-LiveKit participant object `p`
  const cam = camOverride ?? p?.cam
  const hand = handOverride ?? p?.hand
  const displayName = p?.name || 'Participant'
  const initials = displayName.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'U'

  return (
    <div className={'tile' + (p?.speaking ? ' speaking' : '')}>
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
            <span className="avatar xl">{initials}</span>
          )
        ) : (
          <span className="camoff"><VideoOff size={26} />Camera off</span>
        )}
      </div>

      {hand && (
        <span className="hand-badge" title={`${displayName} raised their hand`}>
          <Hand size={14} /> Hand Raised
        </span>
      )}

      {p?.speaking && <span className="wave"><AudioLines size={16} /></span>}
      <span className="nametag">{displayName}</span>
      <span className="mic" aria-label={p?.muted ? 'Muted' : 'Mic on'}>
        {p?.muted ? <MicOff size={14} color="var(--color-danger)" /> : <Mic size={14} color="#10b981" />}
      </span>
    </div>
  )
}
