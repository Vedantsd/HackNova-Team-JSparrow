import { useState, useEffect } from 'react'
import {
  UsersRound,
  UserPlus,
  Trash2,
  Search,
  RefreshCw,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  UserCheck
} from 'lucide-react'
import { api } from '../../services/api.js'
import Modal from '../../components/Modal.jsx'

export default function TeamLeadTeam() {
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [availableUsers, setAvailableUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')

  // Add Member Modal State
  const [addModal, setAddModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [adding, setAdding] = useState(false)

  // Remove Member Confirm Modal
  const [removeModal, setRemoveModal] = useState(null) // member object
  const [removing, setRemoving] = useState(false)

  const loadTeamData = async () => {
    setLoading(true)
    setError('')
    try {
      const [teamRes, availRes] = await Promise.all([
        api.getTeamLeadTeam(),
        api.getTeamLeadAvailableUsers()
      ])
      setTeam(teamRes.team)
      setMembers(teamRes.members || [])
      setAvailableUsers(availRes.users || [])
    } catch (err) {
      setError(err.message || 'Failed to load team data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeamData()
  }, [])

  const handleAddMember = async (e) => {
    e.preventDefault()
    if (!selectedUserId) return
    setAdding(true)
    setError('')
    setSuccessMsg('')
    try {
      await api.addTeamLeadMember({ user_id: selectedUserId, role: 'member' })
      setSuccessMsg('Team member added successfully.')
      setAddModal(false)
      setSelectedUserId('')
      loadTeamData()
    } catch (err) {
      setError(err.message || 'Failed to add member to team.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!removeModal) return
    setRemoving(true)
    setError('')
    setSuccessMsg('')
    try {
      await api.removeTeamLeadMember(removeModal.user_id)
      setSuccessMsg(`Removed ${removeModal.name} from team.`)
      setRemoveModal(null)
      loadTeamData()
    } catch (err) {
      setError(err.message || 'Failed to remove member from team.')
    } finally {
      setRemoving(false)
    }
  }

  const filteredMembers = members.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Page Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            My Team Members
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            {team ? `Managing roster for ${team.name}` : 'Inspect and coordinate your assigned team members.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={loadTeamData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="btn primary"
            onClick={() => setAddModal(true)}
            style={{ background: '#0891b2', borderColor: '#0891b2' }}
          >
            <UserPlus size={15} />
            <span>Add Member</span>
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

      {/* Search & Stats Bar */}
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
            placeholder="Search members by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 0, background: 'none', outline: 0, flex: 1, fontSize: '13px', color: 'var(--color-text)' }}
          />
        </div>

        <div className="muted" style={{ fontSize: '13px' }}>
          Total Team Members: <strong>{members.length}</strong>
        </div>
      </div>

      {/* Members Table */}
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
                <th style={{ padding: '12px 18px' }}>Member</th>
                <th style={{ padding: '12px 16px' }}>Team Role</th>
                <th style={{ padding: '12px 16px' }}>Joined Date</th>
                <th style={{ padding: '12px 16px' }}>Meetings Attended</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--color-muted)' }}>
                    {loading ? 'Loading team roster...' : search ? 'No members match search query.' : 'No members currently in your team.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const memberId = m.userId || m.user_id || m.id
                  const leadId = team?.leadId || team?.lead_id
                  const isLead = Boolean(leadId && memberId && memberId === leadId)
                  const joinedDate = m.joinedAt || m.joined_at || 'Recently'
                  const attendedCount = m.teamMeetingsAttended ?? m.meetings_attended ?? 0
                  const roleName = m.teamRole || m.role || (isLead ? 'Lead' : 'Member')

                  return (
                    <tr
                      key={memberId}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 150ms ease'
                      }}
                    >
                      {/* Name & Email */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: isLead ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'var(--color-soft)',
                            color: isLead ? '#fff' : 'var(--color-primary)',
                            border: '1px solid var(--color-border)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                            flexShrink: 0
                          }}>
                            {m.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{m.name}</span>
                              {isLead && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  background: 'rgba(6, 182, 212, 0.15)',
                                  color: '#22d3ee',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  LEAD
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{m.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Team Role */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isLead ? 'rgba(6, 182, 212, 0.15)' : 'var(--color-soft)',
                          color: isLead ? '#22d3ee' : 'var(--color-muted)',
                          border: `1px solid ${isLead ? 'rgba(6, 182, 212, 0.35)' : 'var(--color-border)'}`
                        }}>
                          {isLead ? <UserCheck size={12} /> : <Shield size={12} />}
                          <span style={{ textTransform: 'capitalize' }}>{roleName}</span>
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-muted)', fontSize: '12.5px' }}>
                        {joinedDate}
                      </td>

                      {/* Meetings Attended */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-muted)' }}>
                        {attendedCount}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        {isLead ? (
                          <span className="muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>Team Leader</span>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '4px 8px', height: '28px', color: 'var(--color-danger)', fontSize: '11.5px' }}
                            onClick={() => setRemoveModal(m)}
                            title="Remove from team"
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {addModal && (
        <Modal title={`Add Member to ${team?.name || 'Team'}`} onClose={() => setAddModal(false)}>
          <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              Select a registered user to assign to your team.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Select User *
              </label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-soft)',
                  color: 'var(--color-text)',
                  padding: '0 10px',
                  fontSize: '13px'
                }}
              >
                <option value="">-- Choose registered user --</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {availableUsers.length === 0 && (
                <span className="muted" style={{ fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  All available users are already assigned to teams.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="btn" onClick={() => setAddModal(false)} disabled={adding}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={!selectedUserId || adding}
                style={{ background: '#0891b2', borderColor: '#0891b2' }}
              >
                {adding ? 'Adding...' : 'Add to Team'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Remove Member Confirmation Modal */}
      {removeModal && (
        <Modal title="Remove Team Member" onClose={() => setRemoveModal(null)}>
          <p style={{ margin: '0 0 16px', fontSize: '13.5px' }}>
            Are you sure you want to remove <strong>{removeModal.name}</strong> ({removeModal.email}) from the team?
            Their account will remain intact, but they will no longer participate in this team's meetings.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn" onClick={() => setRemoveModal(null)} disabled={removing}>
              Cancel
            </button>
            <button className="btn danger" onClick={handleRemoveMember} disabled={removing}>
              {removing ? 'Removing...' : 'Remove Member'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
