import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { 
  Circle, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  PhoneOff, 
  MessageSquare, 
  MoreHorizontal, 
  Hand, 
  Captions, 
  Info, 
  Copy, 
  Users, 
  Sun, 
  Moon, 
  Check, 
  Send, 
  X, 
  ExternalLink, 
  Maximize2, 
  Settings, 
  FileText, 
  CheckSquare,
  Radio
} from 'lucide-react'
import Logo from '../components/Logo.jsx'
import Modal from '../components/Modal.jsx'
import ParticipantTile from '../components/ParticipantTile.jsx'
import TranscriptPanel from '../components/TranscriptPanel.jsx'
import { participants, liveTranscript } from '../data/demo.js'
import { useTheme } from '../theme.jsx'

function Ctl({ active, on, Icon, Off, label, danger, pressed, alertBadge }) {
  const isOff = active === false && Off
  return (
    <button 
      className={'ctl' + (danger ? ' danger' : '') + (pressed ? ' active' : '') + (isOff ? ' off' : '')} 
      title={label} 
      aria-label={label}
      aria-pressed={pressed} 
      onClick={on}
    >
      <span style={{ position: 'relative' }}>
        {isOff ? <Off size={18} /> : <Icon size={18} />}
        {alertBadge && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: '10px',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700
          }}>
            {alertBadge}
          </span>
        )}
      </span>
      {label}
    </button>
  )
}

