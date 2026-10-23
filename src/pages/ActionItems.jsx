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
  Filter
} from 'lucide-react'
import { transcriptStore } from '../services/transcriptStore.js'

export default function ActionItems() {
  const { query = '' } = useOutletContext() || {}
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all') // 'all' | 'Pending Approval' | 'Approved' | 'Rejected'
  const [priorityFilter, setPriorityFilter] = useState('all')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', owner: '', deadline: '', priority: 'Medium' })

  const loadData = () => {
    const list = transcriptStore.getAllActionItems()
    setItems(list)
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

  const handleApprove = (transcriptId, actionId) => {
    transcriptStore.updateActionItemStatus(transcriptId, actionId, 'Approved')
    loadData()
  }

  const handleReject = (transcriptId, actionId) => {
    transcriptStore.updateActionItemStatus(transcriptId, actionId, 'Rejected')
    loadData()
  }

  const startEdit = item => {
    setEditingId(item.id)
    setEditForm({
      title: item.title,
      owner: item.owner,
      deadline: item.deadline,
      priority: item.priority || 'Medium'
    })
  }

  const saveEdit = (transcriptId, actionId) => {
    transcriptStore.editActionItem(transcriptId, actionId, editForm)
    setEditingId(null)
    loadData()
  }

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter(i => {
      const matchStatus = filter === 'all' || i.status.toLowerCase() === filter.toLowerCase()
      const matchPriority = priorityFilter === 'all' || (i.priority && i.priority.toLowerCase() === priorityFilter.toLowerCase())
      const matchQuery = !q || 
        i.title.toLowerCase().includes(q) || 
        i.owner.toLowerCase().includes(q) || 
        (i.sourceMeetingTitle && i.sourceMeetingTitle.toLowerCase().includes(q))
      return matchStatus && matchPriority && matchQuery
    })
  }, [items, filter, priorityFilter, query])

  const pendingCount = items.filter(i => i.status === 'Pending Approval').length
  const approvedCount = items.filter(i => i.status === 'Approved').length

  return (
    <div className="action-items-page stack">
      {/* Top Header Card */}
      <section className="panel">
        <div className="phead">
          <div>
            <div className="row" style={{ gap: '8px' }}>
              <h2>Action Items & Approval Center</h2>
              <span className="badge">{pendingCount} pending review</span>
            </div>
            <p className="muted sm" style={{ marginTop: '2px' }}>
              Human-in-the-loop task governance. Review, edit, approve, or reject AI-extracted action items before tool dispatch.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="pbody" style={{ paddingBottom: '16px' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
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
                  : 'Upload a transcript to automatically extract action items.'}
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: '14px' }}>
              {filteredItems.map(item => {
                const isEditing = editingId === item.id
                const isPending = item.status === 'Pending Approval'
                const isApproved = item.status === 'Approved'
                const isRejected = item.status === 'Rejected'

                return (
                  <div key={item.id} className="mcard col" style={{ padding: '16px' }}>
                    {/* Header Row */}
                    <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      {isEditing ? (
                        <input
                          className="input-field"
                          style={{ flex: 1, minWidth: '240px' }}
                          value={editForm.title}
                          onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        />
                      ) : (
                        <div className="row" style={{ gap: '8px' }}>
                          <b style={{ fontSize: '15px' }}>{item.title}</b>
                          {item.priority && (
                            <span className={`tag ${item.priority === 'High' ? 'danger-tag' : ''}`}>
                              {item.priority}
                            </span>
                          )}
                        </div>
                      )}

                      <span className={`status-badge ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="muted sm" style={{ margin: '4px 0', lineHeight: 1.5 }}>
                      {item.description}
                    </p>

                    {/* Metadata: Owner & Deadline with Ambiguity flags */}
                    <div className="row" style={{ gap: '18px', margin: '4px 0', flexWrap: 'wrap' }}>
                      <div className="row" style={{ gap: '6px' }}>
                        <span className="muted sm">Assignee:</span>
                        {isEditing ? (
                          <input 
                            className="input-field" 
                            style={{ width: '130px', padding: '4px 8px', height: '28px' }}
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

                      <div className="row" style={{ gap: '6px' }}>
                        <span className="muted sm">Due Date:</span>
                        {isEditing ? (
                          <input 
                            type="date"
                            className="input-field" 
                            style={{ width: '130px', padding: '4px 8px', height: '28px' }}
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

                      {item.sourceMeetingTitle && (
                        <div className="row" style={{ gap: '6px', marginLeft: 'auto' }}>
                          <span className="muted sm">Source:</span>
                          <Link 
                            to={`/transcripts/${item.sourceMeetingId}/analysis`}
                            className="link row" 
                            style={{ gap: '3px' }}
                          >
                            <span>{item.sourceMeetingTitle}</span>
                            <ExternalLink size={11} />
                          </Link>
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

                    {/* Approval Action Buttons */}
                    <div className="between" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '8px' }}>
                      <div className="row">
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
                            <Edit3 size={13} /> Edit
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
                          <span className="muted sm" style={{ color: '#16a34a', fontWeight: 600 }}>
                            ✓ Approved
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
    </div>
  )
}
