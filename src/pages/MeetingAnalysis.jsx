import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  FileText, 
  Sparkles, 
  Scale, 
  Check, 
  X, 
  Clock, 
  Users, 
  Search, 
  Copy, 
  Download, 
  RefreshCw,
  Quote,
  Loader2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Layers,
  LayoutList
} from 'lucide-react'
import { api } from '../services/api.js'
import { generateMeetingPDF } from '../services/pdfGenerator.js'

export default function MeetingAnalysis() {
  const { id } = useParams()
  const nav = useNavigate()

  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary') // 'summary' | 'decisions' | 'evidence'
  const [viewMode, setViewMode] = useState('tabs') // 'tabs' | 'all'
  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [highlightQuote, setHighlightQuote] = useState('')
  const [highlightDecisionTitle, setHighlightDecisionTitle] = useState('')
  const evidenceRef = useRef(null)

  const loadData = async () => {
    try {
      const data = await api.getTranscript(id)
      if (data) {
        setTranscript(data)
      } else {
        setTranscript(null)
      }
    } catch (err) {
      console.error('Failed to load meeting analysis:', err)
      setTranscript(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRetryProcessing = async () => {
    try {
      await api.retryTranscriptProcessing(id)
      await loadData()
    } catch (err) {
      alert(`Retry failed: ${err.message || 'Unknown error'}`)
    }
  }

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
    window.addEventListener('cf-transcripts-updated', handleUpdate)
    return () => {
      window.removeEventListener('cf-transcripts-updated', handleUpdate)
    }
  }, [id])

  // Poll while processing so dynamic backend status transitions to completed automatically
  useEffect(() => {
    if (transcript?.status === 'Processing') {
      const timer = setTimeout(() => {
        loadData()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [transcript?.status])

  // Parse transcript speech turns while strictly preserving original timestamps and speakers
  const parsedTurns = useMemo(() => {
    if (!transcript || !transcript.transcriptText) return []
    const raw = transcript.transcriptText.split(/\r?\n/).filter(l => l.trim())
    const entries = []

    raw.forEach((line, lineIndex) => {
      // 1. Bracketed or unbracketed timestamp + Speaker: Text (e.g. "[10:02] Rahul: We agree...")
      const matchWithTime = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*([^:]+):\s*(.*)$/i)
      if (matchWithTime) {
        entries.push({ 
          id: `turn-${lineIndex}`,
          time: matchWithTime[1].trim(), 
          speaker: matchWithTime[2].trim(), 
          text: matchWithTime[3].trim(),
          raw: line
        })
        return
      }

      // 2. Speaker label without timestamp (e.g. "Priya: Let's finalize the database schema.")
      const matchSpeakerOnly = line.match(/^([A-Z][a-zA-Z\s.-]{1,30}):\s*(.*)$/)
      if (matchSpeakerOnly) {
        entries.push({ 
          id: `turn-${lineIndex}`,
          time: '', // Do NOT invent timestamps
          speaker: matchSpeakerOnly[1].trim(), 
          text: matchSpeakerOnly[2].trim(),
          raw: line
        })
        return
      }

      // 3. Narrative or plain line without speaker label (Do NOT invent fake speaker name)
      entries.push({ 
        id: `turn-${lineIndex}`,
        time: '', 
        speaker: null, 
        text: line.trim(),
        raw: line
      })
    })

    return entries
  }, [transcript])

  // Filtered speech turns based on search query
  const filteredTurns = useMemo(() => {
    if (!transcriptSearch.trim()) return parsedTurns
    const q = transcriptSearch.toLowerCase()
    return parsedTurns.filter(e => 
      (e.speaker && e.speaker.toLowerCase().includes(q)) || 
      e.text.toLowerCase().includes(q)
    )
  }, [parsedTurns, transcriptSearch])

  // Interactive navigation: jumps from a confirmed decision straight to supporting transcript passage
  const handleJumpToEvidence = (quote, decisionTitle) => {
    setHighlightQuote(quote || '')
    setHighlightDecisionTitle(decisionTitle || '')
    if (viewMode === 'tabs') {
      setActiveTab('evidence')
    }

    // Smooth scroll to matching speech turn
    setTimeout(() => {
      if (quote) {
        const cleanQuote = quote.toLowerCase().replace(/["']/g, '').trim()
        const matchIdx = parsedTurns.findIndex(t => 
          t.text.toLowerCase().includes(cleanQuote.slice(0, 40)) || 
          cleanQuote.includes(t.text.toLowerCase().slice(0, 40))
        )
        if (matchIdx >= 0) {
          const el = document.getElementById(`transcript-turn-${matchIdx}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
          }
        }
      }
      if (evidenceRef.current) {
        evidenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)
  }

  // Cross-link from discussion point to search evidence
  const handleSearchDiscussionPoint = (point) => {
    if (viewMode === 'tabs') {
      setActiveTab('evidence')
    }
    // Extract first 4 words of discussion point as search anchor
    const words = point.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).slice(0, 4).join(' ')
    setTranscriptSearch(words)
    setTimeout(() => {
      if (evidenceRef.current) {
        evidenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)
  }

  const handleCopyTranscript = () => {
    if (!transcript?.transcriptText) return
    navigator.clipboard?.writeText(transcript.transcriptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportPDF = () => {
    if (!transcript) return
    generateMeetingPDF({
      title: transcript.title,
      date: transcript.uploadedAt || 'Oct 24, 2026',
      duration: transcript.duration || '30 min',
      participants: transcript.participants || [],
      summary: transcript.summary,
      decisions: transcript.decisions || [],
      actionItems: [], // Preserving strict 3-section scope
      transcriptEntries: transcript.transcriptText || '',
      filename: `${(transcript.title || 'Meeting').replace(/[^a-zA-Z0-9_-]/g, '_')}_Analysis.pdf`
    })
  }

  const handleDownloadTranscript = () => {
    if (!transcript?.transcriptText) return
    const blob = new Blob([transcript.transcriptText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${transcript.filename || 'transcript.txt'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <section className="panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <Loader2 size={28} className="spin-icon" style={{ margin: '0 auto 12px' }} />
        <p className="muted">Loading real meeting analysis from database...</p>
      </section>
    )
  }

  if (!transcript) {
    return (
      <section className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <AlertCircle size={36} color="var(--color-danger)" style={{ margin: '0 auto 12px' }} />
        <h2>Transcript Not Found</h2>
        <p className="muted sm">The requested meeting transcript could not be found or has been removed.</p>
        <div style={{ marginTop: '16px' }}>
          <button className="btn primary sm" onClick={() => nav('/user/transcripts')}>
            <ArrowLeft size={14} /> Back to Transcripts
          </button>
        </div>
      </section>
    )
  }

  // Helper check for whether a speech turn matches the active evidence quote
  const isTurnHighlighted = (turnText) => {
    if (!highlightQuote) return false
    const cleanQ = highlightQuote.toLowerCase().replace(/["']/g, '').trim()
    const cleanT = turnText.toLowerCase().replace(/["']/g, '').trim()
    return cleanT.includes(cleanQ.slice(0, 35)) || cleanQ.includes(cleanT.slice(0, 35))
  }

  return (
    <div className="meeting-analysis-page stack">
      {/* ----------------------------------------------------------------- */}
      {/* Top Header Card                                                  */}
      {/* ----------------------------------------------------------------- */}
      <section className="panel">
        <div className="phead" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div className="row" style={{ gap: '8px', marginBottom: '4px' }}>
              <Link to="/user/transcripts" className="link row" style={{ gap: '4px', marginRight: '6px' }}>
                <ArrowLeft size={14} /> Transcripts
              </Link>
              <span className="source-badge" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                {transcript.sourceType || 'Uploaded Transcript'}
              </span>
              <span className={`status-badge ${(transcript.status || 'processed').toLowerCase()}`}>
                {transcript.status === 'Processing' && <Loader2 size={12} className="spin-icon" />}
                {transcript.status}
              </span>
            </div>

            <h1 style={{ fontSize: '20px', margin: '4px 0 6px' }}>{transcript.title}</h1>

            <div className="muted sm meta">
              <span title="Original file name"><FileText size={13} />{transcript.filename}</span>
              <span>•</span>
              <span title="File size">{transcript.fileSize}</span>
              <span>•</span>
              <span title="Uploaded at"><Clock size={13} />{transcript.uploadedAt}</span>
              <span>•</span>
              <span title="Identified speakers"><Users size={13} />{transcript.participants?.length || 0} participants</span>
              {transcript.duration && (
                <>
                  <span>•</span>
                  <span>Duration: {transcript.duration}</span>
                </>
              )}
            </div>
          </div>

          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            {/* View Mode Toggle: Tabbed vs Single-Page All Sections */}
            <div className="analysis-view-toggle">
              <button 
                className={viewMode === 'tabs' ? 'active' : ''} 
                onClick={() => setViewMode('tabs')}
                title="View one section at a time"
              >
                <Layers size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                Tabs
              </button>
              <button 
                className={viewMode === 'all' ? 'active' : ''} 
                onClick={() => setViewMode('all')}
                title="View all 3 sections stacked together"
              >
                <LayoutList size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                All 3 Sections
              </button>
            </div>

            <button className="btn sm" onClick={handleCopyTranscript} title="Copy raw transcript text">
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span className="hide-sm">{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button className="btn primary sm" onClick={handleExportPDF} title="Download summary and decisions mapped to transcript">
              <Download size={14} />
              <span>Export PDF</span>
            </button>
            <button className="btn sm" onClick={handleDownloadTranscript} title="Download raw transcript file (.txt)">
              <FileText size={14} />
              <span className="hide-sm">Export TXT</span>
            </button>
          </div>
        </div>

        {/* Processing State Notice */}
        {transcript.status === 'Processing' && (
          <div className="pbody" style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))', borderBottom: '1px solid var(--color-border)' }}>
            <div className="row" style={{ gap: '10px' }}>
              <Loader2 size={18} className="spin-icon" color="var(--color-primary)" />
              <div>
                <b>AI Analysis In Progress...</b>
                <p className="muted sm" style={{ margin: 0 }}>
                  Extracting executive summary, verifying confirmed decisions, and mapping transcript evidence. This view refreshes automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Failed State Notice */}
        {transcript.status === 'Failed' && (
          <div className="pbody" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))', borderBottom: '1px solid var(--color-border)' }}>
            <div className="row" style={{ gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: '10px' }}>
                <AlertCircle size={20} color="var(--color-danger)" />
                <div>
                  <b style={{ color: 'var(--color-danger)' }}>AI Analysis Failed</b>
                  <p className="muted sm" style={{ margin: 0 }}>
                    {transcript.errorMessage || 'An error occurred during AI analysis. You can retry processing using the button on the right.'}
                  </p>
                </div>
              </div>
              <button className="btn sm" onClick={handleRetryProcessing} style={{ gap: '6px' }}>
                <RefreshCw size={14} />
                <span>Retry Processing</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs (Only the 3 required sections) */}
        {viewMode === 'tabs' && (
          <div className="analysis-tabs-bar">
            {[
              { id: 'summary', label: '1. AI Meeting Summary', icon: Sparkles },
              { id: 'decisions', label: '2. Decisions & Agreements', icon: Scale, count: transcript.decisions?.length },
              { id: 'evidence', label: '3. Transcript Evidence', icon: FileText, count: parsedTurns.length }
            ].map(t => (
              <button
                key={t.id}
                className={`analysis-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <t.icon size={15} />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className="tab-pill-count">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* SECTION 1: AI MEETING SUMMARY                                    */}
      {/* ================================================================= */}
      {(viewMode === 'all' || activeTab === 'summary') && (
        <section className="panel" id="section-summary">
          <div className="phead">
            <div className="row" style={{ gap: '8px' }}>
              <Sparkles size={18} color="var(--color-primary)" />
              <div>
                <h3 style={{ margin: 0 }}>AI Meeting Summary</h3>
                <span className="muted sm">Synthesized objectives, key discussion points, and agreed conclusions</span>
              </div>
            </div>
            <span className="tag">Section 1</span>
          </div>

          <div className="pbody" style={{ gap: '22px' }}>
            {transcript.status === 'Processing' ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 8px' }} />
                <p className="muted sm">Synthesizing executive summary from transcript...</p>
              </div>
            ) : transcript.summary ? (
              <>
                {/* 1. Executive Overview & Objectives */}
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>
                    Executive Overview & Objectives
                  </h4>
                  <div className="mcard" style={{ padding: '16px', background: 'var(--color-surface)', borderLeft: '3px solid var(--color-primary)' }}>
                    <p style={{ lineHeight: 1.65, fontSize: '14.5px', margin: 0 }}>
                      {transcript.summary.overview}
                    </p>
                  </div>
                </div>

                {/* 2. Key Discussion Points */}
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>
                    Key Discussion Points ({transcript.summary.keyDiscussionPoints?.length || 0})
                  </h4>
                  {Array.isArray(transcript.summary.keyDiscussionPoints) && transcript.summary.keyDiscussionPoints.length > 0 ? (
                    <div className="stack" style={{ gap: '10px' }}>
                      {transcript.summary.keyDiscussionPoints.map((pt, idx) => (
                        <div key={idx} className="discussion-point-item">
                          <span className="point-index">{idx + 1}</span>
                          <div className="grow">
                            <p style={{ margin: 0, lineHeight: 1.6, fontSize: '14px' }}>{pt}</p>
                          </div>
                          <button 
                            className="btn sm" 
                            style={{ padding: '2px 8px', height: '26px', fontSize: '11.5px', flexShrink: 0 }}
                            onClick={() => handleSearchDiscussionPoint(pt)}
                            title="Find supporting discussion in transcript evidence"
                          >
                            <Search size={12} />
                            <span>Verify in Evidence</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted sm">No structured discussion points recorded in this summary.</p>
                  )}
                </div>

                {/* 3. Agreed Outcomes & Conclusions */}
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>
                    Outcomes & Conclusions
                  </h4>
                  <div className="mcard" style={{ background: 'var(--color-soft)', padding: '14px 18px', borderLeft: '3px solid #10b981' }}>
                    <b className="sm" style={{ color: '#10b981' }}>Agreed Outcomes</b>
                    <p style={{ margin: '6px 0 0', lineHeight: 1.6, fontSize: '14px' }}>
                      {transcript.summary.outcomes || 'No explicit conclusion recorded.'}
                    </p>
                  </div>
                </div>

                {/* Bottom link to cross-verify against evidence */}
                <div style={{ paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                  <button 
                    className="link row sm" 
                    style={{ gap: '6px', background: 'none', border: 0, cursor: 'pointer', color: 'var(--color-primary)' }}
                    onClick={() => {
                      if (viewMode === 'tabs') setActiveTab('evidence')
                      if (evidenceRef.current) evidenceRef.current.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    <span>Inspect supporting passages in Transcript Evidence</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <AlertCircle size={28} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
                <h4>No Summary Available</h4>
                <p className="muted sm" style={{ maxWidth: '420px', margin: '0 auto 14px' }}>
                  No AI summary has been generated for this transcript yet.
                </p>
                <button className="btn primary sm" onClick={handleRetryProcessing}>
                  <RefreshCw size={13} /> Process Transcript
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION 2: DECISIONS & AGREEMENTS                                */}
      {/* ================================================================= */}
      {(viewMode === 'all' || activeTab === 'decisions') && (
        <section className="panel" id="section-decisions">
          <div className="phead">
            <div className="row" style={{ gap: '8px' }}>
              <Scale size={18} color="var(--color-primary)" />
              <div>
                <h3 style={{ margin: 0 }}>Decisions & Agreements</h3>
                <span className="muted sm">Confirmed architectural, product, and organizational agreements</span>
              </div>
            </div>
            <span className="tag">Section 2</span>
          </div>

          <div className="pbody">
            {transcript.status === 'Processing' ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 8px' }} />
                <p className="muted sm">Extracting confirmed decisions and explicit agreements...</p>
              </div>
            ) : (!transcript.decisions || transcript.decisions.length === 0) ? (
              /* Honest empty state when no decisions are confirmed */
              <div style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--color-soft)', borderRadius: '10px' }}>
                <Scale size={32} color="var(--color-muted)" style={{ margin: '0 auto 10px', opacity: 0.7 }} />
                <h4 style={{ margin: '0 0 6px' }}>No Confirmed Decisions Found</h4>
                <p className="muted sm" style={{ maxWidth: '480px', margin: '0 auto 10px', lineHeight: 1.55 }}>
                  No confirmed decisions or explicit agreements were established in this transcript.
                  Suggestions, proposals, and undecided ideas discussed in the meeting are not treated as confirmed decisions.
                </p>
                <span className="muted sm" style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>
                  CommitFlow strictly verifies agreements against explicit consensus to prevent fabricated commitments.
                </span>
              </div>
            ) : (
              <div className="stack" style={{ gap: '14px' }}>
                <p className="muted sm" style={{ margin: '0 0 4px' }}>
                  Showing <b>{transcript.decisions.length}</b> confirmed agreement{transcript.decisions.length === 1 ? '' : 's'} supported by transcript evidence.
                </p>

                {transcript.decisions.map((d, dIdx) => (
                  <div key={d.id || dIdx} className="mcard col" style={{ padding: '16px', borderLeft: '3px solid var(--color-primary)' }}>
                    {/* Top Row: Title & Confirmed Badge */}
                    <div className="between" style={{ alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                      <b style={{ fontSize: '15.5px' }}>{d.title}</b>
                      <span className="status-badge processed" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={11} /> Confirmed Agreement
                      </span>
                    </div>

                    {/* Details */}
                    <p style={{ margin: '8px 0 6px', lineHeight: 1.55, fontSize: '14px' }}>
                      {d.details}
                    </p>

                    {/* Verbatim Supporting Evidence with Cross-Linking */}
                    {d.evidence && (
                      <div className="evidence-box">
                        <Quote size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-primary)' }} />
                        <div className="grow">
                          <span className="evidence-speaker">
                            {d.evidence.speaker || 'Speaker'}
                            {d.evidence.timestamp ? ` (${d.evidence.timestamp})` : ''}:
                          </span>
                          <span className="evidence-quote">"{d.evidence.quote}"</span>
                        </div>

                        {/* Interactive Cross-Link Button */}
                        <button
                          type="button"
                          className="btn-view-evidence"
                          onClick={() => handleJumpToEvidence(d.evidence.quote, d.title)}
                          title="Navigate to this exact passage in Transcript Evidence"
                        >
                          <span>View in Transcript Evidence</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION 3: TRANSCRIPT EVIDENCE                                   */}
      {/* ================================================================= */}
      {(viewMode === 'all' || activeTab === 'evidence') && (
        <section className="panel" id="section-evidence" ref={evidenceRef}>
          <div className="phead" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div className="row" style={{ gap: '8px' }}>
              <FileText size={18} color="var(--color-primary)" />
              <div>
                <h3 style={{ margin: 0 }}>Transcript Evidence</h3>
                <span className="muted sm">Verbatim speech turns from original uploaded transcript</span>
              </div>
            </div>

            <div className="row" style={{ gap: '8px' }}>
              {/* Dialogue search input */}
              <div className="search" style={{ height: '36px', width: '250px' }}>
                <Search size={14} />
                <input
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  placeholder="Search speaker or text..."
                  aria-label="Search within transcript dialogue"
                />
                {transcriptSearch && (
                  <button 
                    className="muted sm" 
                    style={{ background: 'none', border: 0, cursor: 'pointer' }}
                    onClick={() => setTranscriptSearch('')}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pbody">
            {/* Active Evidence Highlight Banner */}
            {highlightQuote && (
              <div className="highlight-indicator-banner">
                <div className="row" style={{ gap: '8px' }}>
                  <Sparkles size={16} color="var(--color-primary)" />
                  <div>
                    <b>Highlighting evidence for:</b> {highlightDecisionTitle || 'Selected Decision'}
                    <div className="muted sm" style={{ fontStyle: 'italic', marginTop: '2px' }}>
                      "{highlightQuote}"
                    </div>
                  </div>
                </div>
                <button 
                  className="btn sm" 
                  onClick={() => {
                    setHighlightQuote('')
                    setHighlightDecisionTitle('')
                  }}
                  style={{ gap: '4px', flexShrink: 0 }}
                >
                  <X size={12} />
                  <span>Clear Highlight</span>
                </button>
              </div>
            )}

            {/* Transcript turns viewer */}
            {parsedTurns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <p className="muted">No transcript text is available for this meeting.</p>
              </div>
            ) : filteredTurns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <p className="muted">No dialogue turns match "{transcriptSearch}".</p>
                <button className="btn sm" onClick={() => setTranscriptSearch('')} style={{ marginTop: '8px' }}>
                  Reset Search
                </button>
              </div>
            ) : (
              <div className="stack" style={{ gap: '10px', maxHeight: '720px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredTurns.map((turn, idx) => {
                  const highlighted = isTurnHighlighted(turn.text)

                  return (
                    <div 
                      key={turn.id || idx} 
                      id={`transcript-turn-${idx}`}
                      className={`transcript-turn-card ${highlighted ? 'is-highlighted-evidence' : ''}`}
                    >
                      {/* Avatar with speaker initials if speaker is identified */}
                      {turn.speaker ? (
                        <span className="avatar sm" style={{ marginTop: '2px', flexShrink: 0 }}>
                          {turn.speaker.slice(0, 2).toUpperCase()}
                        </span>
                      ) : (
                        <span className="avatar sm" style={{ marginTop: '2px', flexShrink: 0, background: 'var(--color-soft)', color: 'var(--color-muted)' }}>
                          <FileText size={12} />
                        </span>
                      )}

                      <div className="grow">
                        {/* Header: Speaker name, Timestamp (preserved from source, never fabricated) */}
                        <div className="row" style={{ gap: '8px', marginBottom: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {turn.speaker ? (
                            <b className="sm">{turn.speaker}</b>
                          ) : (
                            <span className="muted sm" style={{ fontStyle: 'italic' }}>Narrative excerpt</span>
                          )}

                          {/* Timestamp only shown when present in source text */}
                          {turn.time && (
                            <span className="muted sm" style={{ fontSize: '11.5px', background: 'var(--color-soft)', padding: '1px 6px', borderRadius: '4px' }}>
                              <Clock size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: '-1px' }} />
                              {turn.time}
                            </span>
                          )}

                          {/* Highlight match badge */}
                          {highlighted && (
                            <span className="evidence-match-badge">
                              <Check size={10} /> Supporting Evidence
                            </span>
                          )}
                        </div>

                        {/* Dialogue bubble */}
                        <div className="transcript-bubble" style={{ 
                          borderColor: highlighted ? 'var(--color-primary)' : undefined,
                          background: highlighted ? 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))' : undefined
                        }}>
                          <p style={{ margin: 0, lineHeight: 1.6, fontSize: '13.5px' }}>
                            {turn.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