export default function LiveMeeting() {
  const { meetingId } = useParams()
  const nav = useNavigate()
  const { theme, setTheme } = useTheme()

  // Initial state: Mute and Camera are initially CLOSED (false)
  const [s, setS] = useState({
    rec: false,
    mic: false,   // initially muted / closed
    cam: false,   // initially video stopped / closed
    share: false,
    hand: false,
    cc: true,
    chat: false
  })

  const [activeSideTab, setActiveSideTab] = useState('transcript') // 'transcript' | 'chat'
  const [leave, setLeave] = useState(false)
  const [moreModal, setMoreModal] = useState(false)
  const [detail, setDetail] = useState(false)
  const [copied, setCopied] = useState(false)
  const [handToast, setHandToast] = useState(false)

  // In-Meeting Chat Messages State
  const [chatMessages, setChatMessages] = useState([
    { id: 1, who: 'Sarah Franci', time: '10:16 AM', text: "Morning everyone! The interactive prototypes are ready for user testing." },
    { id: 2, who: 'John Bergson', time: '10:17 AM', text: "Great update Sarah. Let's make sure engineering has the schema specs." }
  ])
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef(null)

  // Local media stream refs
  const userVideoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const screenVideoRef = useRef(null)
  const screenStreamRef = useRef(null)

  const link = `${window.location.origin}/meetings/${meetingId}/live`

  const copy = () => {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Camera handling
  const startCamera = async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        cameraStreamRef.current = stream
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream
        }
      }
    } catch (e) {
      console.log('Webcam not directly accessible; fallback to tile presentation mode.', e)
    }
  }

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
    }
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null
    }
  }

  const toggleCam = () => {
    const next = !s.cam
    setS(o => ({ ...o, cam: next }))
    if (next) {
      startCamera()
    } else {
      stopCamera()
    }
  }

  // Mic handling
  const toggleMic = () => {
    setS(o => ({ ...o, mic: !o.mic }))
  }

  // Raise / Lower Hand handling
  const toggleHand = () => {
    const nextHand = !s.hand
    setS(o => ({ ...o, hand: nextHand }))
    setHandToast(nextHand ? 'You raised your hand' : 'You lowered your hand')
    setTimeout(() => setHandToast(false), 2500)
  }

  // Screen Share handling
  const startScreenShare = async () => {
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = stream
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream
        }
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare()
        }
        setS(o => ({ ...o, share: true }))
      } else {
        setS(o => ({ ...o, share: true }))
      }
    } catch {
      // Permission denied or cancelled; toggle simulated screen share presentation
      setS(o => ({ ...o, share: true }))
    }
  }

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
    }
    setS(o => ({ ...o, share: false }))
  }

  const toggleShare = () => {
    if (s.share) stopScreenShare()
    else startScreenShare()
  }

  // Chat handling
  const toggleChat = () => {
    setS(o => {
      const nextChat = !o.chat
      if (nextChat) setActiveSideTab('chat')
      return { ...o, chat: nextChat }
    })
  }

  const handleSendChat = e => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setChatMessages(prev => [
      ...prev,
      { id: Date.now(), who: 'You', time: now, text: chatInput.trim() }
    ])
    setChatInput('')
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // Cleanup media streams on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      stopScreenShare()
    }
  }, [])

  const hasSidePanel = s.cc || s.chat

  return (
    <div className="room">
      {/* Header Bar */}
      <header className="rhead">
        <Logo />
        <div className="rtitle">
          <b>Daily Standup Meeting</b>
          <span className="muted sm">Nov 02, 2023 · 10:15</span>
        </div>
        <span className="pill hide-sm">Hosted by John Bergson</span>
        <span className="pill hide-sm">
          <Users size={14} /> 4 Participants
        </span>
        <button className="pill" onClick={copy} aria-label="Copy meeting link">
          /meetings/{meetingId} {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button 
          className="icon-btn" 
          aria-label="Toggle theme" 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      {/* Main Body */}
      <div className={`rbody ${hasSidePanel ? '' : 'full'}`}>
        <div className="vgrid">
          {/* Active Screen Share Hero View if sharing is active */}
          {s.share && (
            <div className="screen-share-hero">
              <span className="screen-share-badge">
                <Radio size={14} className="spin-icon" /> Screen Share: You are presenting
              </span>
              <video 
                ref={screenVideoRef} 
                autoPlay 
                playsInline 
                className="screen-share-video" 
              />
            </div>
          )}

          {/* Participant Tiles */}
          {participants.map(p => (
            <ParticipantTile 
              key={p.id} 
              p={p.name === 'You' ? { ...p, muted: !s.mic } : p} 
              camOverride={p.name === 'You' ? s.cam : undefined} 
              handOverride={p.name === 'You' ? s.hand : undefined}
              videoRef={p.name === 'You' ? userVideoRef : undefined}
            />
          ))}
        </div>

        {/* Right Side Panel: Transcript or In-Meeting Chat */}
        {hasSidePanel && (
          <aside className="tpanel" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Tabs if both are enabled */}
            {s.cc && s.chat ? (
              <div className="row" style={{ gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <button 
                  className={'chip' + (activeSideTab === 'transcript' ? ' on' : '')} 
                  onClick={() => setActiveSideTab('transcript')}
                >
                  <Captions size={14} /> Transcript
                </button>
                <button 
                  className={'chip' + (activeSideTab === 'chat' ? ' on' : '')} 
                  onClick={() => setActiveSideTab('chat')}
                >
                  <MessageSquare size={14} /> In-Meeting Chat ({chatMessages.length})
                </button>
              </div>
            ) : null}

            {/* Transcript View */}
            {(activeSideTab === 'transcript' || !s.chat) && s.cc && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="between">
                  <h3>Live Transcript</h3>
                  <button className="icon-btn" aria-label="Close Captions" onClick={() => setS(o => ({ ...o, cc: false }))}>
                    <X size={15} />
                  </button>
                </div>
                <p className="tag" style={{ margin: '8px 0' }}>AI Live Transcription Stream</p>
                <div className="tscroll" tabIndex={0}>
                  {liveTranscript.map(e => (
                    <div key={e.who + e.t} className="tentry">
                      <p>
                        <b>{e.who}</b> <span className="muted sm">{e.t}</span>: {e.text}
                      </p>
                      {e.notes && <span className="chip on">{e.notes} note</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In-Meeting Chat View */}
            {(activeSideTab === 'chat' || !s.cc) && s.chat && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="between chat-header">
                  <h3>In-Meeting Chat</h3>
                  <button className="icon-btn" aria-label="Close Chat" onClick={() => setS(o => ({ ...o, chat: false }))}>
                    <X size={15} />
                  </button>
                </div>

                <div className="chat-messages">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`chat-msg ${msg.who === 'You' ? 'you' : ''}`}>
                      <div className="chat-msg-header">
                        <b>{msg.who}</b> <span>{msg.time}</span>
                      </div>
                      <div className="chat-bubble">
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSendChat} className="chat-form">
                  <input 
                    className="chat-input"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Send a message to everyone..."
                    aria-label="Chat input"
                  />
                  <button type="submit" className="btn primary sm" aria-label="Send message">
                    <Send size={14} />
                  </button>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <footer className="rbar">
        <div className="grp">
          <Ctl 
            pressed={s.rec} 
            on={() => setS(o => ({ ...o, rec: !o.rec }))} 
            Icon={Circle} 
            label={s.rec ? 'Recording' : 'Record'} 
            danger={s.rec}
          />
        </div>

        <div className="grp">
          {/* Mute / Unmute Button: starts audio when clicked */}
          <Ctl 
            active={s.mic} 
            on={toggleMic} 
            Icon={Mic} 
            Off={MicOff} 
            label={s.mic ? 'Mute' : 'Unmute'} 
          />

          {/* Video Button: starts camera when clicked */}
          <Ctl 
            active={s.cam} 
            on={toggleCam} 
            Icon={Video} 
            Off={VideoOff} 
            label={s.cam ? 'Stop video' : 'Start video'} 
          />

          {/* Screen Share Button */}
          <Ctl 
            pressed={s.share} 
            on={toggleShare} 
            Icon={MonitorUp} 
            label={s.share ? 'Stop share' : 'Share'} 
          />

          {/* Leave Button */}
          <Ctl 
            danger 
            on={() => setLeave(true)} 
            Icon={PhoneOff} 
            label="Leave" 
          />

          {/* In-Meeting Chat Button */}
          <Ctl 
            pressed={s.chat} 
            on={toggleChat} 
            Icon={MessageSquare} 
            label="Chat" 
          />

          {/* More Options Button */}
          <Ctl 
            on={() => setMoreModal(true)} 
            Icon={MoreHorizontal} 
            label="More" 
          />
        </div>

        <div className="grp">
          {/* Raise Hand Button */}
          <Ctl 
            pressed={s.hand} 
            on={toggleHand} 
            Icon={Hand} 
            label={s.hand ? 'Lower hand' : 'Raise hand'} 
          />

          {/* Captions Button */}
          <Ctl 
            pressed={s.cc} 
            on={() => setS(o => ({ ...o, cc: !o.cc }))} 
            Icon={Captions} 
            label="Captions" 
          />

          {/* Details Button */}
          <Ctl 
            on={() => setDetail(true)} 
            Icon={Info} 
            label="Detail" 
          />
        </div>
      </footer>

      {/* Hand notification feedback */}
      {handToast && (
        <div style={{
          position: 'fixed',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.88)',
          color: '#facc15',
          border: '1px solid rgba(250, 204, 21, 0.4)',
          borderRadius: '99px',
          padding: '8px 20px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 100
        }}>
          <Hand size={15} /> {handToast}
        </div>
      )}

      {/* Leave Meeting Modal */}
      {leave && (
        <Modal title="Leave meeting?" onClose={() => setLeave(false)}>
          <p className="muted">Are you sure you want to exit? You will return to the meetings dashboard.</p>
          <div className="row" style={{ marginTop: '16px' }}>
            <button className="btn" onClick={() => setLeave(false)}>Stay</button>
            <button 
              className="btn danger" 
              onClick={() => {
                stopCamera()
                stopScreenShare()
                nav('/meetings')
              }}
            >
              Leave Meeting
            </button>
          </div>
        </Modal>
      )}

      {/* More Options Modal */}
      {moreModal && (
        <Modal title="Meeting Controls & Options" onClose={() => setMoreModal(false)}>
          <div className="stack" style={{ gap: '14px' }}>
            <p className="muted sm">Quick actions and tools connected to CommitFlow execution pipeline.</p>

            <div className="row" style={{ gap: '10px' }}>
              <button className="btn sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Link Copied' : 'Copy Meeting Link'}
              </button>
              <button 
                className="btn sm" 
                onClick={() => {
                  if (!document.fullscreenElement) document.documentElement.requestFullscreen()
                  else document.exitFullscreen()
                  setMoreModal(false)
                }}
              >
                <Maximize2 size={14} /> Toggle Fullscreen
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />

            <div>
              <b style={{ fontSize: '13px' }}>Backend & Automation Tools:</b>
              <div className="row" style={{ gap: '10px', marginTop: '8px' }}>
                <button 
                  className="btn sm" 
                  onClick={() => {
                    setMoreModal(false)
                    nav('/transcripts')
                  }}
                >
                  <FileText size={14} /> Transcripts & AI Summaries
                </button>
                <button 
                  className="btn sm" 
                  onClick={() => {
                    setMoreModal(false)
                    nav('/actions')
                  }}
                >
                  <CheckSquare size={14} /> Review Action Items
                </button>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />

            <div>
              <b style={{ fontSize: '13px' }}>Audio & Video Devices:</b>
              <div className="stack" style={{ gap: '8px', marginTop: '8px' }}>
                <div className="between sm">
                  <span className="muted">Microphone:</span>
                  <span>Default - High Definition Audio</span>
                </div>
                <div className="between sm">
                  <span className="muted">Camera:</span>
                  <span>Integrated HD Web Camera</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Details Modal */}
      {detail && (
        <Modal title="Meeting details" onClose={() => setDetail(false)}>
          <p><b>Daily Standup Meeting</b></p>
          <p className="muted sm">{link}</p>
          <div className="tag" style={{ marginTop: '10px' }}>
            Neon PostgreSQL & Google Gemini AI backend active
          </div>
          <p className="muted sm" style={{ marginTop: '8px' }}>
            Meeting transcripts, summaries, decisions, and action items are automatically synchronized and ready for human review.
          </p>
        </Modal>
      )}
    </div>
  )
}
