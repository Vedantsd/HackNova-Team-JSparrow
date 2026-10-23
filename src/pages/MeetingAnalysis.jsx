import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  FileText, 
  Sparkles, 
  CheckSquare, 
  HelpCircle, 
  Scale, 
  Check, 
  X, 
  Clock, 
  Users, 
  AlertTriangle, 
  Search, 
  Copy, 
  Download, 
  Edit3, 
  Save, 
  RefreshCw,
  Quote,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { api } from '../services/api.js'
import { transcriptStore } from '../services/transcriptStore.js'
import { generateMeetingPDF } from '../services/pdfGenerator.js'

export default function MeetingAnalysis() {
  const { id } = useParams()
  const nav = useNavigate()

  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary') // 'summary' | 'transcript' | 'decisions' | 'actions' | 'unresolved'
  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [copied, setCopied] = useState(false)
  
  // Editing action item modal or inline state
  const [editingActionId, setEditingActionId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', owner: '', deadline: '', priority: 'Medium' })

  const loadData = async () => {
    try {
      const data = await api.getTranscript(id)
      if (data) setTranscript(data)
      else setTranscript(transcriptStore.getTranscript(id))
    } catch {
      setTranscript(transcriptStore.getTranscript(id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
    window.addEventListener('cf-transcripts-updated', handleUpdate)
    window.addEventListener('cf-actions-updated', handleUpdate)
    return () => {
      window.removeEventListener('cf-transcripts-updated', handleUpdate)
      window.removeEventListener('cf-actions-updated', handleUpdate)
    }
  }, [id])

  // Filtered transcript speech turns
  const parsedTurns = useMemo(() => {
    if (!transcript || !transcript.transcriptText) return []
    const raw = transcript.transcriptText.split(/\r?\n/).filter(l => l.trim())
    const entries = []

    raw.forEach(line => {
      const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*([^:]+):\s*(.*)$/)
      if (match) {
        entries.push({ time: match[1], speaker: match[2].trim(), text: match[3].trim() })
      } else {
        const simple = line.match(/^([A-Z][a-zA-Z\s.-]{1,25}):\s*(.*)$/)
        if (simple) {
          entries.push({ time: '', speaker: simple[1].trim(), text: simple[2].trim() })
        } else {
          entries.push({ time: '', speaker: 'Speaker', text: line })
        }
      }
    })

    if (!transcriptSearch.trim()) return entries
    const q = transcriptSearch.toLowerCase()
    return entries.filter(e => e.speaker.toLowerCase().includes(q) || e.text.toLowerCase().includes(q))
  }, [transcript, transcriptSearch])

  // Action item handlers
  const handleApprove = async (actionId, e) => {
    e?.stopPropagation()
    await api.approveActionItem(transcript.id, actionId)
    await loadData()
  }

  const handleReject = async (actionId, e) => {
    e?.stopPropagation()
    await api.rejectActionItem(transcript.id, actionId)
    await loadData()
  }

  const startEditAction = action => {
    setEditingActionId(action.id)
    setEditForm({
      title: action.title,
      owner: action.owner,
      deadline: action.deadline,
      priority: action.priority || 'Medium'
    })
  }

  const saveEditAction = async actionId => {
    await api.editActionItem(transcript.id, actionId, editForm)
    setEditingActionId(null)
    await loadData()
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
      date: transcript.uploadedAt || 'Oct 23, 2026',
      duration: transcript.duration || '30 min',
      participants: transcript.participants || [],
      summary: transcript.summary,
      decisions: transcript.decisions || [],
      actionItems: transcript.actionItems || [],
      transcriptEntries: transcript.transcriptText || '',
      filename: `${(transcript.title || 'Meeting').replace(/[^a-zA-Z0-9_-]/g, '_')}_Summary_Transcript.pdf`
    })
  }

  const handleDownloadTranscript = () => {
    if (!transcript) return
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
        <p className="muted">Loading meeting analysis...</p>
      </section>
    )
  }

  if (!transcript) {
    return (
      <section className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <AlertCircle size={36} color="var(--color-danger)" style={{ margin: '0 auto 12px' }} />
        <h2>Transcript Not Found</h2>
        <p className="muted sm">The requested meeting analysis could not be found or has been removed.</p>
        <div style={{ marginTop: '16px' }}>
          <button className="btn primary sm" onClick={() => nav('/transcripts')}>
            <ArrowLeft size={14} /> Back to Transcripts
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="meeting-analysis-page stack">
      {/* Top Header Card */}
      <section className="panel">
        <div className="phead" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div className="row" style={{ gap: '8px', marginBottom: '4px' }}>
              <Link to="/transcripts" className="link row" style={{ gap: '4px', marginRight: '6px' }}>
                <ArrowLeft size={14} /> Transcripts
              </Link>
              <span className="source-badge" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                {transcript.sourceType || 'Uploaded Transcript'}
              </span>
              <span className={`status-badge ${transcript.status.toLowerCase()}`}>
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
            </div>
          </div>

          <div className="row" style={{ gap: '8px' }}>
            <button className="btn sm" onClick={handleCopyTranscript} title="Copy full transcript">
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span className="hide-sm">{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button className="btn primary sm" onClick={handleExportPDF} title="Download meeting transcript and AI summary mapped into one PDF">
              <Download size={14} />
              <span>Download PDF</span>
            </button>
            <button className="btn sm" onClick={handleDownloadTranscript} title="Export plain text (.txt)">
              <FileText size={14} />
              <span className="hide-sm">Export TXT</span>
            </button>
          </div>
        </div>

        {/* Processing State Notice */}
        {transcript.status === 'Processing' && (
          <div className="pbody" style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))' }}>
            <div className="row" style={{ gap: '10px' }}>
              <Loader2 size={18} className="spin-icon" color="var(--color-primary)" />
              <div>
                <b>AI processing in progress...</b>
                <p className="muted sm" style={{ margin: 0 }}>
                  Extracting meeting summary, confirmed decisions, action items, and ambiguous details. This view updates automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="analysis-tabs-bar">
          {[
            { id: 'summary', label: 'AI Summary', icon: Sparkles },
            { id: 'decisions', label: 'Decisions', icon: Scale, count: transcript.decisions?.length },
            { id: 'actions', label: 'Action Items', icon: CheckSquare, count: transcript.actionItems?.length },
            { id: 'unresolved', label: 'Unresolved Questions', icon: HelpCircle, count: transcript.unresolvedQuestions?.length },
            { id: 'transcript', label: 'Transcript', icon: FileText }
          ].map(t => (
            <button
              key={t.id}
              className={`analysis-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon size={15} />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className="tab-pill-count">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* TAB 1: AI SUMMARY */}
      {activeTab === 'summary' && (
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px' }}>
              <Sparkles size={18} color="var(--color-primary)" />
              <h3>Meeting Summary & Discussion Overview</h3>
            </div>
            <span className="tag">Structured AI Output</span>
          </div>

          <div className="pbody" style={{ gap: '20px' }}>
            {transcript.summary ? (
              <>
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>
                    Executive Overview
                  </h4>
                  <p style={{ lineHeight: 1.65, fontSize: '14.5px' }}>
                    {transcript.summary.overview}
                  </p>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>
                    Key Discussion Points
                  </h4>
                  <ul className="discussion-points-list">
                    {transcript.summary.keyDiscussionPoints?.map((pt, idx) => (
                      <li key={idx} style={{ lineHeight: 1.6 }}>{pt}</li>
                    ))}
                  </ul>
                </div>

                <div className="mcard" style={{ background: 'var(--color-soft)', padding: '14px 18px', borderLeft: '3px solid var(--color-primary)' }}>
                  <div>
                    <b className="sm" style={{ color: 'var(--color-primary)' }}>Expected Outcomes</b>
                    <p style={{ margin: '4px 0 0', lineHeight: 1.55 }}>
                      {transcript.summary.outcomes}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="muted">Summary is generating or unavailable for this transcript.</p>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: DECISIONS */}
      {activeTab === 'decisions' && (
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px' }}>
              <Scale size={18} color="var(--color-primary)" />
              <h3>Confirmed Decisions</h3>
            </div>
            <span className="tag">Verified with Evidence</span>
          </div>

          <div className="pbody">
            {(!transcript.decisions || transcript.decisions.length === 0) ? (
              <p className="muted">No explicit decisions were recorded in this transcript.</p>
            ) : (
              <div className="stack" style={{ gap: '14px' }}>
                {transcript.decisions.map(d => (
                  <div key={d.id} className="mcard col" style={{ padding: '16px' }}>
                    <div className="between">
                      <b style={{ fontSize: '15px' }}>{d.title}</b>
                      <span className="status-badge processed">Confirmed</span>
                    </div>

                    <p style={{ margin: '4px 0', lineHeight: 1.55 }}>{d.details}</p>

                    {d.evidence && (
                      <div className="evidence-box">
                        <Quote size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div className="grow">
                          <span className="evidence-speaker">
                            {d.evidence.speaker} {d.evidence.timestamp && `(${d.evidence.timestamp})`}:
                          </span>
                          <span className="evidence-quote">"{d.evidence.quote}"</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 3: ACTION ITEMS */}
      {activeTab === 'actions' && (
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px' }}>
              <CheckSquare size={18} color="var(--color-primary)" />
              <h3>Action Items & Human Approval</h3>
            </div>
            <span className="tag">Approval Required</span>
          </div>

          <div className="pbody">
            <div className="muted sm" style={{ marginBottom: '6px' }}>
              AI-extracted tasks require human review before external execution or tool synchronization.
            </div>

            {(!transcript.actionItems || transcript.actionItems.length === 0) ? (
              <p className="muted">No action items were detected in this transcript.</p>
            ) : (
              <div className="stack" style={{ gap: '14px' }}>
                {transcript.actionItems.map(item => {
                  const isEditing = editingActionId === item.id
                  const isPending = item.status === 'Pending Approval'
                  const isApproved = item.status === 'Approved'
                  const isRejected = item.status === 'Rejected'

                  return (
                    <div key={item.id} className="mcard col" style={{ padding: '16px' }}>
                      {/* Top Row: Title, Priority, Status */}
                      <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        {isEditing ? (
                          <input 
                            className="input-field" 
                            style={{ flex: 1, minWidth: '220px' }}
                            value={editForm.title}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                          />
                        ) : (
                          <div className="row" style={{ gap: '8px' }}>
                            <b style={{ fontSize: '15px' }}>{item.title}</b>
                            {item.priority && (
                              <span className={`tag ${item.priority === 'High' ? 'danger-tag' : ''}`}>
                                {item.priority} Priority
                              </span>
                            )}
                          </div>
                        )}

                        <div className="row" style={{ gap: '8px' }}>
                          <span className={`status-badge ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="muted sm" style={{ margin: '4px 0', lineHeight: 1.5 }}>
                        {item.description}
                      </p>

                      {/* Metadata Row: Owner & Deadline with Ambiguity Flags */}
                      <div className="row" style={{ gap: '16px', margin: '6px 0', flexWrap: 'wrap' }}>
                        {/* Owner */}
                        <div className="row" style={{ gap: '6px' }}>
                          <span className="muted sm">Owner:</span>
                          {isEditing ? (
                            <input 
                              className="input-field" 
                              style={{ width: '140px', padding: '4px 8px', height: '30px' }}
                              value={editForm.owner}
                              onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))}
                            />
                          ) : (
                            <span className={item.ownerStatus === 'ambiguous' ? 'warning-flag' : 'confirmed-meta'}>
                              {item.ownerStatus === 'ambiguous' && <AlertTriangle size={12} />}
                              {item.owner}
                            </span>
                          )}
                        </div>

                        {/* Deadline */}
                        <div className="row" style={{ gap: '6px' }}>
                          <span className="muted sm">Deadline:</span>
                          {isEditing ? (
                            <input 
                              type="date"
                              className="input-field" 
                              style={{ width: '140px', padding: '4px 8px', height: '30px' }}
                              value={editForm.deadline !== 'Unspecified' ? editForm.deadline : ''}
                              onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value || 'Unspecified' }))}
                            />
                          ) : (
                            <span className={item.deadlineStatus === 'missing' ? 'warning-flag' : 'confirmed-meta'}>
                              {item.deadlineStatus === 'missing' && <AlertTriangle size={12} />}
                              {item.deadline}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Supporting Transcript Evidence */}
                      {item.evidence && (
                        <div className="evidence-box">
                          <Quote size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div className="grow">
                            <span className="evidence-speaker">
                              Evidence ({item.evidence.speaker} {item.evidence.timestamp ? `at ${item.evidence.timestamp}` : ''}):
                            </span>
                            <span className="evidence-quote">"{item.evidence.quote}"</span>
                          </div>
                        </div>
                      )}

                      {/* Approval Actions Bar */}
                      <div className="between" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '8px' }}>
                        <div className="row">
                          {isEditing ? (
                            <>
                              <button className="btn primary sm" onClick={() => saveEditAction(item.id)}>
                                <Save size={13} /> Save Edits
                              </button>
                              <button className="btn sm" onClick={() => setEditingActionId(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button className="btn sm" onClick={() => startEditAction(item)}>
                              <Edit3 size={13} /> Edit Task
                            </button>
                          )}
                        </div>

                        <div className="row" style={{ gap: '8px' }}>
                          {isPending && (
                            <>
                              <button className="btn sm" style={{ color: 'var(--color-danger)' }} onClick={e => handleReject(item.id, e)}>
                                <X size={14} /> Reject
                              </button>
                              <button className="btn primary sm" onClick={e => handleApprove(item.id, e)}>
                                <Check size={14} /> Approve & Save
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <span className="muted sm" style={{ color: '#16a34a', fontWeight: 600 }}>
                              ✓ Approved for Execution
                            </span>
                          )}

                          {isRejected && (
                            <span className="muted sm" style={{ color: 'var(--color-danger)' }}>
                              ✗ Rejected
                            </span>
                          )}
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

      {/* TAB 4: UNRESOLVED QUESTIONS */}
      {activeTab === 'unresolved' && (
        <section className="panel">
          <div className="phead">
            <div className="row" style={{ gap: '8px' }}>
              <HelpCircle size={18} color="var(--color-primary)" />
              <h3>Unresolved Questions & Ambiguities</h3>
            </div>
            <span className="tag" style={{ color: '#d97706', background: 'rgba(217, 119, 6, 0.1)' }}>
              Requires Follow-Up
            </span>
          </div>

          <div className="pbody">
            <div className="muted sm" style={{ marginBottom: '6px' }}>
              These items were flagged because an owner was not established, deadlines were ambiguous, or questions went unanswered.
            </div>

            {(!transcript.unresolvedQuestions || transcript.unresolvedQuestions.length === 0) ? (
              <p className="muted">No unresolved questions or ambiguities detected.</p>
            ) : (
              <div className="stack" style={{ gap: '12px' }}>
                {transcript.unresolvedQuestions.map(u => (
                  <div key={u.id} className="mcard col" style={{ padding: '16px', borderLeft: '3px solid #d97706' }}>
                    <div className="between">
                      <b style={{ fontSize: '14.5px' }}>{u.title}</b>
                      <span className="source-badge" style={{ borderColor: '#d97706', color: '#d97706' }}>
                        {u.category}
                      </span>
                    </div>

                    <p style={{ margin: '4px 0', lineHeight: 1.55 }}>{u.description}</p>

                    {u.evidence && (
                      <div className="evidence-box">
                        <Quote size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span className="evidence-quote">{u.evidence}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 5: TRANSCRIPT VIEWER */}
      {activeTab === 'transcript' && (
        <section className="panel">
          <div className="phead" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div className="row" style={{ gap: '8px' }}>
              <FileText size={18} color="var(--color-primary)" />
              <h3>Original Meeting Transcript</h3>
            </div>

            <div className="row" style={{ gap: '8px' }}>
              <div className="search" style={{ height: '36px', width: '240px' }}>
                <Search size={14} />
                <input
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  placeholder="Search speaker or text..."
                  aria-label="Search within transcript"
                />
                {transcriptSearch && (
                  <button 
                    className="muted sm" 
                    style={{ background: 'none', border: 0, cursor: 'pointer' }}
                    onClick={() => setTranscriptSearch('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button className="btn sm" onClick={handleExportPDF} title="Download transcript and summary as PDF">
                <Download size={14} />
                <span className="hide-sm">Download PDF</span>
              </button>
            </div>
          </div>

          <div className="pbody" style={{ maxHeight: '680px', overflowY: 'auto' }}>
            {parsedTurns.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                No dialogue matches "{transcriptSearch}".
              </p>
            ) : (
              <div className="stack" style={{ gap: '12px' }}>
                {parsedTurns.map((turn, idx) => (
                  <div key={idx} className="line" style={{ gap: '12px', alignItems: 'flex-start' }}>
                    <span className="avatar sm" style={{ marginTop: '2px' }}>
                      {turn.speaker.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="grow">
                      <div className="row" style={{ gap: '6px', marginBottom: '3px' }}>
                        <b className="sm">{turn.speaker}</b>
                        {turn.time && <span className="muted sm" style={{ fontSize: '11px' }}>{turn.time}</span>}
                      </div>
                      <div className="transcript-bubble">
                        <p style={{ margin: 0, lineHeight: 1.6 }}>{turn.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
