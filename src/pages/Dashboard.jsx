import { useState, useEffect } from 'react'
import { Link, useOutletContext, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  Sparkles,
  CheckSquare,
  HelpCircle,
  Video,
  Clock,
  User,
  Plus,
  Calendar,
  AlertCircle,
  Loader2,
  FileUp,
  TrendingUp
} from 'lucide-react'
import MeetingCard from '../components/MeetingCard.jsx'
import { api } from '../services/api.js'

export default function Dashboard() {
  const { query = '' } = useOutletContext() || {}
  const q = query.toLowerCase()
  const nav = useNavigate()

  const [loading, setLoading] = useState(true)
  const [meetings, setMeetings] = useState([])
  const [transcripts, setTranscripts] = useState([])
  const [actionItems, setActionItems] = useState([])
  const [followUps, setFollowUps] = useState([])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [mRes, tRes, aRes, fRes] = await Promise.all([
        api.listMeetings().catch(() => []),
        api.listTranscripts().catch(() => []),
        api.listActionItems().catch(() => []),
        api.listUnresolvedQuestions().catch(() => [])
      ])

      setMeetings(Array.isArray(mRes) ? mRes : [])
      setTranscripts(Array.isArray(tRes) ? tRes : [])
      setActionItems(Array.isArray(aRes) ? aRes : [])
      setFollowUps(Array.isArray(fRes) ? fRes : [])
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
    const handleUpdate = () => loadDashboardData()
    window.addEventListener('cf-transcripts-updated', handleUpdate)
    return () => window.removeEventListener('cf-transcripts-updated', handleUpdate)
  }, [])

  const filteredMeetings = meetings.filter(m => (m.title || '').toLowerCase().includes(q))
  const latestTranscript = transcripts[0] || null
  const pendingActionItems = actionItems.filter(a => a.status === 'Pending Approval' || a.status === 'pending_approval' || a.status === 'In Progress')
  const pendingFollowUps = followUps.filter(f => f.status !== 'Resolved')

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Loader2 size={32} className="spin-icon" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
        <p className="muted">Loading workspace dashboard...</p>
      </div>
    )
  }

  return (
    <div className="grid2">
      {/* Left Column: Meetings & Latest Transcript Intelligence */}
      <div className="stack" style={{ gap: '20px' }}>
        {/* Recent Meetings Panel */}
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <Video size={18} color="var(--color-primary)" />
              <h2>Recent Meetings</h2>
              <span className="badge">{filteredMeetings.length}</span>
            </div>
            <Link to="/user/meetings" className="link">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="pbody">
            {filteredMeetings.length ? (
              filteredMeetings.slice(0, 4).map(m => <MeetingCard key={m.id} m={m} />)
            ) : (
              <div className="mcard col" style={{ textAlign: 'center', padding: '32px 16px' }}>
                <Video size={32} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
                <b style={{ fontSize: '14px' }}>No meetings found</b>
                <p className="muted sm" style={{ maxWidth: '360px', margin: '4px auto 12px' }}>
                  {query ? `No meetings match “${query}”.` : 'No meetings scheduled yet. Create a meeting or start an instant call to get started.'}
                </p>
                <div>
                  <button className="btn primary sm" onClick={() => nav('/meetings/new/live')}>
                    <Plus size={14} /> Start Instant Call
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Latest Transcript & AI Meeting Intelligence */}
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <Sparkles size={18} color="var(--color-primary)" />
              <h2>Meeting Intelligence & Transcripts</h2>
            </div>
            <Link to="/user/transcripts" className="link">
              Transcripts Hub <ArrowRight size={12} />
            </Link>
          </div>

          <div className="pbody">
            {latestTranscript ? (
              <div className="mcard col" style={{ gap: '12px', padding: '16px' }}>
                <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span className="chip" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {latestTranscript.fileType || 'TXT'}
                    </span>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '2px 0' }}>
                      {latestTranscript.title}
                    </h3>
                    <div className="muted sm row" style={{ gap: '8px', marginTop: '4px' }}>
                      <span><Clock size={12} style={{ display: 'inline', marginRight: '3px' }} />{latestTranscript.uploadedAt || latestTranscript.createdAt || 'Recent'}</span>
                      {latestTranscript.participants && (
                        <span>• {latestTranscript.participants.length} speakers</span>
                      )}
                    </div>
                  </div>

                  <span
                    className="tag"
                    style={{
                      background: latestTranscript.status === 'Processed' ? 'var(--color-success, #10b981)' : (latestTranscript.status === 'Processing' ? 'var(--color-primary)' : 'var(--color-danger)'),
                      color: '#fff'
                    }}
                  >
                    {latestTranscript.status}
                  </span>
                </div>

                {latestTranscript.summary && (
                  <p className="sm" style={{ color: 'var(--color-text)', lineHeight: 1.5, background: 'var(--color-background-subtle, #f8fafc)', padding: '10px 12px', borderRadius: '6px' }}>
                    {typeof latestTranscript.summary === 'string' ? latestTranscript.summary : (latestTranscript.summary.overview || '')}
                  </p>
                )}

                <div className="between" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div className="row" style={{ gap: '12px', fontSize: '12px' }}>
                    <span><b>{latestTranscript.decisions?.length || 0}</b> Decisions</span>
                    <span>•</span>
                    <span><b>{latestTranscript.actionItems?.length || 0}</b> Action Items</span>
                    <span>•</span>
                    <span><b>{latestTranscript.unresolvedQuestions?.length || 0}</b> Follow-ups</span>
                  </div>

                  <Link
                    to={`/user/transcripts/${latestTranscript.id}/analysis`}
                    className="btn primary sm"
                  >
                    <span>View Analysis & Decisions</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mcard col" style={{ textAlign: 'center', padding: '36px 16px' }}>
                <FileText size={36} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
                <b style={{ fontSize: '14px' }}>No transcript available</b>
                <p className="muted sm" style={{ maxWidth: '420px', margin: '4px auto 14px' }}>
                  No transcript available. Upload a meeting transcript or enter meeting notes to get started.
                </p>
                <div>
                  <button className="btn primary sm" onClick={() => nav('/user/transcripts?upload=true')}>
                    <FileUp size={14} /> Upload Meeting Transcript
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right Column: Real Action Items & Follow-ups */}
      <div className="stack" style={{ gap: '20px' }}>
        {/* Real Action Items / Commitments Panel */}
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <CheckSquare size={18} color="var(--color-primary)" />
              <h2>Action Items & Commitments</h2>
              <span className="badge">{pendingActionItems.length}</span>
            </div>
            <Link to="/user/action-items" className="link">
              Manage <ArrowRight size={12} />
            </Link>
          </div>

          <div className="pbody">
            {pendingActionItems.length ? (
              <div className="stack" style={{ gap: '10px' }}>
                {pendingActionItems.slice(0, 4).map(a => (
                  <div key={a.id} className="mcard col" style={{ padding: '12px 14px', gap: '6px' }}>
                    <div className="between" style={{ alignItems: 'flex-start', gap: '8px' }}>
                      <b style={{ fontSize: '13.5px' }}>{a.title}</b>
                      <span
                        className="chip"
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          background: a.priority === 'High' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: a.priority === 'High' ? '#ef4444' : 'var(--color-primary)'
                        }}
                      >
                        {a.priority || 'Medium'}
                      </span>
                    </div>

                    <div className="between muted sm" style={{ fontSize: '12px', marginTop: '2px' }}>
                      <span className="row" style={{ gap: '4px', alignItems: 'center' }}>
                        <User size={12} />
                        {a.owner && a.owner !== 'Unassigned' ? a.owner : <span style={{ color: '#d97706' }}>Unassigned</span>}
                      </span>
                      <span className="row" style={{ gap: '4px', alignItems: 'center' }}>
                        <Calendar size={12} />
                        {a.deadline && a.deadline !== 'Unspecified' ? a.deadline : <span style={{ color: '#d97706' }}>No deadline</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mcard col" style={{ textAlign: 'center', padding: '28px 16px' }}>
                <CheckSquare size={32} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
                <b style={{ fontSize: '13.5px' }}>No active action items</b>
                <p className="muted sm" style={{ margin: '3px auto 10px', maxWidth: '340px' }}>
                  No action items extracted yet. Upload a meeting transcript to extract commitments.
                </p>
                <div>
                  <button className="btn sm" onClick={() => nav('/user/transcripts?upload=true')}>
                    Upload Transcript
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Real Follow-ups & Unresolved Questions Panel */}
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <HelpCircle size={18} color="var(--color-primary)" />
              <h2>Follow-ups & Questions</h2>
              <span className="badge">{pendingFollowUps.length}</span>
            </div>
            <Link to="/user/follow-ups" className="link">
              View All <ArrowRight size={12} />
            </Link>
          </div>

          <div className="pbody">
            {pendingFollowUps.length ? (
              <div className="stack" style={{ gap: '10px' }}>
                {pendingFollowUps.slice(0, 3).map(f => (
                  <div key={f.id} className="mcard col" style={{ padding: '12px 14px', gap: '4px' }}>
                    <div className="between" style={{ alignItems: 'flex-start', gap: '8px' }}>
                      <span className="chip" style={{ fontSize: '10.5px' }}>
                        {f.category || 'Question'}
                      </span>
                      <span className="tag" style={{ fontSize: '10.5px' }}>
                        {f.status || 'Pending'}
                      </span>
                    </div>
                    <b style={{ fontSize: '13px', marginTop: '2px' }}>{f.title}</b>
                    {f.sourceMeetingTitle && (
                      <p className="muted sm" style={{ fontSize: '11.5px', margin: 0 }}>
                        From: {f.sourceMeetingTitle}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mcard col" style={{ textAlign: 'center', padding: '28px 16px' }}>
                <HelpCircle size={32} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
                <b style={{ fontSize: '13.5px' }}>No open follow-up questions</b>
                <p className="muted sm" style={{ margin: '3px auto 0', maxWidth: '320px' }}>
                  Questions and ambiguous commitments identified during transcripts appear here for resolution.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
