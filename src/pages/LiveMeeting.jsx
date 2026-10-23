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
  Maximize2, 
  FileText, 
  CheckSquare,
  Radio,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Download,
  CheckCircle2,
  Sparkles,
  Volume2
} from 'lucide-react'
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  VideoTrack, 
  useParticipants, 
  useLocalParticipant, 
  useConnectionState, 
  useTracks, 
  useRoomContext 
} from '@livekit/components-react'
import { RoomEvent, Track, ConnectionState } from 'livekit-client'
import Logo from '../components/Logo.jsx'
import Modal from '../components/Modal.jsx'
import ParticipantTile from '../components/ParticipantTile.jsx'
import { useTheme } from '../theme.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../services/api.js'
import { generateMeetingPDF } from '../services/pdfGenerator.js'
import { generateStructuredAnalysis, transcriptStore } from '../services/transcriptStore.js'

const SPEAKER_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#db2777'  // Pink
]

function getSpeakerColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length]
}

function getSpeakerInitials(name = '') {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SIMULATED_DIALOGUES = [
  { speaker: 'Sarah Nguyen', badge: 'Product Lead', text: "I reviewed our sprint velocity. We are on track to ship the authentication and transcript sync by Friday." },
  { speaker: 'Alex Rivera', badge: 'Lead Architect', text: "Great. Let's make sure the PostgreSQL connection pool handles the spike during peak hours." },
  { speaker: 'David Chen', badge: 'DevOps', text: "The AWS Kubernetes node auto-scaler has been configured to scale up within 20 seconds." },
  { speaker: 'Maria Kim', badge: 'Design', text: "The new UI components for live transcripts and PDF export have passed usability review." },
  { speaker: 'Elena Rostova', badge: 'DBA', text: "I have scheduled the automated database backup verification for 2 AM tonight." }
]

function Ctl({ active, on, Icon, Off, label, danger, pressed, alertBadge, disabled }) {
  const isOff = active === false && Off
  return (
    <button 
      className={'ctl' + (danger ? ' danger' : '') + (pressed ? ' active' : '') + (isOff ? ' off' : '')} 
      title={label} 
      aria-label={label}
      aria-pressed={pressed} 
      onClick={on}
      disabled={disabled}
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

function LiveMeetingContent({ meetingId, meetingInfo, tokenData }) {
  const nav = useNavigate()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const room = useRoomContext()
  const connectionState = useConnectionState()
  const { 
    localParticipant, 
    isMicrophoneEnabled, 
    isCameraEnabled, 
    isScreenShareEnabled 
  } = useLocalParticipant()

  const participants = useParticipants()
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false })
  const activeScreenShare = screenTracks.find(t => t.publication && !t.publication.isMuted && t.publication.track)

  const [s, setS] = useState({
    rec: false,
    cc: true,
    chat: false
  })

  const [activeSideTab, setActiveSideTab] = useState('transcript') // 'transcript' | 'chat'
  const [leave, setLeave] = useState(false)
  const [moreModal, setMoreModal] = useState(false)
  const [detail, setDetail] = useState(false)
  const [copied, setCopied] = useState(false)
  const [handToast, setHandToast] = useState(false)
  const [deviceError, setDeviceError] = useState(null)
  const [raisedHands, setRaisedHands] = useState({})

  // Live Transcript conversational state
  const [transcriptEntries, setTranscriptEntries] = useState([
    {
      id: 'tx-live-1',
      speaker: 'Alex Rivera',
      badge: 'Lead Architect',
      time: '10:02 AM',
      text: "Welcome everyone. Today we are synchronizing on deployment targets, database migration, and SLA benchmarks.",
      isSelf: false
    },
    {
      id: 'tx-live-2',
      speaker: 'David Chen',
      badge: 'DevOps',
      time: '10:04 AM',
      text: "The staging tests passed with 99.8% uptime. I will prepare the AWS IAM security roles and permission boundary specifications.",
      isSelf: false
    },
    {
      id: 'tx-live-3',
      speaker: 'Elena Rostova',
      badge: 'DBA',
      time: '10:06 AM',
      text: "I verified multi-region replication lag; it's under 45ms. I'll prepare the database backup and failover runbook draft.",
      isSelf: false
    }
  ])
  const [interimTranscript, setInterimTranscript] = useState('')
  const [activeSpeaker, setActiveSpeaker] = useState(null)
  const [transcriptInput, setTranscriptInput] = useState('')
  const [transcriptCopied, setTranscriptCopied] = useState(false)
  const [simIdx, setSimIdx] = useState(0)
  const [endedReport, setEndedReport] = useState(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const transcriptBottomRef = useRef(null)
  const recognitionRef = useRef(null)

  // Real-time in-meeting chat
  const [chatMessages, setChatMessages] = useState([
    { id: 1, who: 'System', time: 'Now', text: `Welcome to ${meetingInfo?.title || 'Live Meeting'}. Real-time encrypted audio/video active.` }
  ])
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef(null)

  const link = `${window.location.origin}/meetings/${meetingId}/live`

  const copy = () => {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Handle data received from other participants (raised hand, in-meeting chat, live transcript)
  useEffect(() => {
    if (!room) return
    const handleData = (payload, participant) => {
      try {
        const decoded = new TextDecoder().decode(payload)
        const data = JSON.parse(decoded)
        if (data.type === 'hand') {
          const id = participant?.identity || data.sender
          setRaisedHands(prev => ({ ...prev, [id]: data.raised }))
          if (data.raised) {
            setHandToast(`${participant?.name || 'A participant'} raised their hand`)
            setTimeout(() => setHandToast(false), 3000)
          }
        } else if (data.type === 'chat') {
          setChatMessages(prev => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              who: participant?.name || data.senderName || 'Participant',
              time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              text: data.text
            }
          ])
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } else if (data.type === 'transcript') {
          if (data.entry) {
            setTranscriptEntries(prev => [...prev, { ...data.entry, isSelf: false }])
            setTimeout(() => transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        }
      } catch (err) {
        console.warn('LiveKit data decode error:', err)
      }
    }

    room.on(RoomEvent.DataReceived, handleData)
    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [room])

  // Continuous speech recognition via browser Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (!isMicrophoneEnabled) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        recognitionRef.current = null
      }
      setActiveSpeaker(null)
      setInterimTranscript('')
      return
    }

    let recognition
    try {
      recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i]
          if (res.isFinal) {
            const finalSpeech = res[0].transcript.trim()
            if (finalSpeech) {
              const myName = user?.name || localParticipant?.name || 'You'
              const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              const entry = {
                id: 'tx-' + Date.now() + Math.random(),
                speaker: myName,
                badge: 'You',
                time: nowTime,
                text: finalSpeech,
                isSelf: true
              }
              setTranscriptEntries(prev => [...prev, entry])
              setTimeout(() => transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

              // Broadcast through LiveKit data channel
              if (localParticipant) {
                try {
                  const payload = new TextEncoder().encode(JSON.stringify({
                    type: 'transcript',
                    entry
                  }))
                  localParticipant.publishData(payload, { reliable: true })
                } catch (e) {
                  console.warn('Transcript publish error:', e)
                }
              }
            }
          } else {
            interim += res[0].transcript
          }
        }
        setInterimTranscript(interim)
        if (interim) setActiveSpeaker(user?.name || localParticipant?.name || 'You')
        else setActiveSpeaker(null)
      }

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('Speech recognition warning:', e.error)
        }
      }

      recognition.onend = () => {
        if (isMicrophoneEnabled && recognitionRef.current) {
          try { recognition.start() } catch {}
        } else {
          setActiveSpeaker(null)
        }
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (err) {
      console.warn('SpeechRecognition initialization error:', err)
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        recognitionRef.current = null
      }
    }
  }, [isMicrophoneEnabled, user?.name, localParticipant])

  const handleAddLiveUtterance = (e) => {
    e?.preventDefault()
    if (!transcriptInput.trim()) return
    const text = transcriptInput.trim()
    setTranscriptInput('')
    const myName = user?.name || localParticipant?.name || 'You'
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const entry = {
      id: 'tx-' + Date.now(),
      speaker: myName,
      badge: 'You',
      time: nowTime,
      text,
      isSelf: true
    }
    setTranscriptEntries(prev => [...prev, entry])
    setTimeout(() => transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    if (localParticipant) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'transcript',
          entry
        }))
        localParticipant.publishData(payload, { reliable: true })
      } catch {}
    }
  }

  const handleSimulateSpeaker = () => {
    const item = SIMULATED_DIALOGUES[simIdx % SIMULATED_DIALOGUES.length]
    setSimIdx(i => i + 1)
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const entry = {
      id: 'tx-sim-' + Date.now(),
      speaker: item.speaker,
      badge: item.badge,
      time: nowTime,
      text: item.text,
      isSelf: false
    }
    setActiveSpeaker(item.speaker)
    setInterimTranscript(item.text.slice(0, 32) + '...')
    setTimeout(() => {
      setInterimTranscript('')
      setActiveSpeaker(null)
      setTranscriptEntries(prev => [...prev, entry])
      setTimeout(() => transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }, 600)
  }

  const buildReportData = () => {
    const title = meetingInfo?.title || 'Live Meeting Session'
    const fullText = transcriptEntries.map(e => `[${e.time}] ${e.speaker}: ${e.text}`).join('\n')
    const analysis = generateStructuredAnalysis(fullText, title)
    const speakersList = Array.from(new Set(transcriptEntries.map(e => e.speaker)))

    return {
      title,
      duration: `${Math.max(15, Math.round(transcriptEntries.length * 2.5))} min`,
      participants: speakersList.length > 0 ? speakersList : ['You', 'Alex Rivera', 'David Chen'],
      summary: analysis.summary,
      decisions: analysis.decisions,
      actionItems: analysis.actionItems,
      unresolvedQuestions: analysis.unresolvedQuestions,
      fullText
    }
  }

  const handleDownloadPDF = (customReport = null) => {
    const report = customReport || buildReportData()
    generateMeetingPDF({
      title: report.title,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      duration: report.duration,
      participants: report.participants,
      summary: report.summary,
      decisions: report.decisions,
      actionItems: report.actionItems,
      transcriptEntries: transcriptEntries,
      filename: `${report.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Transcript_Summary.pdf`
    })
  }

  const handleEndMeeting = async () => {
    setIsGeneratingReport(true)
    const report = buildReportData()
    try {
      const savedTx = transcriptStore.addTranscript({
        title: report.title,
        filename: `${report.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_transcript.txt`,
        fileSize: `${(report.fullText.length / 1024).toFixed(1)} KB`,
        fileType: 'TXT',
        text: report.fullText,
        optionalParticipants: report.participants.join(', ')
      })
      report.savedId = savedTx?.id
    } catch (e) {
      console.warn('Error saving ended meeting transcript:', e)
    }

    try {
      if (room) await room.disconnect()
    } catch {}

    setEndedReport(report)
    setIsGeneratingReport(false)
    setLeave(false)
  }

  // Camera toggle with graceful permission handling
  const toggleCam = async () => {
    try {
      setDeviceError(null)
      await localParticipant.setCameraEnabled(!isCameraEnabled)
    } catch (err) {
      console.warn('Camera toggle error:', err)
      setDeviceError('Camera permission denied or camera device is unavailable.')
      setTimeout(() => setDeviceError(null), 4000)
    }
  }

  // Microphone toggle with graceful permission handling
  const toggleMic = async () => {
    try {
      setDeviceError(null)
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch (err) {
      console.warn('Microphone toggle error:', err)
      setDeviceError('Microphone permission denied or microphone device is unavailable.')
      setTimeout(() => setDeviceError(null), 4000)
    }
  }

  // Screen share toggle
  const toggleShare = async () => {
    try {
      setDeviceError(null)
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    } catch (err) {
      console.warn('Screen share toggle error:', err)
    }
  }

  // Hand raise toggle
  const isMyHandRaised = Boolean(raisedHands[localParticipant?.identity])
  const toggleHand = async () => {
    const nextHand = !isMyHandRaised
    if (localParticipant) {
      setRaisedHands(prev => ({ ...prev, [localParticipant.identity]: nextHand }))
      setHandToast(nextHand ? 'You raised your hand' : 'You lowered your hand')
      setTimeout(() => setHandToast(false), 2500)
      try {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'hand',
          sender: localParticipant.identity,
          raised: nextHand
        }))
        await localParticipant.publishData(payload, { reliable: true })
      } catch (err) {
        console.warn('Hand publish error:', err)
      }
    }
  }

  // Chat toggle
  const toggleChat = () => {
    setS(o => {
      const nextChat = !o.chat
      if (nextChat) setActiveSideTab('chat')
      return { ...o, chat: nextChat }
    })
  }

  // Send in-meeting chat message
  const handleSendChat = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const text = chatInput.trim()
    setChatInput('')

    // Append to local state
    setChatMessages(prev => [
      ...prev,
      { id: Date.now(), who: 'You', time: now, text }
    ])
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    // Broadcast through LiveKit data channel
    if (localParticipant) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'chat',
          senderName: localParticipant.name || user?.name || 'You',
          time: now,
          text
        }))
        await localParticipant.publishData(payload, { reliable: true })
      } catch (err) {
        console.warn('LiveKit chat broadcast error:', err)
      }
    }
  }

  // Clean disconnection when leaving
  const handleLeave = async () => {
    try {
      if (room) await room.disconnect()
    } catch {}
    nav('/meetings')
  }

  const hasSidePanel = s.cc || s.chat

  return (
    <div className="room">
      {/* Device error banner */}
      {deviceError && (
        <div style={{
          position: 'fixed',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-danger)',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '10px 22px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
          zIndex: 100
        }}>
          <AlertTriangle size={16} /> {deviceError}
        </div>
      )}

      {/* Header Bar */}
      <header className="rhead">
        <Logo />
        <div className="rtitle">
          <b>{meetingInfo?.title || 'Live Meeting Room'}</b>
          <span className="muted sm">
            {meetingInfo?.createdAt || 'Real-Time Session'} · Room: {tokenData.roomName}
          </span>
        </div>

        {/* LiveKit Real-Time Connection Indicator */}
        <div className="pill hide-sm" title={`LiveKit Connection: ${connectionState}`}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: connectionState === ConnectionState.Connected ? '#10b981' : connectionState === ConnectionState.Connecting ? '#f59e0b' : '#ef4444',
            display: 'inline-block'
          }} />
          <span style={{ textTransform: 'capitalize' }}>
            {connectionState === ConnectionState.Connected ? 'LiveKit Connected' : connectionState}
          </span>
        </div>

        {meetingInfo?.hostName && (
          <span className="pill hide-sm">Hosted by {meetingInfo.hostName}</span>
        )}

        <span className="pill hide-sm">
          <Users size={14} /> {participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
        </span>

        <button className="pill" onClick={copy} aria-label="Copy meeting link" title="Click to copy invitation link">
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
          {/* Active Screen Share Hero View if any participant shares */}
          {activeScreenShare && (
            <div className="screen-share-hero" style={{ gridColumn: 'span 2' }}>
              <span className="screen-share-badge">
                <Radio size={14} className="spin-icon" /> 
                Screen Share: {activeScreenShare.participant.isLocal ? 'You are presenting' : `${activeScreenShare.participant.name || 'Participant'} is presenting`}
              </span>
              <VideoTrack 
                trackRef={activeScreenShare} 
                className="screen-share-video" 
              />
            </div>
          )}

          {/* Participant Tiles connected via LiveKit */}
          {participants.map(p => (
            <ParticipantTile 
              key={p.identity} 
              participant={p} 
              handOverride={Boolean(raisedHands[p.identity])}
            />
          ))}

          {/* If alone in the room */}
          {participants.length === 1 && (
            <div 
              className="tile" 
              style={{
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                padding: '24px',
                borderStyle: 'dashed'
              }}
            >
              <div style={{ maxWidth: '280px' }}>
                <Users size={32} style={{ color: 'var(--color-muted)', margin: '0 auto 10px' }} />
                <b style={{ display: 'block', marginBottom: '6px' }}>You are the first one here</b>
                <p className="muted sm" style={{ marginBottom: '14px' }}>
                  Share the meeting link to invite teammates to this live session.
                </p>
                <button className="btn sm" onClick={copy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Link Copied' : 'Copy Invitation Link'}
                </button>
              </div>
            </div>
          )}
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
                <div className="transcript-header">
                  <div className="row" style={{ gap: '8px' }}>
                    <Captions size={17} color="var(--color-primary)" />
                    <h3 style={{ margin: 0, fontSize: '15px' }}>Live Transcript</h3>
                  </div>
                  <div className="row" style={{ gap: '6px' }}>
                    <button 
                      className="icon-btn" 
                      title="Download transcript and summary as PDF" 
                      aria-label="Download PDF" 
                      onClick={() => handleDownloadPDF()}
                    >
                      <Download size={15} />
                    </button>
                    <button 
                      className="icon-btn" 
                      title={transcriptCopied ? 'Copied to clipboard' : 'Copy transcript'} 
                      aria-label="Copy transcript" 
                      onClick={() => {
                        const txt = transcriptEntries.map(e => `[${e.time}] ${e.speaker}: ${e.text}`).join('\n')
                        navigator.clipboard?.writeText(txt)
                        setTranscriptCopied(true)
                        setTimeout(() => setTranscriptCopied(false), 2000)
                      }}
                    >
                      {transcriptCopied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                    </button>
                    <button 
                      className="icon-btn" 
                      aria-label="Close Captions" 
                      onClick={() => setS(o => ({ ...o, cc: false }))}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Status Bar */}
                <div className={`transcript-status-bar ${isMicrophoneEnabled ? 'listening' : ''}`}>
                  <div className="row" style={{ gap: '6px' }}>
                    <span className="pulse-dot" style={{ background: isMicrophoneEnabled ? '#10b981' : '#94a3b8' }} />
                    <span style={{ fontWeight: 600 }}>
                      {isMicrophoneEnabled ? 'Live Voice Transcribing Active' : 'Microphone Muted'}
                    </span>
                  </div>
                  <button 
                    className="btn sm" 
                    style={{ padding: '2px 8px', fontSize: '11px', height: '22px' }} 
                    title="Simulate speech from teammate"
                    onClick={handleSimulateSpeaker}
                  >
                    + Simulate Team Voice
                  </button>
                </div>

                {/* Structured Dialogue Feed */}
                <div className="transcript-feed" tabIndex={0}>
                  {transcriptEntries.map(e => {
                    const color = getSpeakerColor(e.speaker)
                    const initials = getSpeakerInitials(e.speaker)
                    return (
                      <div key={e.id} className={`transcript-item ${e.isSelf ? 'self' : ''}`}>
                        <div className="transcript-avatar" style={{ backgroundColor: color }}>
                          {initials}
                        </div>
                        <div className="transcript-body">
                          <div className="transcript-meta">
                            <span className="transcript-speaker">{e.speaker}</span>
                            {e.badge && <span className="transcript-badge">{e.badge}</span>}
                            <span className="transcript-time">{e.time}</span>
                          </div>
                          <div className="transcript-bubble">
                            {e.text}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Active Speaker / Streaming Interim speech */}
                  {(interimTranscript || activeSpeaker) && (
                    <div className="transcript-interim-box">
                      <div className="transcript-avatar" style={{ backgroundColor: getSpeakerColor(activeSpeaker || 'Speaker') }}>
                        {getSpeakerInitials(activeSpeaker || 'Sp')}
                      </div>
                      <div className="transcript-body">
                        <div className="row" style={{ gap: '6px' }}>
                          <b style={{ fontSize: '12px' }}>{activeSpeaker || 'Speaker'}</b>
                          <div className="audio-waves">
                            <span className="wave-bar" />
                            <span className="wave-bar" />
                            <span className="wave-bar" />
                            <span className="wave-bar" />
                          </div>
                          <span className="muted sm" style={{ fontSize: '10.5px' }}>speaking now...</span>
                        </div>
                        <div className="transcript-interim-text">
                          {interimTranscript || 'Transcribing incoming audio...'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={transcriptBottomRef} />
                </div>

                {/* Quick Add / Speak Form */}
                <form onSubmit={handleAddLiveUtterance} className="transcript-input-form">
                  <input
                    className="transcript-quick-input"
                    value={transcriptInput}
                    onChange={e => setTranscriptInput(e.target.value)}
                    placeholder="Type dialogue or speak via mic..."
                    aria-label="Add dialogue to live transcript"
                  />
                  <button type="submit" className="btn primary sm" aria-label="Send transcript utterance">
                    <Send size={13} />
                  </button>
                </form>
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
            active={isMicrophoneEnabled} 
            on={toggleMic} 
            Icon={Mic} 
            Off={MicOff} 
            label={isMicrophoneEnabled ? 'Mute' : 'Unmute'} 
          />

          {/* Video Button: starts camera when clicked */}
          <Ctl 
            active={isCameraEnabled} 
            on={toggleCam} 
            Icon={Video} 
            Off={VideoOff} 
            label={isCameraEnabled ? 'Stop video' : 'Start video'} 
          />

          {/* Screen Share Button */}
          <Ctl 
            pressed={isScreenShareEnabled} 
            on={toggleShare} 
            Icon={MonitorUp} 
            label={isScreenShareEnabled ? 'Stop share' : 'Share'} 
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
            pressed={isMyHandRaised} 
            on={toggleHand} 
            Icon={Hand} 
            label={isMyHandRaised ? 'Lower hand' : 'Raise hand'} 
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

      {/* Leave / End Meeting Modal */}
      {leave && (
        <Modal title="Conclude or Exit Meeting?" onClose={() => setLeave(false)}>
          <p className="muted" style={{ lineHeight: 1.55 }}>
            Choose how you would like to conclude your session. Ending the meeting will automatically generate the overall AI summary, map action items and decisions, and provide a downloadable PDF report.
          </p>
          <div className="row" style={{ marginTop: '20px', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setLeave(false)}>Stay</button>
            <button 
              className="btn danger" 
              onClick={handleLeave}
              title="Leave room without generating report"
            >
              Leave Room
            </button>
            <button 
              className="btn primary" 
              onClick={handleEndMeeting}
              title="End meeting, synthesize AI summary, and download PDF"
            >
              <Sparkles size={14} /> End Meeting & Generate PDF Report
            </button>
          </div>
        </Modal>
      )}

      {/* Post-Meeting Summary & Download PDF Report Modal */}
      {endedReport && (
        <Modal 
          title="Meeting Concluded • Executive Summary & PDF" 
          onClose={() => nav('/meetings')}
          className="meeting-ended-modal"
        >
          <div className="report-hero-card">
            <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="row" style={{ gap: '8px', marginBottom: '6px' }}>
                  <span className="badge" style={{ background: '#10b981', color: '#fff' }}>
                    <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Session Concluded
                  </span>
                  <span className="muted sm">{endedReport.duration}</span>
                </div>
                <h2 style={{ fontSize: '18px', margin: '0 0 4px' }}>{endedReport.title}</h2>
                <p className="muted sm" style={{ margin: 0 }}>
                  Concluded on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* DOWNLOAD PDF ACTION */}
              <button 
                className="report-download-btn"
                onClick={() => handleDownloadPDF(endedReport)}
                title="Download complete meeting transcript and summary as PDF"
              >
                <Download size={16} /> Download Meeting Report (PDF)
              </button>
            </div>

            {/* Metrics */}
            <div className="report-metrics-grid">
              <div className="report-metric-tile">
                <span className="num">{endedReport.participants?.length || 0}</span>
                <span className="label">Participants</span>
              </div>
              <div className="report-metric-tile">
                <span className="num">{transcriptEntries.length}</span>
                <span className="label">Dialogue Turns</span>
              </div>
              <div className="report-metric-tile">
                <span className="num">{endedReport.decisions?.length || 0}</span>
                <span className="label">Decisions</span>
              </div>
              <div className="report-metric-tile">
                <span className="num">{endedReport.actionItems?.length || 0}</span>
                <span className="label">Action Items</span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Overview */}
          {endedReport.summary && (
            <div className="report-section">
              <div className="report-section-title">
                <Sparkles size={16} color="var(--color-primary)" />
                <span>Executive Summary & Key Discussion</span>
              </div>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6 }}>
                {endedReport.summary.overview}
              </p>
              {endedReport.summary.keyDiscussionPoints && endedReport.summary.keyDiscussionPoints.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '13px', lineHeight: 1.6 }}>
                  {endedReport.summary.keyDiscussionPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Section 2: Action Items */}
          {endedReport.actionItems && endedReport.actionItems.length > 0 && (
            <div className="report-section">
              <div className="report-section-title">
                <CheckSquare size={16} color="var(--color-primary)" />
                <span>Assigned Action Items ({endedReport.actionItems.length})</span>
              </div>
              <div className="stack" style={{ gap: '8px' }}>
                {endedReport.actionItems.map((act, i) => (
                  <div key={i} className="between sm" style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <div>
                      <b style={{ display: 'block', fontSize: '13px' }}>{act.title}</b>
                      <span className="muted sm">Assignee: {act.owner || 'Unassigned'} • Due: {act.deadline || 'Unspecified'}</span>
                    </div>
                    <span className="chip on" style={{ fontSize: '11px', flexShrink: 0 }}>{act.priority || 'Medium'} Priority</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Verbatim Transcript Preview */}
          <div className="report-section">
            <div className="between">
              <div className="report-section-title">
                <FileText size={16} color="var(--color-primary)" />
                <span>Recorded Meeting Transcript ({transcriptEntries.length} turns)</span>
              </div>
              <span className="tag">Mapped to PDF</span>
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {transcriptEntries.map(e => (
                <div key={e.id} style={{ fontSize: '12.5px', lineHeight: 1.5 }}>
                  <b style={{ color: getSpeakerColor(e.speaker) }}>{e.speaker}</b>{' '}
                  <span className="muted sm" style={{ fontSize: '11px' }}>({e.time}):</span>{' '}
                  <span>{e.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <button 
              className="report-download-btn"
              onClick={() => handleDownloadPDF(endedReport)}
            >
              <Download size={16} /> Download Meeting Report (PDF)
            </button>
            <div className="row" style={{ gap: '8px' }}>
              <button 
                className="btn sm"
                onClick={() => nav(endedReport.savedId ? `/transcripts/${endedReport.savedId}/analysis` : '/transcripts')}
              >
                <FileText size={14} /> Open in Analysis Dashboard
              </button>
              <button 
                className="btn primary sm"
                onClick={() => nav('/meetings')}
              >
                Return to Meetings
              </button>
            </div>
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
              <b style={{ fontSize: '13px' }}>LiveKit Cloud WebRTC Status:</b>
              <div className="stack" style={{ gap: '8px', marginTop: '8px' }}>
                <div className="between sm">
                  <span className="muted">LiveKit Server:</span>
                  <span style={{ fontFamily: 'monospace' }}>{tokenData.serverUrl}</span>
                </div>
                <div className="between sm">
                  <span className="muted">Room Name:</span>
                  <span style={{ fontFamily: 'monospace' }}>{tokenData.roomName}</span>
                </div>
                <div className="between sm">
                  <span className="muted">Connection State:</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{connectionState}</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Details Modal */}
      {detail && (
        <Modal title="Meeting details" onClose={() => setDetail(false)}>
          <p><b>{meetingInfo?.title || 'Live Meeting'}</b></p>
          <p className="muted sm">{link}</p>
          <div className="tag" style={{ marginTop: '10px' }}>
            LiveKit Cloud Real-Time Audio & Video Active
          </div>
          <p className="muted sm" style={{ marginTop: '8px' }}>
            Transcripts, summaries, decisions, and action items are automatically synchronized with Neon PostgreSQL and Google Gemini AI.
          </p>
        </Modal>
      )}
    </div>
  )
}

export default function LiveMeeting() {
  const { meetingId } = useParams()
  const nav = useNavigate()
  const { theme, setTheme } = useTheme()
  const [tokenData, setTokenData] = useState(null)
  const [meetingInfo, setMeetingInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCredentials = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch meeting info if available
      try {
        const info = await api.getMeeting(meetingId)
        setMeetingInfo(info)
      } catch (err) {
        // Non-fatal, might be newly created
      }

      // 2. Fetch authenticated LiveKit Access Token
      const data = await api.getMeetingToken(meetingId)
      setTokenData(data)
    } catch (err) {
      console.error('Failed to obtain LiveKit meeting token:', err)
      setError(err.message || 'Unable to join meeting room.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCredentials()
  }, [meetingId])

  // Loading state
  if (loading) {
    return (
      <div className="room" style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <div 
          className="panel" 
          style={{ 
            maxWidth: '440px', 
            textAlign: 'center', 
            padding: '36px 28px',
            borderRadius: '18px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '50%', 
              border: '3px solid var(--color-border)', 
              borderTopColor: 'var(--color-primary)', 
              animation: 'spin 0.8s linear infinite', 
              margin: '0 auto 16px' 
            }} 
          />
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Connecting to LiveKit Room</h2>
          <p className="muted sm" style={{ marginBottom: '16px' }}>
            Authenticating your session and obtaining cryptographically signed access tokens...
          </p>
          <div className="pill" style={{ display: 'inline-flex', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            Room: /meetings/{meetingId}
          </div>
        </div>
      </div>
    )
  }

  // Error state (401, 403 Forbidden, 404 Not Found, 503 Unconfigured)
  if (error || !tokenData) {
    const isForbidden = error?.toLowerCase().includes('authorized') || error?.toLowerCase().includes('forbidden')
    return (
      <div className="room" style={{ display: 'grid', placeItems: 'center', height: '100vh', padding: '20px' }}>
        <div 
          className="panel" 
          style={{ 
            maxWidth: '480px', 
            textAlign: 'center', 
            padding: '36px 28px',
            borderRadius: '18px',
            boxShadow: 'var(--shadow-card)',
            border: '1px solid var(--color-danger)'
          }}
        >
          {isForbidden ? (
            <ShieldAlert size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 14px' }} />
          ) : (
            <AlertTriangle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 14px' }} />
          )}

          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>
            {isForbidden ? 'Access Restricted' : 'Unable to Connect to Meeting Room'}
          </h2>

          <p className="muted sm" style={{ marginBottom: '20px', lineHeight: 1.5 }}>
            {error || 'An unexpected error occurred while communicating with the LiveKit service.'}
          </p>

          <div className="row" style={{ justifyContent: 'center', gap: '12px' }}>
            <button className="btn" onClick={() => nav('/meetings')}>
              Back to Meetings
            </button>
            <button className="btn primary" onClick={fetchCredentials}>
              <RotateCcw size={14} /> Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={tokenData.serverUrl}
      token={tokenData.token}
      connect={true}
      video={false}
      audio={false}
      onDisconnected={() => nav('/meetings')}
      onError={(err) => console.error('LiveKit room runtime error:', err)}
    >
      <RoomAudioRenderer />
      <LiveMeetingContent 
        meetingId={meetingId} 
        meetingInfo={meetingInfo} 
        tokenData={tokenData} 
      />
    </LiveKitRoom>
  )
}
