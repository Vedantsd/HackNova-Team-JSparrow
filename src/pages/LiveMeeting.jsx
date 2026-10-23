import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Circle, Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, MessageSquare, MoreHorizontal, Hand, Captions, Info, Copy, Users, Sun, Moon, Check } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import Modal from '../components/Modal.jsx'
import ParticipantTile from '../components/ParticipantTile.jsx'
import TranscriptPanel from '../components/TranscriptPanel.jsx'
import { participants, liveTranscript } from '../data/demo.js'
import { useTheme } from '../theme.jsx'
function Ctl({ active, on, Icon, Off, label, danger, pressed }) {
  return (<button className={'ctl' + (danger ? ' danger' : '') + (pressed ? ' active' : '')} title={label} aria-label={label}
    aria-pressed={pressed} onClick={on}><span>{active === false && Off ? <Off size={18} /> : <Icon size={18} />}</span>{label}</button>)
}
export default function LiveMeeting() {
  const { meetingId } = useParams(), nav = useNavigate(), { theme, setTheme } = useTheme()
  const [s, setS] = useState({ rec: false, mic: true, cam: true, share: false, hand: false, cc: true, chat: false })
  const [leave, setLeave] = useState(false), [detail, setDetail] = useState(false), [copied, setCopied] = useState(false)
  const t = k => () => setS(o => ({ ...o, [k]: !o[k] }))
  const link = `${location.origin}/meetings/${meetingId}/live`
  const copy = () => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="room">
      <header className="rhead">
        <Logo /><div className="rtitle"><b>Daily Standup Meeting</b><span className="muted sm">Nov 02, 2023 · 10:15</span></div>
        <span className="pill hide-sm">Hosted by John Bergson</span>
        <span className="pill hide-sm"><Users size={14} />4 Participants</span>
        <button className="pill" onClick={copy} aria-label="Copy meeting link">/meetings/{meetingId}{copied ? <Check size={14} /> : <Copy size={14} />}</button>
        <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      </header>
      <div className="rbody">
        <div className="vgrid">{participants.map(p => <ParticipantTile key={p.id} p={p.name === 'You' ? { ...p, muted: !s.mic } : p} camOverride={p.name === 'You' ? s.cam : undefined} />)}</div>
        {s.cc && <TranscriptPanel entries={liveTranscript} />}
      </div>
      <footer className="rbar">
        <div className="grp"><Ctl pressed={s.rec} on={t('rec')} Icon={Circle} label="Record" /></div>
        <div className="grp">
          <Ctl active={s.mic} on={t('mic')} Icon={Mic} Off={MicOff} label={s.mic ? 'Mute' : 'Unmute'} />
          <Ctl active={s.cam} on={t('cam')} Icon={Video} Off={VideoOff} label={s.cam ? 'Stop video' : 'Start video'} />
          <Ctl pressed={s.share} on={t('share')} Icon={MonitorUp} label="Share" />
          <Ctl danger on={() => setLeave(true)} Icon={PhoneOff} label="Leave" />
          <Ctl pressed={s.chat} on={t('chat')} Icon={MessageSquare} label="Chat" />
          <Ctl on={() => setDetail(true)} Icon={MoreHorizontal} label="More" />
        </div>
        <div className="grp">
          <Ctl pressed={s.hand} on={t('hand')} Icon={Hand} label="Raise hand" />
          <Ctl pressed={s.cc} on={t('cc')} Icon={Captions} label="Captions" />
          <Ctl on={() => setDetail(true)} Icon={Info} label="Detail" />
        </div>
      </footer>
      <p className="notice">UI preview only: no audio, video, recording or screen sharing is active yet.</p>
      {leave && <Modal title="Leave meeting?" onClose={() => setLeave(false)}><p className="muted">You will return to the dashboard.</p>
        <div className="row"><button className="btn" onClick={() => setLeave(false)}>Stay</button><button className="btn danger" onClick={() => nav('/')}>Leave</button></div></Modal>}
      {detail && <Modal title="Meeting details" onClose={() => setDetail(false)}><p>Daily Standup Meeting</p><p className="muted sm">{link}</p>
        <p className="muted sm">AI summary, decisions and suggested action items (owners, due dates, human approval) will appear here after backend integration.</p></Modal>}
    </div>)
}
