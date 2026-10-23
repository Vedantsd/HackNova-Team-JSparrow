import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HelpCircle,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  MessageSquare,
  FileText,
  ExternalLink,
  Plus,
  Search,
  Filter,
  Check,
  RotateCcw,
  Calendar,
  Sparkles,
  Loader2
} from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'

export default function FollowUps({ isTeamLead = false }) {
  const { user } = useAuth()
  const nav = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'pending' | 'clarification' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('')
  const [activeUsers, setActiveUsers] = useState([])

  // Resolution Modal State
  const [selectedItem, setSelectedItem] = useState(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [assignedOwnerId, setAssignedOwnerId] = useState('')
  const [targetDeadline, setTargetDeadline] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  // New Follow-Up Item Modal State
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('Follow-up Action')
  const [newDescription, setNewDescription] = useState('')
  const [newTranscriptId, setNewTranscriptId] = useState('')
  const [availableTranscripts, setAvailableTranscripts] = useState([])

  const loadData = async () => {
    setLoading(true)
    try {
      const [questionsList, usersList, transcriptsList] = await Promise.all([
        isTeamLead ? api.getTeamLeadFollowUps() : api.listUnresolvedQuestions(),
        api.getActiveUsers(),
        api.listTranscripts()
      ])

      setItems(Array.isArray(questionsList) ? questionsList : [])
      setActiveUsers(Array.isArray(usersList) ? usersList : [])
      setAvailableTranscripts(Array.isArray(transcriptsList) ? transcriptsList : [])
    } catch (err) {
      console.error('Failed to load follow-up items:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [isTeamLead])

  // Tab Filtering & Search
  const filteredItems = useMemo(() => {
    let result = items

    if (activeTab === 'pending') {
      result = result.filter(i => i.status === 'Pending' || i.status === 'In Progress')
    } else if (activeTab === 'resolved') {
      result = result.filter(i => i.status === 'Resolved')
    } else if (activeTab === 'clarification') {
      result = result.filter(i => 
        (i.status !== 'Resolved') && 
        (!i.assignedOwnerId || !i.targetDeadline || (i.category || '').toLowerCase().includes('missing') || (i.category || '').toLowerCase().includes('clarification'))
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.sourceMeetingTitle || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [items, activeTab, searchQuery])

  // Count summaries for tabs
  const counts = useMemo(() => {
    const total = items.length
    const pending = items.filter(i => i.status === 'Pending' || i.status === 'In Progress').length
    const resolved = items.filter(i => i.status === 'Resolved').length
    const clarification = items.filter(i => 
      (i.status !== 'Resolved') && 
      (!i.assignedOwnerId || !i.targetDeadline || (i.category || '').toLowerCase().includes('missing') || (i.category || '').toLowerCase().includes('clarification'))
    ).length
    return { total, pending, resolved, clarification }
  }, [items])

  // Open Resolution / Edit Modal
  const openResolveModal = (item) => {
    setSelectedItem(item)
    setResolveNotes(item.resolutionNotes || '')
    setAssignedOwnerId(item.assignedOwnerId || '')
    setTargetDeadline(item.targetDeadline || '')
    setActionError('')
  }

  // Handle Mark Resolved
  const handleResolve = async (e) => {
    e.preventDefault()
    if (!selectedItem) return
    setIsSubmitting(true)
    setActionError('')

    try {
      await api.updateUnresolvedQuestion(selectedItem.id, {
        status: 'Resolved',
        resolutionNotes: resolveNotes.trim() || 'Addressed and resolved by reviewer.',
        assignedOwnerId: assignedOwnerId || null,
        targetDeadline: targetDeadline || null
      })
      setSelectedItem(null)
      await loadData()
    } catch (err) {
      setActionError(err.message || 'Failed to resolve item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Quick Reopen
  const handleReopen = async (item) => {
    try {
      await api.updateUnresolvedQuestion(item.id, {
        status: 'Pending',
        resolutionNotes: null
      })
      await loadData()
    } catch (err) {
      alert('Failed to reopen item: ' + err.message)
    }
  }

  // Handle Quick Assign / Update
  const handleUpdateAssignment = async (e) => {
    e.preventDefault()
    if (!selectedItem) return
    setIsSubmitting(true)
    setActionError('')

    try {
      await api.updateUnresolvedQuestion(selectedItem.id, {
        assignedOwnerId: assignedOwnerId || null,
        targetDeadline: targetDeadline || null,
        resolutionNotes: resolveNotes.trim() || null
      })
      setSelectedItem(null)
      await loadData()
    } catch (err) {
      setActionError(err.message || 'Failed to update item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Create New Follow-Up
  const handleCreateNew = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setIsSubmitting(true)
    setActionError('')

    try {
      await api.createUnresolvedQuestion({
        transcriptId: newTranscriptId || (availableTranscripts[0]?.id || null),
        title: newTitle.trim(),
        category: newCategory,
        description: newDescription.trim(),
        assignedOwnerId: assignedOwnerId || null,
        targetDeadline: targetDeadline || null
      })
      setShowNewModal(false)
      setNewTitle('')
      setNewDescription('')
      await loadData()
    } catch (err) {
      setActionError(err.message || 'Failed to create follow-up item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const analysisBase = isTeamLead ? '/team-lead/transcripts' : '/user/transcripts'

  return (
    <div className="stack" style={{ gap: '20px' }}>
      {/* Top Banner / Header */}
      <section className="panel">
        <div className="phead" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div>
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <HelpCircle size={22} color="var(--color-primary)" />
              <h2>Follow-ups & Unresolved Questions</h2>
              <span className="badge">{counts.pending} pending</span>
            </div>
            <p className="muted sm" style={{ marginTop: '4px' }}>
              Real-world repository of open questions, ambiguous commitments, and follow-up deliverables identified from meeting discussions.
            </p>
          </div>

          <div className="row" style={{ gap: '8px' }}>
            <button className="btn primary sm" onClick={() => {
              setNewTranscriptId(availableTranscripts[0]?.id || '')
              setShowNewModal(true)
            }}>
              <Plus size={14} /> Add Follow-up
            </button>
          </div>
        </div>

        {/* Tab Selection & Search Bar */}
        <div className="pbody" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            {/* Tabs */}
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={'chip' + (activeTab === 'all' ? ' on' : '')}
                onClick={() => setActiveTab('all')}
              >
                All ({counts.total})
              </button>
              <button
                className={'chip' + (activeTab === 'pending' ? ' on' : '')}
                onClick={() => setActiveTab('pending')}
              >
                Pending ({counts.pending})
              </button>
              <button
                className={'chip' + (activeTab === 'clarification' ? ' on' : '')}
                onClick={() => setActiveTab('clarification')}
              >
                Needs Clarification ({counts.clarification})
              </button>
              <button
                className={'chip' + (activeTab === 'resolved' ? ' on' : '')}
                onClick={() => setActiveTab('resolved')}
              >
                Resolved History ({counts.resolved})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-muted)' }} />
              <input
                type="text"
                className="input sm"
                placeholder="Search follow-ups..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '30px', width: '100%' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="panel">
        <div className="pbody">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
              <p className="muted">Loading real persisted follow-up items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mcard col" style={{ textAlign: 'center', padding: '48px 16px' }}>
              <HelpCircle size={40} color="var(--color-muted)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>No follow-up items found</h3>
              <p className="muted sm" style={{ maxWidth: '440px', margin: '6px auto 16px' }}>
                {searchQuery || activeTab !== 'all'
                  ? 'No records match your active search or filter selection.'
                  : 'No transcript available. Upload a meeting transcript or enter meeting notes to get started.'}
              </p>
              <div>
                <button
                  className="btn primary sm"
                  onClick={() => nav(isTeamLead ? '/team-lead/transcripts?upload=true' : '/user/transcripts?upload=true')}
                >
                  <FileText size={14} /> Upload Meeting Transcript
                </button>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: '14px' }}>
              {filteredItems.map(item => {
                const isResolved = item.status === 'Resolved'
                const isMissingOwner = !item.assignedOwnerId && (!item.assignedOwnerName || item.assignedOwnerName === 'Unassigned')
                const isMissingDeadline = !item.targetDeadline || item.targetDeadline === 'Unspecified'

                return (
                  <div
                    key={item.id}
                    className="mcard col"
                    style={{
                      borderLeft: isResolved
                        ? '4px solid var(--color-success, #10b981)'
                        : (isMissingOwner || isMissingDeadline ? '4px solid #f59e0b' : '4px solid var(--color-primary)'),
                      padding: '16px 18px',
                      background: 'var(--color-card, #ffffff)'
                    }}
                  >
                    {/* Item Top Bar */}
                    <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div className="row" style={{ gap: '10px', alignItems: 'center' }}>
                        <span
                          className="chip"
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: isResolved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                            color: isResolved ? '#059669' : 'var(--color-primary)'
                          }}
                        >
                          {item.category || 'Follow-up'}
                        </span>

                        <span
                          className="tag"
                          style={{
                            background: isResolved ? 'var(--color-success, #10b981)' : (item.status === 'In Progress' ? '#f59e0b' : 'var(--color-muted)'),
                            color: '#fff',
                            fontSize: '11px'
                          }}
                        >
                          {item.status || 'Pending'}
                        </span>

                        {item.sourceMeetingTitle && (
                          <span className="muted sm row" style={{ gap: '4px', alignItems: 'center' }}>
                            <FileText size={12} />
                            {item.transcriptId ? (
                              <Link
                                to={`${analysisBase}/${item.transcriptId}/analysis`}
                                className="link"
                                style={{ fontWeight: 500 }}
                              >
                                {item.sourceMeetingTitle}
                              </Link>
                            ) : (
                              <span>{item.sourceMeetingTitle}</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="row" style={{ gap: '8px' }}>
                        {isResolved ? (
                          <button
                            className="btn sm"
                            onClick={() => handleReopen(item)}
                            title="Re-open this question / follow-up"
                          >
                            <RotateCcw size={13} /> Re-open
                          </button>
                        ) : (
                          <button
                            className="btn primary sm"
                            onClick={() => openResolveModal(item)}
                          >
                            <CheckCircle2 size={13} /> Resolve / Update
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div style={{ marginTop: '10px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="sm" style={{ color: 'var(--color-text)', lineHeight: 1.5, margin: '0 0 8px' }}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Evidence Quote if available */}
                    {item.evidence && (
                      <div
                        style={{
                          background: 'var(--color-background-subtle, #f8fafc)',
                          borderLeft: '3px solid var(--color-border)',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontStyle: 'italic',
                          color: 'var(--color-muted)',
                          margin: '6px 0 10px'
                        }}
                      >
                        <MessageSquare size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-1px' }} />
                        "{item.evidence}"
                      </div>
                    )}

                    {/* Clarification Warnings & Attributes */}
                    <div className="between" style={{ flexWrap: 'wrap', gap: '10px', marginTop: '6px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                      <div className="row" style={{ gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
                        {/* Assigned Owner */}
                        <div className="row" style={{ gap: '5px', alignItems: 'center' }}>
                          <User size={13} color="var(--color-muted)" />
                          <span className="muted">Owner:</span>
                          {item.assignedOwnerName ? (
                            <b style={{ color: 'var(--color-text)' }}>{item.assignedOwnerName}</b>
                          ) : (
                            <span style={{ color: '#d97706', fontWeight: 600 }}>Unassigned (Awaiting Clarification)</span>
                          )}
                        </div>

                        {/* Deadline */}
                        <div className="row" style={{ gap: '5px', alignItems: 'center' }}>
                          <Calendar size={13} color="var(--color-muted)" />
                          <span className="muted">Target Date:</span>
                          {item.targetDeadline && item.targetDeadline !== 'Unspecified' ? (
                            <b style={{ color: 'var(--color-text)' }}>{item.targetDeadline}</b>
                          ) : (
                            <span style={{ color: '#d97706', fontWeight: 600 }}>Unspecified (Awaiting Confirmation)</span>
                          )}
                        </div>

                        {/* Created Date */}
                        {item.createdAt && (
                          <div className="row" style={{ gap: '5px', alignItems: 'center' }}>
                            <Clock size={13} color="var(--color-muted)" />
                            <span className="muted">Added: {item.createdAt}</span>
                          </div>
                        )}
                      </div>

                      {/* Resolution Audit Trail */}
                      {isResolved && (
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                          Resolved {item.resolverName ? `by ${item.resolverName}` : ''} {item.resolvedAt ? `on ${item.resolvedAt}` : ''}
                          {item.resolutionNotes && (
                            <span style={{ display: 'block', color: 'var(--color-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                              Note: {item.resolutionNotes}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Resolution & Assignment Modal */}
      {selectedItem && (
        <Modal
          title={`Resolve & Clarify: "${selectedItem.title}"`}
          onClose={() => setSelectedItem(null)}
        >
          <form onSubmit={handleResolve} className="stack" style={{ gap: '16px' }}>
            {actionError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '13px', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '4px' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {actionError}
              </div>
            )}

            <div>
              <label className="label">Item Description</label>
              <p className="sm muted" style={{ marginTop: '2px' }}>
                {selectedItem.description || selectedItem.title}
              </p>
              {selectedItem.evidence && (
                <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-muted)', marginTop: '4px' }}>
                  Transcript evidence: "{selectedItem.evidence}"
                </div>
              )}
            </div>

            {/* Assign Registered User */}
            <div>
              <label className="label">Assign Accountable Member</label>
              <select
                className="input"
                value={assignedOwnerId}
                onChange={e => setAssignedOwnerId(e.target.value)}
              >
                <option value="">-- Leave Unassigned --</option>
                {activeUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}) - {u.email}
                  </option>
                ))}
              </select>
              <p className="muted sm" style={{ marginTop: '3px' }}>
                Maps to registered database users only. Never automatically creates user accounts.
              </p>
            </div>

            {/* Target Deadline */}
            <div>
              <label className="label">Target Resolution Deadline</label>
              <input
                type="date"
                className="input"
                value={targetDeadline}
                onChange={e => setTargetDeadline(e.target.value)}
              />
              <p className="muted sm" style={{ marginTop: '3px' }}>
                Exact deadline confirmed during or following meeting discussion.
              </p>
            </div>

            {/* Resolution Notes */}
            <div>
              <label className="label">Resolution / Clarification Notes</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Explain how this question or follow-up was answered or resolved..."
                value={resolveNotes}
                onChange={e => setResolveNotes(e.target.value)}
              />
            </div>

            <div className="between" style={{ marginTop: '8px', gap: '8px' }}>
              <button
                type="button"
                className="btn sm"
                disabled={isSubmitting}
                onClick={handleUpdateAssignment}
                title="Save changes without marking resolved"
              >
                Save Updates Only
              </button>

              <div className="row" style={{ gap: '8px' }}>
                <button
                  type="button"
                  className="btn sm"
                  disabled={isSubmitting}
                  onClick={() => setSelectedItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Confirm & Mark Resolved'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Create New Follow-Up Item Modal */}
      {showNewModal && (
        <Modal
          title="Add New Follow-Up Action or Question"
          onClose={() => setShowNewModal(false)}
        >
          <form onSubmit={handleCreateNew} className="stack" style={{ gap: '14px' }}>
            {actionError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {actionError}
              </div>
            )}

            <div>
              <label className="label">Title *</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Clarify staging security checklist with ops lead"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                <option value="Follow-up Action">Follow-up Action</option>
                <option value="Unanswered Question">Unanswered Question</option>
                <option value="Missing Owner">Missing Owner</option>
                <option value="Ambiguous Deadline">Ambiguous Deadline</option>
                <option value="Dependency Review">Dependency Review</option>
              </select>
            </div>

            <div>
              <label className="label">Associated Meeting / Transcript</label>
              <select
                className="input"
                value={newTranscriptId}
                onChange={e => setNewTranscriptId(e.target.value)}
              >
                <option value="">-- No Source Transcript Linked --</option>
                {availableTranscripts.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.uploadedAt || t.createdAt || 'Meeting'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Details & Context</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Details of the question or what needs to be delivered..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
              />
            </div>

            <div className="between" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="btn sm"
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Follow-Up Item'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
