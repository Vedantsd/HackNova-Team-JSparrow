import { useState, useEffect } from 'react'
import { 
  Video, 
  FileText, 
  RefreshCw, 
  Search, 
  Eye, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Calendar, 
  Clock, 
  ShieldAlert,
  X
} from 'lucide-react'
import { api } from '../../services/api.js'
import Modal from '../../components/Modal.jsx'

export default function AdminMeetings() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Investigation Modal
  const [investigatingMeetingId, setInvestigatingMeetingId] = useState(null)
  const [investigatedData, setInvestigatedData] = useState(null)
  const [investigatingLoading, setInvestigatingLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(null) // meeting to investigate

  const loadMeetings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getAdminMeetings()
      setMeetings(res.meetings || [])
    } catch (err) {
      setError(err.message || 'Failed to load platform meetings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMeetings()
  }, [])

  const handleConfirmInvestigation = async (meeting) => {
    setShowConfirmModal(null)
    setInvestigatingMeetingId(meeting.id)
    setInvestigatingLoading(true)
    try {
      const details = await api.investigateMeeting(meeting.id)
      setInvestigatedData(details)
    } catch (err) {
      setError(err.message || 'Failed to inspect meeting content.')
      setInvestigatingMeetingId(null)
    } finally {
      setInvestigatingLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Title */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Meeting Oversight & Metadata
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Authorized metadata inspection and controlled administrative compliance review.
          </p>
        </div>
        <button className="btn" onClick={loadMeetings} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Meetings</span>
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#ef4444',
          borderRadius: '10px',
          fontSize: '13.5px'
        }}>
          {error}
        </div>
      )}

      {/* Meetings Table */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{
                background: 'var(--color-soft)',
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <th style={{ padding: '12px 18px' }}>Meeting / Title</th>
                <th style={{ padding: '12px 16px' }}>Creator</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Duration</th>
                <th style={{ padding: '12px 16px' }}>Tasks</th>
                <th style={{ padding: '12px 16px' }}>Uploaded</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Controlled Review</th>
              </tr>
            </thead>
            <tbody>
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--color-muted)' }}>
                    {loading ? 'Loading meeting records...' : 'No platform meetings found.'}
                  </td>
                </tr>
              ) : (
                meetings.map((m) => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 150ms ease'
                    }}
                  >
                    {/* Meeting Title */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(99, 102, 241, 0.14)',
                          color: 'var(--color-primary)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}>
                          <Video size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{m.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                            {m.filename || 'Direct Meeting'} • {m.fileSize || 'Standard'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Creator */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>{m.creatorName}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>{m.creatorEmail}</div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: m.status === 'Processed' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                        color: m.status === 'Processed' ? '#4ade80' : '#facc15',
                        border: `1px solid ${m.status === 'Processed' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(234, 179, 8, 0.35)'}`
                      }}>
                        {m.status}
                      </span>
                    </td>

                    {/* Duration */}
                    <td style={{ padding: '14px 16px', color: 'var(--color-muted)' }}>
                      {m.duration || '25 min'}
                    </td>

                    {/* Tasks count */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 600 }}>{m.actionItemsCount || 0}</span>
                      <span className="muted" style={{ fontSize: '11.5px' }}> items</span>
                    </td>

                    {/* Uploaded */}
                    <td style={{ padding: '14px 16px', color: 'var(--color-muted)', fontSize: '12.5px' }}>
                      {m.uploadedAt || 'N/A'}
                    </td>

                    {/* Controlled Review Button */}
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                        onClick={() => setShowConfirmModal(m)}
                        title="Investigate sensitive content with audit logging"
                      >
                        <Eye size={13} />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal before accessing sensitive meeting content */}
      {showConfirmModal && (
        <Modal
          title="Administrative Investigation Authorization"
          onClose={() => setShowConfirmModal(null)}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', margin: '8px 0 16px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.16)',
              color: 'var(--color-primary)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
                Audited Sensitive Content Access
              </p>
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                You are about to inspect private meeting content for <strong>"{showConfirmModal.title}"</strong> created by <strong>{showConfirmModal.creatorEmail}</strong>.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--color-muted)' }}>
                This access is permitted solely for legitimate support or compliance purposes and will be logged into the immutable database audit trail.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button className="btn" onClick={() => setShowConfirmModal(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => handleConfirmInvestigation(showConfirmModal)}
            >
              Confirm & Access (Logged)
            </button>
          </div>
        </Modal>
      )}

      {/* Investigated Details Modal */}
      {investigatedData && (
        <Modal
          title={`Investigation: ${investigatedData.title}`}
          onClose={() => { setInvestigatedData(null); setInvestigatingMeetingId(null); }}
        >
          <div style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Metadata banner */}
            <div style={{
              padding: '12px',
              background: 'var(--color-soft)',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              fontSize: '12.5px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '10px'
            }}>
              <div><strong>Meeting ID:</strong> {investigatedData.id}</div>
              <div><strong>Duration:</strong> {investigatedData.duration}</div>
              <div><strong>Status:</strong> {investigatedData.status}</div>
              <div><strong>File:</strong> {investigatedData.filename}</div>
            </div>

            {/* AI Summary */}
            {investigatedData.summary && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>AI Overview Summary</h3>
                <p style={{ fontSize: '13px', lineHeight: 1.6, margin: 0, color: 'var(--color-text)' }}>
                  {investigatedData.summary.overview}
                </p>
              </div>
            )}

            {/* Raw Transcript */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>Raw Transcript Text</h3>
              <pre style={{
                background: 'var(--color-soft)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                maxHeight: '260px',
                overflowY: 'auto',
                margin: 0,
                color: 'var(--color-text)'
              }}>
                {investigatedData.transcriptText || 'No transcript text available.'}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
