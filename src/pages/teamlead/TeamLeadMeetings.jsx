import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Users,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Play
} from 'lucide-react'
import { api } from '../../services/api.js'
import Modal from '../../components/Modal.jsx'

export default function TeamLeadMeetings() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')

  // Create Meeting Modal
  const [createModal, setCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState([])
  const [creating, setCreating] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [meetingsRes, teamRes] = await Promise.all([
        api.getTeamLeadMeetings(),
        api.getTeamLeadTeam()
      ])
      setMeetings(meetingsRes.meetings || [])
      setTeamMembers(teamRes.members || [])
    } catch (err) {
      setError(err.message || 'Failed to load team meetings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreateModal = () => {
    setTitle('')
    setScheduledAt('')
    // Default select all team members
    setSelectedParticipants(teamMembers.map(m => m.user_id))
    setCreateModal(true)
  }

  const toggleParticipant = (userId) => {
    setSelectedParticipants(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleCreateMeeting = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Meeting title is required.')
      return
    }
    setCreating(true)
    setError('')
    setSuccessMsg('')
    try {
      await api.createTeamLeadMeeting({
        title: title.trim(),
        scheduled_at: scheduledAt || null,
        participant_ids: selectedParticipants
      })
      setSuccessMsg(`Team meeting "${title}" created successfully.`)
      setCreateModal(false)
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to schedule team meeting.')
    } finally {
      setCreating(false)
    }
  }

  const filteredMeetings = meetings.filter(m =>
    m.title?.toLowerCase().includes(search.toLowerCase()) ||
    m.status?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Team Meetings & Live Rooms
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Schedule and launch meetings for your authorized team members using LiveKit.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="btn primary"
            onClick={handleOpenCreateModal}
            style={{ background: '#0891b2', borderColor: '#0891b2' }}
          >
            <Plus size={15} />
            <span>Schedule Team Meeting</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          color: '#4ade80',
          borderRadius: '10px',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={17} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 0, color: 'inherit', padding: 4 }}>
            <X size={15} />
          </button>
        </div>
      )}

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
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 0, color: 'inherit', padding: 4 }}>
            <X size={15} />
          </button>
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
            placeholder="Search meetings by title or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 0, background: 'none', outline: 0, flex: 1, fontSize: '13px', color: 'var(--color-text)' }}
          />
        </div>

        <div className="muted" style={{ fontSize: '13px' }}>
          Team Meetings Count: <strong>{meetings.length}</strong>
        </div>
      </div>

      {/* Meetings Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '16px'
      }}>
        {filteredMeetings.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            background: 'var(--color-surface-glass)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--color-muted)'
          }}>
            <Video size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', color: 'var(--color-text)' }}>No Team Meetings Found</h3>
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {search ? 'No meetings matched your search query.' : 'No meetings have been scheduled for your team yet.'}
            </p>
          </div>
        ) : (
          filteredMeetings.map((m) => {
            const isCompleted = m.status === 'completed'
            const isLive = m.status === 'live'

            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--color-surface-glass)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  border: '1px solid var(--color-border)',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {m.title}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} />
                      <span>{m.scheduledAt || m.scheduled_at ? new Date(m.scheduledAt || m.scheduled_at).toLocaleString() : 'Scheduled'}</span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: isCompleted ? 'rgba(34, 197, 94, 0.12)' : isLive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                    color: isCompleted ? '#4ade80' : isLive ? '#f87171' : '#60a5fa',
                    textTransform: 'capitalize'
                  }}>
                    {m.status}
                  </span>
                </div>

                {/* Participants preview */}
                <div style={{
                  background: 'var(--color-soft)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Users size={14} className="muted" />
                  <span className="muted">Participants:</span>
                  <strong style={{ color: 'var(--color-text)' }}>
                    {m.participants && m.participants.length > 0 ? (
                      m.participants.map(p => p.name).join(', ')
                    ) : (
                      `${m.participantCount ?? m.participant_count ?? 1} assigned`
                    )}
                  </strong>
                </div>

                {/* Action Button */}
                <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', gap: '10px' }}>
                  <button
                    className="btn primary"
                    style={{ flex: 1, justifyContent: 'center', background: '#0891b2', borderColor: '#0891b2' }}
                    onClick={() => navigate(`/meetings/${m.id}/live`)}
                  >
                    <Play size={14} />
                    <span>Join LiveKit Room</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Schedule Meeting Modal */}
      {createModal && (
        <Modal title="Schedule Team Meeting" onClose={() => setCreateModal(false)}>
          <form onSubmit={handleCreateMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Meeting Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Weekly Engineering Sync, Sprint Planning"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-soft)',
                  color: 'var(--color-text)',
                  padding: '0 12px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-soft)',
                  color: 'var(--color-text)',
                  padding: '0 12px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* Team Members Multi-select */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Select Team Participants ({selectedParticipants.length} selected)
              </label>
              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                background: 'var(--color-soft)',
                padding: '8px'
              }}>
                {teamMembers.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-muted)' }}>
                    No members in team roster.
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <label
                      key={member.user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(member.user_id)}
                        onChange={() => toggleParticipant(member.user_id)}
                      />
                      <span>{member.name}</span>
                      <span className="muted" style={{ fontSize: '11.5px' }}>({member.email})</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="btn" onClick={() => setCreateModal(false)} disabled={creating}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={creating || !title.trim()}
                style={{ background: '#0891b2', borderColor: '#0891b2' }}
              >
                {creating ? 'Scheduling...' : 'Create Meeting'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
