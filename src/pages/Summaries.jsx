import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { 
  Sparkles, 
  FileText, 
  Video, 
  ArrowRight, 
  Clock, 
  Users, 
  CheckCircle2, 
  Scale
} from 'lucide-react'
import { transcriptStore } from '../services/transcriptStore.js'
import { meetings as demoMeetings, insights as demoInsights } from '../data/demo.js'

export default function Summaries() {
  const nav = useNavigate()
  const { query = '' } = useOutletContext() || {}
  const [transcripts, setTranscripts] = useState([])
  const [sourceFilter, setSourceFilter] = useState('all') // 'all' | 'uploaded' | 'room'

  useEffect(() => {
    setTranscripts(transcriptStore.getTranscripts())
    const handleUpdate = () => setTranscripts(transcriptStore.getTranscripts())
    window.addEventListener('cf-transcripts-updated', handleUpdate)
    return () => window.removeEventListener('cf-transcripts-updated', handleUpdate)
  }, [])

  // Build unified summary items from both Uploaded Transcripts and CommitFlow Meetings
  const allSummaries = useMemo(() => {
    const list = []

    // 1. Processed Uploaded Transcripts
    transcripts.forEach(t => {
      if (t.status === 'Processed' && t.summary) {
        list.push({
          id: t.id,
          title: t.title,
          sourceType: 'Uploaded Transcript',
          sourceBadge: t.fileType || 'TXT',
          date: t.uploadedAt,
          overview: t.summary.overview,
          keyPoints: t.summary.keyDiscussionPoints || [],
          outcomes: t.summary.outcomes,
          decisionsCount: t.decisions?.length || 0,
          actionsCount: t.actionItems?.length || 0,
          participantsCount: t.participants?.length || 0,
          linkTo: `/transcripts/${t.id}/analysis`
        })
      }
    })

    // 2. CommitFlow Room Meetings
    demoMeetings.forEach((m, idx) => {
      const insight = demoInsights[idx % demoInsights.length]
      list.push({
        id: `room-${m.id}`,
        title: m.title,
        sourceType: 'CommitFlow Meeting Room',
        sourceBadge: 'Live Room',
        date: m.when,
        overview: `${m.title} held within CommitFlow. Discussion focused on sprint delivery, client synchronization, and team roadmap execution.`,
        keyPoints: [
          insight?.body || 'Confirmed key milestones for engineering deliverables.',
          'Review of cross-functional team blockers and status updates.'
        ],
        outcomes: 'Recorded in meeting archive with real-time audio transcripts.',
        decisionsCount: 1,
        actionsCount: 2,
        participantsCount: m.people,
        linkTo: `/meetings/${m.id}/live`
      })
    })

    return list
  }, [transcripts])

  const filteredSummaries = useMemo(() => {
    const q = query.toLowerCase()
    return allSummaries.filter(s => {
      const matchSource = sourceFilter === 'all' || 
        (sourceFilter === 'uploaded' && s.sourceType === 'Uploaded Transcript') ||
        (sourceFilter === 'room' && s.sourceType === 'CommitFlow Meeting Room')
      const matchQuery = !q || s.title.toLowerCase().includes(q) || s.overview.toLowerCase().includes(q)
      return matchSource && matchQuery
    })
  }, [allSummaries, sourceFilter, query])

  return (
    <div className="summaries-page stack">
      {/* Header */}
      <section className="panel">
        <div className="phead">
          <div>
            <div className="row" style={{ gap: '8px' }}>
              <Sparkles size={20} color="var(--color-primary)" />
              <h2>AI Meeting Summaries</h2>
              <span className="badge">{allSummaries.length} available</span>
            </div>
            <p className="muted sm" style={{ marginTop: '2px' }}>
              Comprehensive synthesis of meetings hosted in CommitFlow and uploaded transcripts from external platforms.
            </p>
          </div>
        </div>

        {/* Source Filter */}
        <div className="pbody" style={{ paddingBottom: '16px' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="row" style={{ gap: '6px' }}>
              <span className="muted sm">Source:</span>
              {[
                { id: 'all', label: 'All Sources' },
                { id: 'uploaded', label: 'Uploaded Transcripts' },
                { id: 'room', label: 'CommitFlow Rooms' }
              ].map(f => (
                <button
                  key={f.id}
                  className={'chip' + (sourceFilter === f.id ? ' on' : '')}
                  onClick={() => setSourceFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="muted sm">
              Showing {filteredSummaries.length} summaries
            </div>
          </div>
        </div>
      </section>

      {/* Summaries Grid / List */}
      <div className="stack" style={{ gap: '16px' }}>
        {filteredSummaries.length === 0 ? (
          <section className="panel">
            <div className="pbody" style={{ textAlign: 'center', padding: '40px 16px' }}>
              <Sparkles size={32} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
              <b>No summaries match your filter</b>
              <p className="muted sm">Try adjusting your query or upload a transcript to generate an AI summary.</p>
            </div>
          </section>
        ) : (
          filteredSummaries.map(s => {
            const isUploaded = s.sourceType === 'Uploaded Transcript'
            return (
              <section key={s.id} className="panel" style={{ overflow: 'hidden' }}>
                <div className="phead">
                  <div className="row" style={{ gap: '10px' }}>
                    <span 
                      className="micon" 
                      style={{ 
                        background: isUploaded ? '#4f46e5' : '#16a34a',
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px'
                      }}
                    >
                      {isUploaded ? <FileText size={18} /> : <Video size={18} />}
                    </span>

                    <div>
                      <div className="row" style={{ gap: '8px' }}>
                        <h3 style={{ fontSize: '16px' }}>{s.title}</h3>
                        <span 
                          className="source-badge" 
                          style={{ 
                            borderColor: isUploaded ? 'var(--color-primary)' : '#16a34a',
                            color: isUploaded ? 'var(--color-primary)' : '#16a34a'
                          }}
                        >
                          {s.sourceType}
                        </span>
                      </div>
                      <div className="muted sm meta" style={{ marginTop: '2px' }}>
                        <span><Clock size={12} />{s.date}</span>
                        <span>•</span>
                        <span><Users size={12} />{s.participantsCount} participants</span>
                        <span>•</span>
                        <span><Scale size={12} />{s.decisionsCount} decisions</span>
                      </div>
                    </div>
                  </div>

                  <Link to={s.linkTo} className="btn primary sm">
                    <span>{isUploaded ? 'View Analysis' : 'Open Meeting'}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>

                <div className="pbody" style={{ gap: '14px' }}>
                  <p style={{ lineHeight: 1.6, margin: 0 }}>
                    {s.overview}
                  </p>

                  {s.keyPoints.length > 0 && (
                    <div className="mcard" style={{ background: 'var(--color-soft)', padding: '12px 16px', borderRadius: '10px' }}>
                      <div className="grow">
                        <b className="sm" style={{ display: 'block', marginBottom: '6px' }}>Key Highlights:</b>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: 1.5 }}>
                          {s.keyPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
