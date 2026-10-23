import { useState, useEffect } from 'react'
import {
  UsersRound,
  Plus,
  Search,
  UserPlus,
  Trash2,
  Edit2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  UserCheck,
  Briefcase,
  Calendar,
  Layers
} from 'lucide-react'
import { api } from '../../services/api.js'
import Modal from '../../components/Modal.jsx'

export default function AdminTeams() {
  const [teams, setTeams] = useState([])
  const [eligibleLeads, setEligibleLeads] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')

  // Create / Edit Team Modal
  const [teamModal, setTeamModal] = useState(null) // null or { mode: 'create'|'edit', team }
  const [teamForm, setTeamForm] = useState({ name: '', description: '', lead_id: '' })
  const [savingTeam, setSavingTeam] = useState(false)

  // Manage Team Members Modal
  const [memberModal, setMemberModal] = useState(null) // null or { team, members: [] }
  const [memberLoading, setMemberLoading] = useState(false)
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Delete Confirm Modal
  const [deleteModal, setDeleteModal] = useState(null) // null or team
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [teamsRes, leadsRes, usersRes] = await Promise.all([
        api.getAdminTeams(),
        api.getEligibleLeads(),
        api.getAdminUsers()
      ])
      setTeams(teamsRes.teams || [])
      setEligibleLeads(leadsRes.leads || [])
      setAllUsers(usersRes.users || [])
    } catch (err) {
      setError(err.message || 'Failed to load teams data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreateModal = () => {
    setTeamForm({ name: '', description: '', lead_id: eligibleLeads[0]?.id || '' })
    setTeamModal({ mode: 'create' })
  }

  const handleOpenEditModal = (team) => {
    setTeamForm({
      name: team.name,
      description: team.description || '',
      lead_id: team.lead_id || ''
    })
    setTeamModal({ mode: 'edit', team })
  }

  const handleSaveTeam = async (e) => {
    e.preventDefault()
    if (!teamForm.name.trim()) {
      setError('Team name is required.')
      return
    }
    setSavingTeam(true)
    setError('')
    setSuccessMsg('')
    try {
      if (teamModal.mode === 'create') {
        await api.createAdminTeam(teamForm)
        setSuccessMsg(`Team "${teamForm.name}" created successfully.`)
      } else {
        await api.updateAdminTeam(teamModal.team.id, teamForm)
        setSuccessMsg(`Team "${teamForm.name}" updated successfully.`)
      }
      setTeamModal(null)
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to save team.')
    } finally {
      setSavingTeam(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!deleteModal) return
    setDeleting(true)
    setError('')
    setSuccessMsg('')
    try {
      await api.deleteAdminTeam(deleteModal.id)
      setSuccessMsg(`Team "${deleteModal.name}" deleted.`)
      setDeleteModal(null)
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to delete team.')
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenMembersModal = async (team) => {
    setMemberModal({ team, members: [] })
    setMemberLoading(true)
    setSelectedUserToAdd('')
    try {
      const res = await api.getTeamMembers(team.id)
      setMemberModal({ team, members: res.members || [] })
    } catch (err) {
      setError(err.message || 'Failed to load team members.')
    } finally {
      setMemberLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedUserToAdd || !memberModal) return
    setAddingMember(true)
    setError('')
    try {
      await api.addTeamMember(memberModal.team.id, { user_id: selectedUserToAdd, role: 'member' })
      const res = await api.getTeamMembers(memberModal.team.id)
      setMemberModal(prev => ({ ...prev, members: res.members || [] }))
      setSelectedUserToAdd('')
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to add member.')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!memberModal) return
    setError('')
    try {
      await api.removeTeamMember(memberModal.team.id, userId)
      setMemberModal(prev => ({
        ...prev,
        members: prev.members.filter(m => m.user_id !== userId)
      }))
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to remove member.')
    }
  }

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.lead_name && t.lead_name.toLowerCase().includes(search.toLowerCase())) ||
    (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Page Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Team Management
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Create teams, assign designated Team Leads, and manage organizational member assignments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn primary" onClick={handleOpenCreateModal}>
            <Plus size={16} />
            <span>Create New Team</span>
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
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
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
          flex: 1,
          maxWidth: '400px'
        }}>
          <Search size={15} className="muted" />
          <input
            type="text"
            placeholder="Search teams by name or lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 0, background: 'none', outline: 0, flex: 1, fontSize: '13px', color: 'var(--color-text)' }}
          />
        </div>
        <div className="muted" style={{ fontSize: '13px', marginLeft: 'auto' }}>
          Total Teams: <strong>{teams.length}</strong>
        </div>
      </div>

      {/* Teams Grid / Table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {filteredTeams.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            background: 'var(--color-surface-glass)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--color-muted)'
          }}>
            <UsersRound size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', color: 'var(--color-text)' }}>No Teams Found</h3>
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {search ? 'No teams match your search criteria.' : 'No teams have been created yet. Click "Create New Team" to get started.'}
            </p>
          </div>
        ) : (
          filteredTeams.map((team) => (
            <div
              key={team.id}
              style={{
                background: 'var(--color-surface-glass)',
                backdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--color-border)',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                transition: 'transform 150ms ease, border-color 150ms ease'
              }}
            >
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--color-primary)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '15px'
                  }}>
                    {team.name[0]?.toUpperCase() || 'T'}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {team.name}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                      Created {team.created_at ? new Date(team.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn"
                    style={{ padding: '6px', height: '32px', width: '32px' }}
                    onClick={() => handleOpenEditModal(team)}
                    title="Edit Team"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn"
                    style={{ padding: '6px', height: '32px', width: '32px', color: 'var(--color-danger)' }}
                    onClick={() => setDeleteModal(team)}
                    title="Delete Team"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {team.description && (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-muted)', lineHeight: '1.4' }}>
                  {team.description}
                </p>
              )}

              {/* Team Lead Info */}
              <div style={{
                background: 'var(--color-soft)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12.5px'
              }}>
                <span className="muted">Assigned Team Lead:</span>
                {team.lead_name ? (
                  <span style={{ fontWeight: 600, color: '#22d3ee', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={14} />
                    {team.lead_name}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>Unassigned</span>
                )}
              </div>

              {/* Stats & Members Button */}
              <div className="between" style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', gap: '14px', fontSize: '12.5px', color: 'var(--color-muted)' }}>
                  <span><strong>{team.member_count || 0}</strong> Members</span>
                  <span><strong>{team.meeting_count || 0}</strong> Meetings</span>
                </div>
                <button
                  className="btn"
                  style={{ fontSize: '12px', height: '30px', padding: '0 10px' }}
                  onClick={() => handleOpenMembersModal(team)}
                >
                  <UsersRound size={13} />
                  <span>Roster</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Team Modal */}
      {teamModal && (
        <Modal
          title={teamModal.mode === 'create' ? 'Create New Team' : 'Edit Team Details'}
          onClose={() => setTeamModal(null)}
        >
          <form onSubmit={handleSaveTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Team Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Frontend Engineering, Product Core"
                value={teamForm.name}
                onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
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
                Description
              </label>
              <textarea
                placeholder="Brief purpose or mission of this team..."
                value={teamForm.description}
                onChange={(e) => setTeamForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-soft)',
                  color: 'var(--color-text)',
                  padding: '10px 12px',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Designated Team Lead
              </label>
              <select
                value={teamForm.lead_id}
                onChange={(e) => setTeamForm(prev => ({ ...prev, lead_id: e.target.value }))}
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
                <option value="">-- No Lead Assigned --</option>
                {eligibleLeads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} ({lead.email}) {lead.role === 'team_lead' ? '★' : ''}
                  </option>
                ))}
              </select>
              <span className="muted" style={{ fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                Users with Team Lead or Admin role can lead a team.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="btn" onClick={() => setTeamModal(null)} disabled={savingTeam}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={savingTeam}>
                {savingTeam ? 'Saving...' : teamModal.mode === 'create' ? 'Create Team' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manage Members Modal */}
      {memberModal && (
        <Modal
          title={`Team Members — ${memberModal.team.name}`}
          onClose={() => setMemberModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Add Member Row */}
            <div style={{
              display: 'flex',
              gap: '10px',
              background: 'var(--color-soft)',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--color-border)'
            }}>
              <select
                value={selectedUserToAdd}
                onChange={(e) => setSelectedUserToAdd(e.target.value)}
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-background)',
                  color: 'var(--color-text)',
                  padding: '0 10px',
                  fontSize: '13px'
                }}
              >
                <option value="">Select registered user to add...</option>
                {allUsers
                  .filter(u => !memberModal.members.some(m => (m.userId || m.user_id || m.id) === u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) — {u.role}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn primary"
                onClick={handleAddMember}
                disabled={!selectedUserToAdd || addingMember}
                style={{ height: '36px' }}
              >
                <UserPlus size={14} />
                <span>{addingMember ? 'Adding...' : 'Add'}</span>
              </button>
            </div>

            {/* Members List */}
            {memberLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>
                Loading roster...
              </div>
            ) : memberModal.members.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
                No members currently assigned to this team.
              </div>
            ) : (
              <div style={{
                maxHeight: '320px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {memberModal.members.map((m) => {
                  const mId = m.userId || m.user_id || m.id
                  const isLead = (memberModal.team.leadId || memberModal.team.lead_id) === mId

                  return (
                    <div
                      key={mId}
                      className="between"
                      style={{
                        padding: '10px 14px',
                        background: 'var(--color-soft)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {m.name}
                          {isLead && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#22d3ee',
                              background: 'rgba(6, 182, 212, 0.15)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              LEAD
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{m.email}</div>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleRemoveMember(mId)}
                        style={{ padding: '4px 8px', height: '28px', color: 'var(--color-danger)' }}
                        title="Remove from team"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn" onClick={() => setMemberModal(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Team Confirmation Modal */}
      {deleteModal && (
        <Modal title="Delete Team" onClose={() => setDeleteModal(null)}>
          <p style={{ margin: '0 0 16px', fontSize: '13.5px' }}>
            Are you sure you want to delete the team <strong>{deleteModal.name}</strong>?
            Members will not be deleted, but will be unassigned from this team.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn" onClick={() => setDeleteModal(null)} disabled={deleting}>
              Cancel
            </button>
            <button className="btn danger" onClick={handleDeleteTeam} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Team'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
