import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Sparkles,
  Search,
  RefreshCw,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Calendar
} from 'lucide-react'
import { api } from '../../services/api.js'

export default function TeamLeadTranscripts() {
  const [transcripts, setTranscripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const loadTranscripts = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getTeamLeadTranscripts()
      setTranscripts(res.transcripts || [])
    } catch (err) {
      setError(err.message || 'Failed to load team transcripts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTranscripts()
  }, [])

  const filtered = transcripts.filter(t =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.summary?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Team Meeting Transcripts & AI Intelligence
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Review verbatim transcripts, AI generated summaries, and action items from team meetings.
          </p>
        </div>

        <button className="btn" onClick={loadTranscripts} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
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

      {/* Search Bar */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--color-soft)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          padding: '0 12px',
          height: '38px',
          width: '320px'
        }}>
          <Search size={15} className="muted" />
          <input
            type="text"
            placeholder="Search transcripts by title or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 0, background: 'none', outline: 0, flex: 1, fontSize: '13px', color: 'var(--color-text)' }}
          />
        </div>

        <div className="muted" style={{ fontSize: '13px' }}>
          Team Transcripts: <strong>{transcripts.length}</strong>
        </div>
      </div>

      {/* Transcripts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filtered.length === 0 ? (
          <div style={{
            background: 'var(--color-surface-glass)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--color-muted)'
          }}>
            <FileText size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', color: 'var(--color-text)' }}>No Team Transcripts Found</h3>
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {search ? 'No transcripts match your search term.' : 'Completed team meetings will appear here with automated transcripts.'}
            </p>
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              style={{
                background: 'var(--color-surface-glass)',
                backdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--color-border)',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {t.title}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'flex', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} />
                        {t.uploaded_at ? new Date(t.uploaded_at).toLocaleDateString() : 'Recent'}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} />
                        {t.duration || '25 min'}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/team-lead/analysis?id=${t.id}`}
                  className="btn"
                  style={{
                    fontSize: '12.5px',
                    height: '32px',
                    color: '#22d3ee',
                    borderColor: 'rgba(6, 182, 212, 0.35)',
                    background: 'rgba(6, 182, 212, 0.08)'
                  }}
                >
                  <Sparkles size={14} />
                  <span>View Decisions & Analysis</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {t.summary && (
                <p style={{
                  margin: 0,
                  fontSize: '13.5px',
                  color: 'var(--color-muted)',
                  lineHeight: '1.5',
                  background: 'var(--color-soft)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)'
                }}>
                  {t.summary}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
