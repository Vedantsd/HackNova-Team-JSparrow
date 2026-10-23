import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Sparkles,
  FileText,
  CheckCircle2,
  HelpCircle,
  CheckSquare,
  Clock,
  Calendar,
  AlertCircle,
  RefreshCw,
  ArrowLeft
} from 'lucide-react'
import { api } from '../../services/api.js'

export default function TeamLeadAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentId = searchParams.get('id')

  const [transcripts, setTranscripts] = useState([])
  const [selectedTranscript, setSelectedTranscript] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTranscriptList()
  }, [])

  const loadTranscriptList = async () => {
    setLoadingList(true)
    setError('')
    try {
      const res = await api.getTeamLeadTranscripts()
      const list = res.transcripts || []
      setTranscripts(list)

      if (list.length > 0) {
        const targetId = currentId || list[0].id
        loadAnalysisFor(targetId)
      }
    } catch (err) {
      setError(err.message || 'Failed to load team transcripts.')
    } finally {
      setLoadingList(false)
    }
  }

  const loadAnalysisFor = async (transcriptId) => {
    setLoadingAnalysis(true)
    setError('')
    try {
      const res = await api.getTeamLeadTranscriptAnalysis(transcriptId)
      setSelectedTranscript(res.transcript)
      setAnalysis(res.analysis || {})
      setSearchParams({ id: transcriptId })
    } catch (err) {
      setError(err.message || 'Failed to load analysis for transcript.')
    } finally {
      setLoadingAnalysis(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link to="/team-lead/transcripts" className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '13px' }}>
              <ArrowLeft size={14} />
              <span>Transcripts</span>
            </Link>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            Meeting Intelligence & Decisions
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13.5px' }}>
            Authorized AI extraction of meeting decisions, open questions, and deliverables.
          </p>
        </div>

        {/* Meeting Transcript Selector */}
        {transcripts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="muted" style={{ fontSize: '13px' }}>Meeting:</span>
            <select
              value={selectedTranscript?.id || ''}
              onChange={(e) => loadAnalysisFor(e.target.value)}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-soft)',
                color: 'var(--color-text)',
                padding: '0 12px',
                fontSize: '13px',
                maxWidth: '260px'
              }}
            >
              {transcripts.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#ef4444',
          borderRadius: '10px',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loadingList || loadingAnalysis ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '40vh', color: 'var(--color-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <RefreshCw size={26} className="spin" style={{ color: '#06b6d4', margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: '13.5px' }}>Loading meeting intelligence...</p>
          </div>
        </div>
      ) : !selectedTranscript ? (
        <div style={{
          background: 'var(--color-surface-glass)',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--color-muted)'
        }}>
          <FileText size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', color: 'var(--color-text)' }}>No Transcripts Available</h3>
          <p style={{ margin: 0, fontSize: '13.5px' }}>
            Run a team meeting or upload a transcript to view decisions and analysis.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Executive Summary Card */}
          <div style={{
            background: 'var(--color-surface-glass)',
            backdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '22px',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={18} style={{ color: '#06b6d4' }} />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                Executive Summary
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text)' }}>
              {selectedTranscript.summary || 'Summary generation is in progress or not yet available.'}
            </p>
          </div>

          {/* Grid: Decisions and Questions */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px'
          }}>
            {/* Key Decisions */}
            <div style={{
              background: 'var(--color-surface-glass)',
              backdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={17} style={{ color: '#4ade80' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                  Key Decisions Reached
                </h3>
              </div>

              {(!analysis.decisions || analysis.decisions.length === 0) ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
                  No explicit decisions recorded for this session.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {analysis.decisions.map((dec, i) => (
                    <li key={i} style={{ fontSize: '13.5px', color: 'var(--color-text)', lineHeight: '1.4' }}>
                      {typeof dec === 'string' ? dec : dec.decision || dec.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Unresolved Questions */}
            <div style={{
              background: 'var(--color-surface-glass)',
              backdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={17} style={{ color: '#facc15' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                  Unresolved Questions & Follow-ups
                </h3>
              </div>

              {(!analysis.unresolvedQuestions || analysis.unresolvedQuestions.length === 0) ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
                  No open or unresolved questions noted.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {analysis.unresolvedQuestions.map((q, i) => (
                    <li key={i} style={{ fontSize: '13.5px', color: 'var(--color-text)', lineHeight: '1.4' }}>
                      {typeof q === 'string' ? q : q.question || q.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Extracted Action Items */}
          <div style={{
            background: 'var(--color-surface-glass)',
            backdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div className="between">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={17} style={{ color: '#06b6d4' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                  Action Items Captured
                </h3>
              </div>
              <Link to="/team-lead/action-items" style={{ fontSize: '12.5px', color: '#22d3ee', textDecoration: 'none' }}>
                Manage in Action Items Board →
              </Link>
            </div>

            {(!analysis.actionItems || analysis.actionItems.length === 0) ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
                No action items tracked in this session.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analysis.actionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="between"
                    style={{
                      padding: '10px 14px',
                      background: 'var(--color-soft)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                      {item.title}
                    </span>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-muted)' }}>
                      <span>Assignee: <strong>{item.owner || item.assignee_name || 'Unassigned'}</strong></span>
                      {item.due_date && <span>Due: {item.due_date}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
