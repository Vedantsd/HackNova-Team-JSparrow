import { useState, useEffect, useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { 
  CheckSquare, 
  Check, 
  X, 
  Clock, 
  User, 
  AlertTriangle, 
  ExternalLink, 
  Search, 
  Edit3, 
  Save, 
  Quote, 
  Filter,
  Trello,
  RefreshCw,
  Link2,
  Kanban,
  Download,
  FileSpreadsheet,
  Layers,
  AlertCircle,
  CheckCheck
} from 'lucide-react'
import { api } from '../services/api.js'

export default function ActionItems() {
  const { query = '' } = useOutletContext() || {}
  const [items, setItems] = useState([])
  const [activeUsers, setActiveUsers] = useState([])
  const [trelloStatus, setTrelloStatus] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'Pending Approval' | 'Approved' | 'Rejected'
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [classificationFilter, setClassificationFilter] = useState('all') // 'all' | 'commitment' | 'suggestion' | 'unresolved_question'
  const [syncing, setSyncing] = useState(false)
  const [exportingId, setExportingId] = useState(null)
  const [bulkApproving, setBulkApproving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ 
    title: '', 
    description: '',
    owner: '', 
    assigneeId: '', 
    deadline: '', 
    priority: 'Medium',
    itemType: 'commitment'
  })

  // Trello Connect Modal
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [connectError, setConnectError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const loadData = async () => {
    try {
      const [list, tStatus, uList] = await Promise.all([
        api.listActionItems().catch(() => []),
        api.getTrelloStatus().catch(() => null),
        api.getActiveUsers().catch(() => [])
      ])
      setItems(list || [])
      if (tStatus) setTrelloStatus(tStatus)
      if (Array.isArray(uList)) setActiveUsers(uList)
    } catch (e) {
      console.error('Failed to load action items:', e)
    }
  }

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
    window.addEventListener('cf-actions-updated', handleUpdate)
    window.addEventListener('cf-transcripts-updated', handleUpdate)
    return () => {
      window.removeEventListener('cf-actions-updated', handleUpdate)
      window.removeEventListener('cf-transcripts-updated', handleUpdate)
    }
  }, [])

  const handleApprove = async (transcriptId, actionId) => {
    await api.approveActionItem(transcriptId, actionId)
    await loadData()
  }

  const handleReject = async (transcriptId, actionId) => {
    await api.rejectActionItem(transcriptId, actionId)
    await loadData()
  }

  const startEdit = item => {
    setEditingId(item.id)
    setEditForm({
      title: item.title,
      description: item.description || '',
      owner: item.owner,
      assigneeId: item.assigneeId || '',
      deadline: item.deadline,
      priority: item.priority || 'Medium',
      itemType: item.itemType || 'commitment'
    })
  }

  const saveEdit = async (transcriptId, actionId) => {
    await api.editActionItem(transcriptId, actionId, editForm)
    setEditingId(null)
    await loadData()
  }

  const eligibleForBulkApprove = useMemo(() => {
    return items.filter(i => i.status === 'Pending Approval' && (!i.itemType || i.itemType === 'commitment'))
  }, [items])

  const handleBulkApprove = async () => {
    if (eligibleForBulkApprove.length === 0) return
    try {
      setBulkApproving(true)
      const ids = eligibleForBulkApprove.map(i => i.id)
      await api.bulkApproveActionItems(ids)
      await loadData()
    } catch (err) {
      console.error('Failed to bulk approve:', err)
      alert(err.message || 'Failed to bulk approve tasks.')
    } finally {
      setBulkApproving(false)
    }
  }

  const handleExportCSV = () => {
    window.location.href = api.getExportTasksUrl('csv')
  }

  const handleExportJSON = async () => {
    try {
      const data = await api.exportTasksJson()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `commitflow_approved_tasks_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export JSON:', err)
      alert('Failed to export tasks as JSON.')
    }
  }

  const handleSyncTrello = async () => {
    try {
      setSyncing(true)
      const res = await api.syncTrello()
      if (res && res.error && !trelloStatus?.connected) {
        setShowConnectModal(true)
      } else {
        await loadData()
      }
    } catch (e) {
      console.error('Sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleExportToTrello = async (actionId) => {
    try {
      setExportingId(actionId)
      const res = await api.exportActionItemToTrello(actionId)
      if (res && res.error) {
        if (!trelloStatus?.connected) {
          setShowConnectModal(true)
        } else {
          alert(res.error)
        }
      } else {
        await loadData()
      }
    } catch (e) {
      if (!trelloStatus?.connected) {
        setShowConnectModal(true)
      } else {
        console.error('Failed to export to Trello:', e)
      }
    } finally {
      setExportingId(null)
    }
  }

  const handleConnectTrello = async (e) => {
    e.preventDefault()
    if (!tokenInput.trim()) return
    try {
      setConnecting(true)
      setConnectError('')
      const res = await api.connectTrello(tokenInput.trim())
      if (res && res.error) {
        setConnectError(res.error)
      } else {
        setShowConnectModal(false)
        setTokenInput('')
        await loadData()
      }
    } catch (err) {
      setConnectError(err.message || 'Failed to connect to Trello.')
    } finally {
      setConnecting(false)
    }
  }

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter(i => {
      const matchStatus = filter === 'all' || i.status.toLowerCase() === filter.toLowerCase()
      const matchPriority = priorityFilter === 'all' || (i.priority && i.priority.toLowerCase() === priorityFilter.toLowerCase())
      const matchType = classificationFilter === 'all' || (i.itemType || 'commitment').toLowerCase() === classificationFilter.toLowerCase()
      const matchQuery = !q || 
        i.title.toLowerCase().includes(q) || 
        (i.owner && i.owner.toLowerCase().includes(q)) || 
        (i.sourceMeetingTitle && i.sourceMeetingTitle.toLowerCase().includes(q))
      return matchStatus && matchPriority && matchType && matchQuery
    })
  }, [items, filter, priorityFilter, classificationFilter, query])

  const pendingCount = items.filter(i => i.status === 'Pending Approval').length
  const approvedCount = items.filter(i => i.status === 'Approved').length
  const trelloLinkedCount = items.filter(i => i.trelloCardId || i.trelloCardUrl).length

  const authUrl = trelloStatus?.authUrl || 'https://trello.com/1/authorize?expiration=never&name=CommitFlow&scope=read,write&response_type=token&key=3eb17ed1dcc1ff335a7e317b1abd6a67'

  return (
    <div className="action-items-page stack">
      {/* Top Header Card */}
      <section className="panel">
        <div className="phead">
          <div className="between" style={{ width: '100%', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div className="row" style={{ gap: '8px' }}>
                <h2>Action Items & Approval Center</h2>
                <span className="badge">{pendingCount} pending review</span>
                {trelloLinkedCount > 0 && (
                  <span className="badge" style={{ background: 'rgba(0, 121, 191, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                    <Trello size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {trelloLinkedCount} synced to Trello
                  </span>
                )}
              </div>
              <p className="muted sm" style={{ marginTop: '2px' }}>
                Human-in-the-loop task governance. Review, edit, approve, or reject AI-extracted action items with real duplicate/conflict detection and project board export.
              </p>
            </div>

            {/* Quick Bar Controls */}
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              {/* Bulk Approve Eligible Commitments */}
              {eligibleForBulkApprove.length > 0 && (
                <button
                  className="btn primary sm"
                  onClick={handleBulkApprove}
                  disabled={bulkApproving}
                  style={{
                    background: '#10b981',
                    borderColor: '#10b981',
                    gap: '6px'
                  }}
                  title="Approve all proposed commitments that have no unresolved issues"
                >
                  <CheckCheck size={14} className={bulkApproving ? 'spin' : ''} />
                  <span>{bulkApproving ? 'Approving...' : `Approve All Eligible (${eligibleForBulkApprove.length})`}</span>
                </button>
              )}

              {/* Structured Fallback Exports */}
              <button
                className="btn sm"
                onClick={handleExportCSV}
                title="Download approved tasks as CSV spreadsheet"
                style={{ gap: '5px' }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>

              <button
                className="btn sm"
                onClick={handleExportJSON}
                title="Download structured JSON export"
                style={{ gap: '5px' }}
              >
                <Layers size={13} />
                <span>Export JSON</span>
              </button>

              <Link
                to="/user/trello"
                className="btn sm"
                style={{
                  background: 'rgba(0, 121, 191, 0.12)',
                  borderColor: 'rgba(0, 121, 191, 0.3)',
                  color: '#38bdf8',
                  gap: '6px'
                }}
              >
                <Kanban size={14} /> Trello Board
              </Link>

              {trelloStatus?.connected && trelloStatus?.boardUrl && (
                <a
                  href={trelloStatus.boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn sm"
                  style={{ gap: '5px' }}
                  title="Open live Trello board in a new tab"
                >
                  <Trello size={13} color="#0079bf" />
                  <span>Open in Trello</span>
                  <ExternalLink size={11} />
                </a>
              )}

              <button
                className="btn sm"
                onClick={handleSyncTrello}
                disabled={syncing}
                title="Sync all action items with Trello"
                style={{ gap: '5px' }}
              >
                <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                <span>{syncing ? 'Syncing...' : 'Sync Trello'}</span>
              </button>

              {!trelloStatus?.connected && (
                <button
                  className="btn primary sm"
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: '#0079bf',
                    borderColor: '#0079bf',
                    gap: '5px'
                  }}
                >
                  <Link2 size={13} /> Connect Trello
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="pbody" style={{ paddingBottom: '16px' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            {/* Status Filter */}
            <div className="row" style={{ gap: '6px' }}>
              <span className="muted sm">Status:</span>
              {['all', 'Pending Approval', 'Approved', 'Rejected'].map(st => (
                <button
                  key={st}
                  className={'chip' + (filter.toLowerCase() === st.toLowerCase() ? ' on' : '')}
                  onClick={() => setFilter(st)}
                >
                  {st === 'all' ? 'All Items' : st}
                </button>
              ))}
            </div>

            {/* Classification Filter */}
            <div className="row" style={{ gap: '6px' }}>
              <span className="muted sm">Classification:</span>
              {[
                { id: 'all', label: 'All Types' },
                { id: 'commitment', label: 'Commitments' },
                { id: 'suggestion', label: 'Suggestions' },
                { id: 'unresolved_question', label: 'Questions' }
              ].map(cl => (
                <button
                  key={cl.id}
                  className={'chip' + (classificationFilter.toLowerCase() === cl.id.toLowerCase() ? ' on' : '')}
                  onClick={() => setClassificationFilter(cl.id)}
                >
                  {cl.label}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <div className="row" style={{ gap: '6px' }}>
              <span className="muted sm">Priority:</span>
              {['all', 'High', 'Medium', 'Low'].map(pr => (
                <button
                  key={pr}
                  className={'chip' + (priorityFilter.toLowerCase() === pr.toLowerCase() ? ' on' : '')}
                  onClick={() => setPriorityFilter(pr)}
                >
                  {pr === 'all' ? 'All Priorities' : pr}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Action Items List */}
      <section className="panel">
        <div className="phead">
          <h3>Tracked Tasks</h3>
          <span className="tag">{approvedCount} Confirmed for Execution</span>
        </div>

        <div className="pbody">
          {filteredItems.length === 0 ? (
            <div className="mcard col" style={{ textAlign: 'center', padding: '40px 16px' }}>
              <CheckSquare size={32} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
              <b>No action items found</b>
              <p className="muted sm">
                {query || filter !== 'all' 
                  ? 'No tasks match your selected filter criteria.' 
                  : 'Upload a transcript or create a task on Trello to automatically populate action items.'}
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: '14px' }}>
              {filteredItems.map(item => {
                const isEditing = editingId === item.id
                const isPending = item.status === 'Pending Approval'
                const isApproved = item.status === 'Approved'
                const isRejected = item.status === 'Rejected'
                const trelloCardUrl = item.trelloCardUrl || (item.trelloCardId ? `https://trello.com/c/${item.trelloCardId}` : null)

                return (
                  <div key={item.id} className="mcard col" style={{ padding: '16px' }}>
                    {/* Header Row */}
                    <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      {isEditing ? (
                        <div className="col grow" style={{ gap: '8px', minWidth: '240px' }}>
                          <input
                            className="input-field"
                            placeholder="Task Title"
                            value={editForm.title}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                          />
                          <input
                            className="input-field sm"
                            placeholder="Detailed Description"
                            value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                          <b style={{ fontSize: '15px' }}>{item.title}</b>
                          
                          {/* Item Type / Classification Badge */}
                          <span className={`classification-badge ${item.itemType || 'commitment'}`}>
                            {item.itemType ? item.itemType.replace(/_/g, ' ') : 'Commitment'}
                          </span>

                          {item.priority && (
                            <span className={`tag ${item.priority === 'High' ? 'danger-tag' : ''}`}>
                              {item.priority}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="row" style={{ gap: '8px' }}>
                        {trelloCardUrl && (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(0, 121, 191, 0.1)',
                              color: '#38bdf8',
                              borderColor: 'rgba(56, 189, 248, 0.25)',
                              fontSize: '11px'
                            }}
                          >
                            <Trello size={11} style={{ display: 'inline', marginRight: '3px' }} />
                            Trello Synced
                          </span>
                        )}

                        <span className={`status-badge ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Description (Read Mode) */}
                    {!isEditing && (
                      <p className="muted sm" style={{ margin: '6px 0', lineHeight: 1.5 }}>
                        {item.description}
                      </p>
                    )}

                    {/* Duplicate Warning Callout */}
                    {(item.isDuplicate || item.duplicateWarning) && (
                      <div className="duplicate-callout">
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Duplicate Warning:</strong> {item.duplicateWarning || 'This item strongly resembles an existing action item or previous export.'}
                        </div>
                      </div>
                    )}

                    {/* Conflict Warning Callout */}
                    {(item.isConflict || item.conflictWarning) && (
                      <div className="conflict-callout">
                        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Conflict Warning:</strong> {item.conflictWarning || 'Potential deadline collision or conflicting commitment detected.'}
                        </div>
                      </div>
                    )}

                    {/* Metadata & Editing Form */}
                    <div className="row" style={{ gap: '16px', margin: '8px 0', flexWrap: 'wrap' }}>
                      {/* Owner / Assignee */}
                      <div className="row" style={{ gap: '6px' }}>
                        <span className="muted sm">Assignee:</span>
                        {isEditing ? (
                          <select
                            className="input-field"
                            style={{ height: '30px', padding: '2px 8px', fontSize: '13px', minWidth: '160px' }}
                            value={editForm.assigneeId || ''}
                            onChange={e => {
                              const selectedId = e.target.value
                              const u = activeUsers.find(usr => usr.id === selectedId)
                              setEditForm(f => ({
                                ...f,
                                assigneeId: selectedId || '',
                                owner: u ? u.name : (selectedId ? f.owner : 'Unassigned')
                              }))
                            }}
                          >
                            <option value="">Unassigned (Ambiguous)</option>
                            {activeUsers.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={item.ownerStatus === 'ambiguous' ? 'warning-flag' : 'confirmed-meta'}>
                            {item.ownerStatus === 'ambiguous' && <AlertTriangle size={12} />}
                            {item.owner || 'Unassigned'}
                          </span>
                        )}
                      </div>

                      {/* Classification selector (in Edit mode) */}
                      {isEditing && (
                        <div className="row" style={{ gap: '6px' }}>
                          <span className="muted sm">Type:</span>
                          <select
                            className="input-field"
                            style={{ height: '30px', padding: '2px 8px', fontSize: '13px' }}
                            value={editForm.itemType || 'commitment'}
                            onChange={e => setEditForm(f => ({ ...f, itemType: e.target.value }))}
                          >
                            <option value="commitment">Commitment</option>
                            <option value="suggestion">Suggestion</option>
                            <option value="unresolved_question">Unresolved Question</option>
                          </select>
                        </div>
                      )}

                      {/* Due Date */}
                      <div className="row" style={{ gap: '6px' }}>
                        <span className="muted sm">Due Date:</span>
                        {isEditing ? (
                          <input 
                            type="date"
                            className="input-field" 
                            style={{ width: '135px', padding: '2px 8px', height: '30px' }}
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

                      {/* Priority selector (in Edit mode) */}
                      {isEditing && (
                        <div className="row" style={{ gap: '6px' }}>
                          <span className="muted sm">Priority:</span>
                          <select
                            className="input-field"
                            style={{ height: '30px', padding: '2px 8px', fontSize: '13px' }}
                            value={editForm.priority || 'Medium'}
                            onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                      )}

                      {item.sourceMeetingTitle && (
                        <div className="row" style={{ gap: '6px', marginLeft: 'auto' }}>
                          <span className="muted sm">Source:</span>
                          {item.sourceMeetingId ? (
                            <Link 
                              to={`/user/transcripts/${item.sourceMeetingId}/analysis`}
                              className="link row" 
                              style={{ gap: '3px' }}
                            >
                              <span>{item.sourceMeetingTitle}</span>
                              <ExternalLink size={11} />
                            </Link>
                          ) : (
                            <span className="muted sm">{item.sourceMeetingTitle}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Evidence quote */}
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

                    {/* Approval & Trello Action Buttons */}
                    <div className="between" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '8px' }}>
                      <div className="row" style={{ gap: '8px' }}>
                        {isEditing ? (
                          <>
                            <button className="btn primary sm" onClick={() => saveEdit(item.sourceMeetingId, item.id)}>
                              <Save size={13} /> Save Edits
                            </button>
                            <button className="btn sm" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="btn sm" onClick={() => startEdit(item)}>
                            <Edit3 size={13} /> Edit Task
                          </button>
                        )}

                        {/* Trello Link or Export Button (Guarded to Approved only) */}
                        {trelloCardUrl ? (
                          <a
                            href={trelloCardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn sm"
                            style={{
                              color: '#38bdf8',
                              borderColor: 'rgba(56, 189, 248, 0.3)',
                              gap: '5px'
                            }}
                          >
                            <Trello size={12} />
                            <span>View in Trello</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : isApproved ? (
                          <button
                            className="btn sm"
                            onClick={() => handleExportToTrello(item.id)}
                            disabled={exportingId === item.id}
                            title="Export this approved task to your Trello board"
                            style={{ gap: '5px', borderColor: 'rgba(0, 121, 191, 0.3)', color: '#38bdf8' }}
                          >
                            <Trello size={12} color="#0079bf" />
                            <span>{exportingId === item.id ? 'Exporting...' : 'Export to Trello'}</span>
                          </button>
                        ) : (
                          <button
                            className="btn sm"
                            disabled
                            title="Action item must be approved by a reviewer before project board export."
                            style={{ opacity: 0.5, cursor: 'not-allowed', gap: '5px' }}
                          >
                            <Trello size={12} color="var(--color-muted)" />
                            <span>Approve to Export</span>
                          </button>
                        )}
                      </div>

                      <div className="row" style={{ gap: '8px' }}>
                        {isPending && (
                          <>
                            <button 
                              className="btn sm" 
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => handleReject(item.sourceMeetingId, item.id)}
                            >
                              <X size={14} /> Reject
                            </button>
                            <button 
                              className="btn primary sm" 
                              onClick={() => handleApprove(item.sourceMeetingId, item.id)}
                            >
                              <Check size={14} /> Approve & Commit
                            </button>
                          </>
                        )}

                        {isApproved && (
                          <div className="row" style={{ gap: '6px' }}>
                            <span className="muted sm" style={{ color: '#16a34a', fontWeight: 600 }}>
                              ✓ Approved
                            </span>
                            {item.approvedByName && (
                              <span className="audit-note">
                                (by {item.approvedByName})
                              </span>
                            )}
                          </div>
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

      {/* Connect Trello Modal */}
      {showConnectModal && (
        <div className="modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header between">
              <div className="row" style={{ gap: '10px' }}>
                <div style={{ background: '#0079bf', color: '#fff', borderRadius: '6px', padding: '4px', display: 'flex' }}>
                  <Trello size={18} />
                </div>
                <h3>Connect Trello Account</h3>
              </div>
              <button className="btn icon-only sm" onClick={() => setShowConnectModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConnectTrello} className="modal-body stack" style={{ gap: '16px', marginTop: '12px' }}>
              <p className="muted sm" style={{ lineHeight: 1.5 }}>
                Connect your official Trello account using the provided API Credentials.
                Tasks and Action Items will sync bidirectionally in real-time.
              </p>

              <div style={{
                background: 'rgba(0, 121, 191, 0.08)',
                border: '1px solid rgba(0, 121, 191, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                <b style={{ fontSize: '13px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                  Step 1: Generate Authorization Token
                </b>
                <p className="muted sm" style={{ margin: '0 0 10px 0', fontSize: '12px' }}>
                  Click below to open Trello's official permission grant. Click <b>"Allow"</b>, then copy the generated token.
                </p>
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn sm"
                  style={{
                    background: '#0079bf',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600
                  }}
                >
                  <ExternalLink size={13} /> Authorize CommitFlow on Trello &rarr;
                </a>
              </div>

              <div>
                <b style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Step 2: Paste Generated Trello Token
                </b>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Paste your 64-character token here..."
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  autoFocus
                />
              </div>

              {connectError && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '12px'
                }}>
                  {connectError}
                </div>
              )}

              <div className="modal-footer row" style={{ justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn sm" onClick={() => setShowConnectModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary sm"
                  disabled={connecting || !tokenInput.trim()}
                  style={{ background: '#0079bf', borderColor: '#0079bf' }}
                >
                  {connecting ? 'Validating Token...' : 'Connect & Sync Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
