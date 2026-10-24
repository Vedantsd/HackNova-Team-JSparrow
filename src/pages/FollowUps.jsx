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
    <div className="followups-container">
      {/* Top Banner / Header with Interactive Stat Cards */}
      <section className="followups-header-card">
        <div className="followups-header-content">
          <div>
            <div className="followups-title-row">
              <div className="followups-title-icon-wrap">
                <HelpCircle size={22} />
              </div>
              <div>
                <div className="row" style={{ gap: '10px', alignItems: 'center' }}>
                  <h2 className="followups-title">Follow-ups & Unresolved Questions</h2>
                  <span className="followups-badge">
                    <Clock size={12} /> {counts.pending} pending action
                  </span>
                </div>
                <p className="followups-subtitle">
                  Real-world repository of open questions, ambiguous commitments, and follow-up deliverables identified from meeting discussions.
                </p>
              </div>
            </div>
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

        {/* Quick-Filter Metric Stat Cards */}
        <div className="followups-stats-grid">
          <div
            className={`followup-stat-card ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            title="View all follow-up items"
          >
            <div className="followup-stat-icon total">
              <FileText size={18} />
            </div>
            <div>
              <div className="followup-stat-val">{counts.total}</div>
              <div className="followup-stat-label">Total Questions</div>
            </div>
          </div>

          <div
            className={`followup-stat-card ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            title="View pending items awaiting response"
          >
            <div className="followup-stat-icon pending">
              <Clock size={18} />
            </div>
            <div>
              <div className="followup-stat-val">{counts.pending}</div>
              <div className="followup-stat-label">Pending Review</div>
            </div>
          </div>

          <div
            className={`followup-stat-card ${activeTab === 'clarification' ? 'active' : ''}`}
            onClick={() => setActiveTab('clarification')}
            title="View items needing owner or deadline clarification"
          >
            <div className="followup-stat-icon alert">
              <AlertCircle size={18} />
            </div>
            <div>
              <div className="followup-stat-val">{counts.clarification}</div>
              <div className="followup-stat-label">Needs Clarification</div>
            </div>
          </div>

          <div
            className={`followup-stat-card ${activeTab === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolved')}
            title="View resolved history items"
          >
            <div className="followup-stat-icon resolved">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="followup-stat-val">{counts.resolved}</div>
              <div className="followup-stat-label">Resolved History</div>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar: Navigation Tabs & Search Input */}
      <section className="followups-toolbar">
        <div className="followups-nav-tabs">
          <button
            className={`followups-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Items
            <span className="followups-tab-count">{counts.total}</span>
          </button>
          <button
            className={`followups-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending
            <span className="followups-tab-count">{counts.pending}</span>
          </button>
          <button
            className={`followups-tab-btn ${activeTab === 'clarification' ? 'active' : ''}`}
            onClick={() => setActiveTab('clarification')}
          >
            Needs Clarification
            <span className="followups-tab-count">{counts.clarification}</span>
          </button>
          <button
            className={`followups-tab-btn ${activeTab === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolved')}
          >
            Resolved History
            <span className="followups-tab-count">{counts.resolved}</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="followups-search-wrap">
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--color-muted)' }} />
          <input
            type="text"
            className="followups-search-input"
            placeholder="Search questions, context, meetings..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Main List Area */}
      <div>
        {loading ? (
          <div className="panel" style={{ padding: '56px 20px', textAlign: 'center' }}>
            <Loader2 size={26} className="spin-icon" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
            <p className="muted">Loading real persisted follow-up items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="followups-empty-card">
            <div className="followups-empty-icon-wrap">
              <HelpCircle size={32} />
            </div>
            <h3 className="followups-empty-title">No follow-up items found</h3>
            <p className="followups-empty-text">
              {searchQuery || activeTab !== 'all'
                ? 'No records match your active search or filter selection.'
                : 'No transcript questions available. Upload a meeting transcript or add follow-ups manually.'}
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
          <div className="followups-list">
            {filteredItems.map(item => {
              const isResolved = item.status === 'Resolved'
              const isMissingOwner = !item.assignedOwnerId && (!item.assignedOwnerName || item.assignedOwnerName === 'Unassigned')
              const isMissingDeadline = !item.targetDeadline || item.targetDeadline === 'Unspecified'

              const cardStatusClass = isResolved
                ? 'status-resolved'
                : (isMissingOwner || isMissingDeadline ? 'status-clarification' : 'status-pending')

              return (
                <div
                  key={item.id}
                  className={`followup-card ${cardStatusClass}`}
                >
                  {/* Card Header & Badges */}
                  <div className="followup-card-header">
                    <div className="followup-badges-row">
                      <span className="followup-category-badge">
                        {item.category || 'Follow-up'}
                      </span>

                      <span className={`followup-status-tag ${isResolved ? 'resolved' : (isMissingOwner || isMissingDeadline ? 'clarification' : '')}`}>
                        {isResolved ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {item.status || 'Pending'}
                      </span>

                      {item.sourceMeetingTitle && (
                        <span className="followup-source-meeting">
                          <FileText size={12} />
                          {item.transcriptId ? (
                            <Link
                              to={`${analysisBase}/${item.transcriptId}/analysis`}
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
                          <CheckCircle2 size={13} /> Resolve / Clarify
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="followup-card-title">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="followup-card-desc">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Evidence Quote */}
                  {item.evidence && (
                    <div className="followup-evidence-box">
                      <MessageSquare size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-primary)' }} />
                      <div>
                        <span>"{item.evidence}"</span>
                      </div>
                    </div>
                  )}

                  {/* Meta Footer */}
                  <div className="followup-card-meta">
                    <div className="followup-meta-items">
                      {/* Assigned Owner */}
                      <div className="followup-meta-item">
                        <User size={14} />
                        <span>Owner:</span>
                        {item.assignedOwnerName && item.assignedOwnerName !== 'Unassigned' ? (
                          <span className="followup-owner-pill">{item.assignedOwnerName}</span>
                        ) : (
                          <span className="followup-owner-pill unassigned">
                            <AlertCircle size={12} /> Unassigned (Awaiting Clarification)
                          </span>
                        )}
                      </div>

                      {/* Deadline */}
                      <div className="followup-meta-item">
                        <Calendar size={14} />
                        <span>Target Date:</span>
                        {item.targetDeadline && item.targetDeadline !== 'Unspecified' ? (
                          <span className="followup-deadline-pill">{item.targetDeadline}</span>
                        ) : (
                          <span className="followup-deadline-pill missing">
                            <AlertCircle size={12} /> Unspecified (Awaiting Confirmation)
                          </span>
                        )}
                      </div>

                      {/* Created Date */}
                      {item.createdAt && (
                        <div className="followup-meta-item">
                          <Clock size={14} />
                          <span>Added: {item.createdAt}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resolution Audit Trail */}
                  {isResolved && (
                    <div className="followup-resolution-banner">
                      <div className="row" style={{ gap: '6px', alignItems: 'center' }}>
                        <CheckCircle2 size={14} />
                        <span>
                          <strong>Resolved</strong> {item.resolverName ? `by ${item.resolverName}` : ''} {item.resolvedAt ? `on ${item.resolvedAt}` : ''}
                        </span>
                      </div>
                      {item.resolutionNotes && (
                        <div style={{ marginTop: '4px', paddingLeft: '20px', fontStyle: 'italic', opacity: 0.9 }}>
                          Note: {item.resolutionNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Resolution & Assignment Modal */}
      {selectedItem && (
        <Modal
          title={`Resolve & Clarify: "${selectedItem.title}"`}
          onClose={() => setSelectedItem(null)}
          className="followup-modal"
        >
          <form onSubmit={handleResolve} className="stack" style={{ gap: '14px', marginTop: '4px' }}>
            {actionError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '13px', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-1px' }} />
                {actionError}
              </div>
            )}

            {/* Item Context Card */}
            <div className="followup-modal-desc-card">
              <div className="followup-modal-desc-title">Item Description & Scope</div>
              <p className="followup-modal-desc-text">
                {selectedItem.description || selectedItem.title}
              </p>
              {selectedItem.evidence && (
                <div className="followup-modal-evidence">
                  Transcript evidence: "{selectedItem.evidence}"
                </div>
              )}
            </div>

            {/* Assign Registered User */}
            <div className="form-group">
              <label className="form-label">Assign Accountable Member</label>
              <select
                className="form-select"
                value={assignedOwnerId}
                onChange={e => setAssignedOwnerId(e.target.value)}
              >
                <option value="">-- Leave Unassigned (Needs Clarification) --</option>
                {activeUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}) — {u.email}
                  </option>
                ))}
              </select>
              <p className="form-help">
                Maps to registered database users only. Never automatically creates user accounts.
              </p>
            </div>

            {/* Target Deadline */}
            <div className="form-group">
              <label className="form-label">Target Resolution Deadline</label>
              <input
                type="date"
                className="form-input"
                value={targetDeadline}
                onChange={e => setTargetDeadline(e.target.value)}
              />
              <p className="form-help">
                Exact deadline confirmed during or following meeting discussion.
              </p>
            </div>

            {/* Resolution Notes */}
            <div className="form-group">
              <label className="form-label">Resolution / Clarification Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Explain how this question or follow-up was answered or resolved..."
                value={resolveNotes}
                onChange={e => setResolveNotes(e.target.value)}
              />
            </div>

            {/* Modal Actions Footer */}
            <div className="followup-modal-footer">
              <button
                type="button"
                className="btn sm"
                disabled={isSubmitting}
                onClick={handleUpdateAssignment}
                title="Save changes without marking resolved"
              >
                Save Updates Only
              </button>

              <div className="followup-modal-footer-actions">
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
          className="followup-modal"
        >
          <form onSubmit={handleCreateNew} className="stack" style={{ gap: '14px', marginTop: '4px' }}>
            {actionError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '13px', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-1px' }} />
                {actionError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. Clarify staging security checklist with ops lead"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
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

            <div className="form-group">
              <label className="form-label">Associated Meeting / Transcript</label>
              <select
                className="form-select"
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

            <div className="form-group">
              <label className="form-label">Details & Context</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Details of the question or what needs to be delivered..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
              />
            </div>

            {/* Modal Actions Footer */}
            <div className="followup-modal-footer">
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
