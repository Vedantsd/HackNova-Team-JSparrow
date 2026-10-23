import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Trello,
  ExternalLink,
  RefreshCw,
  Plus,
  CheckCircle,
  Clock,
  User,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Link2,
  Unlink,
  Search,
  Check
} from 'lucide-react'
import { api } from '../services/api.js'

export default function TrelloBoard() {
  const [boardData, setBoardData] = useState({
    connected: false,
    live: false,
    boardUrl: '',
    boardName: 'CommitFlow Tasks',
    columns: { todo: [], inprogress: [], done: [] },
    lastSyncedAt: ''
  })
  const [statusInfo, setStatusInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Connection Modal state
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [connectError, setConnectError] = useState('')
  const [connecting, setConnecting] = useState(false)

  // New Task Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    status: 'Pending Approval',
    deadline: ''
  })
  const [creating, setCreating] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [boardRes, statusRes] = await Promise.all([
        api.getTrelloBoard().catch(() => null),
        api.getTrelloStatus().catch(() => null)
      ])

      if (boardRes && boardRes.columns) {
        setBoardData(boardRes)
      }
      if (statusRes) {
        setStatusInfo(statusRes)
      }
    } catch (e) {
      console.error('Failed to load Trello board data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSync = async () => {
    try {
      setSyncing(true)
      await api.syncTrello()
      await loadData()
    } catch (e) {
      console.error('Sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    if (!tokenInput.trim()) {
      setConnectError('Please enter your Trello token.')
      return
    }
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

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Trello? Your tasks will remain in CommitFlow.')) {
      return
    }
    try {
      await api.disconnectTrello()
      await loadData()
    } catch (e) {
      console.error('Failed to disconnect:', e)
    }
  }

  const handleMoveCard = async (item, targetColumn) => {
    const statusMap = {
      todo: 'Pending Approval',
      inprogress: 'Approved',
      done: 'Completed'
    }
    const newStatus = statusMap[targetColumn]

    // Optimistically update UI
    setBoardData(prev => {
      const nextColumns = {
        todo: prev.columns.todo.filter(c => c.id !== item.id),
        inprogress: prev.columns.inprogress.filter(c => c.id !== item.id),
        done: prev.columns.done.filter(c => c.id !== item.id)
      }
      const updatedItem = { ...item, status: newStatus }
      nextColumns[targetColumn] = [updatedItem, ...nextColumns[targetColumn]]
      return { ...prev, columns: nextColumns }
    })

    try {
      if (item.trelloCardId) {
        await api.updateTrelloCard(item.trelloCardId, { status: newStatus })
      } else {
        await api.editActionItem(item.sourceMeetingId || null, item.id, { status: newStatus })
      }
    } catch (e) {
      console.error('Failed to update card status:', e)
      loadData()
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!newTaskForm.title.trim()) return

    try {
      setCreating(true)
      await api.createTrelloCard(newTaskForm)
      setShowCreateModal(false)
      setNewTaskForm({ title: '', description: '', status: 'Pending Approval', deadline: '' })
      await loadData()
    } catch (e) {
      console.error('Failed to create task:', e)
    } finally {
      setCreating(false)
    }
  }

  // Filter cards by search query
  const filteredColumns = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const filterList = (list = []) => {
      if (!q) return list
      return list.filter(card =>
        card.title?.toLowerCase().includes(q) ||
        card.description?.toLowerCase().includes(q) ||
        card.owner?.toLowerCase().includes(q)
      )
    }
    return {
      todo: filterList(boardData.columns?.todo),
      inprogress: filterList(boardData.columns?.inprogress),
      done: filterList(boardData.columns?.done)
    }
  }, [boardData.columns, searchQuery])

  const authUrl = statusInfo?.authUrl || 'https://trello.com/1/authorize?expiration=never&name=CommitFlow&scope=read,write&response_type=token&key=3eb17ed1dcc1ff335a7e317b1abd6a67'

  return (
    <div className="trello-board-page stack" style={{ gap: '20px' }}>
      {/* Top Banner / Integration Bar */}
      <section className="panel" style={{ overflow: 'hidden' }}>
        <div className="phead" style={{ borderBottom: '1px solid var(--color-border)', padding: '16px 20px' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '16px', width: '100%' }}>
            <div>
              <div className="row" style={{ gap: '10px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #0079bf 0%, #005a8e 100%)',
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(0, 121, 191, 0.35)'
                }}>
                  <Trello size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Trello Task Dashboard
                    {statusInfo?.connected ? (
                      <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                        ● Connected
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                        Sync Standby
                      </span>
                    )}
                  </h2>
                  <p className="muted sm" style={{ margin: '2px 0 0' }}>
                    Bidirectional task synchronization between CommitFlow meetings and your Trello board.
                  </p>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: '10px' }}>
              {statusInfo?.connected && boardData.boardUrl && (
                <a
                  href={boardData.boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn sm"
                  style={{
                    background: 'rgba(0, 121, 191, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}
                >
                  <ExternalLink size={13} /> Open Trello Board
                </a>
              )}

              <button
                className="btn sm"
                onClick={handleSync}
                disabled={syncing}
                title="Sync all tasks between CommitFlow and Trello"
              >
                <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync with Trello'}
              </button>

              {statusInfo?.connected ? (
                <button
                  className="btn sm"
                  onClick={handleDisconnect}
                  title="Disconnect Trello account"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <Unlink size={13} /> Disconnect
                </button>
              ) : (
                <button
                  className="btn primary sm"
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #0079bf, #0284c7)',
                    borderColor: '#0284c7'
                  }}
                >
                  <Link2 size={13} /> Connect Trello
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search, Filter & Quick Actions Bar */}
        <div className="pbody" style={{ padding: '12px 20px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="row" style={{ gap: '10px', flex: 1, minWidth: '240px', maxWidth: '420px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search tasks, descriptions, assignees..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div className="row" style={{ gap: '10px' }}>
              {boardData.lastSyncedAt && (
                <span className="muted sm" style={{ fontSize: '12px' }}>
                  Last Synced: <b style={{ color: 'var(--color-text)' }}>{boardData.lastSyncedAt}</b>
                </span>
              )}

              <button className="btn primary sm" onClick={() => setShowCreateModal(true)}>
                <Plus size={14} /> New Task
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Kanban Board Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '18px',
        alignItems: 'flex-start'
      }}>
        {/* Column 1: TO DO */}
        <div className="panel" style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <div className="phead" style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 16px', background: 'rgba(255,255,255,0.02)' }}>
            <div className="between" style={{ width: '100%' }}>
              <div className="row" style={{ gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                <b style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To Do</b>
              </div>
              <span className="badge">{filteredColumns.todo.length}</span>
            </div>
          </div>

          <div className="pbody stack" style={{ padding: '14px', gap: '12px', minHeight: '350px' }}>
            {filteredColumns.todo.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--color-muted)', fontSize: '13px' }}>
                No tasks in To Do
              </div>
            ) : (
              filteredColumns.todo.map(card => (
                <TaskCard
                  key={card.id}
                  card={card}
                  currentCol="todo"
                  onMove={(target) => handleMoveCard(card, target)}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: IN PROGRESS */}
        <div className="panel" style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <div className="phead" style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 16px', background: 'rgba(255,255,255,0.02)' }}>
            <div className="between" style={{ width: '100%' }}>
              <div className="row" style={{ gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0ea5e9' }} />
                <b style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Progress</b>
              </div>
              <span className="badge">{filteredColumns.inprogress.length}</span>
            </div>
          </div>

          <div className="pbody stack" style={{ padding: '14px', gap: '12px', minHeight: '350px' }}>
            {filteredColumns.inprogress.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--color-muted)', fontSize: '13px' }}>
                No tasks in progress
              </div>
            ) : (
              filteredColumns.inprogress.map(card => (
                <TaskCard
                  key={card.id}
                  card={card}
                  currentCol="inprogress"
                  onMove={(target) => handleMoveCard(card, target)}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: DONE */}
        <div className="panel" style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <div className="phead" style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 16px', background: 'rgba(255,255,255,0.02)' }}>
            <div className="between" style={{ width: '100%' }}>
              <div className="row" style={{ gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                <b style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Done</b>
              </div>
              <span className="badge">{filteredColumns.done.length}</span>
            </div>
          </div>

          <div className="pbody stack" style={{ padding: '14px', gap: '12px', minHeight: '350px' }}>
            {filteredColumns.done.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--color-muted)', fontSize: '13px' }}>
                No completed tasks
              </div>
            ) : (
              filteredColumns.done.map(card => (
                <TaskCard
                  key={card.id}
                  card={card}
                  currentCol="done"
                  onMove={(target) => handleMoveCard(card, target)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Connect Trello Modal */}
      {showConnectModal && (
        <div className="modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header between">
              <div className="row" style={{ gap: '10px' }}>
                <div style={{
                  background: '#0079bf',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '4px',
                  display: 'flex'
                }}>
                  <Trello size={18} />
                </div>
                <h3>Connect Trello Account</h3>
              </div>
              <button className="btn icon-only sm" onClick={() => setShowConnectModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConnect} className="modal-body stack" style={{ gap: '16px', marginTop: '12px' }}>
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

      {/* New Task Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header between">
              <h3>Create New Task</h3>
              <button className="btn icon-only sm" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="modal-body stack" style={{ gap: '14px', marginTop: '12px' }}>
              <div>
                <label className="muted sm" style={{ display: 'block', marginBottom: '4px' }}>Task Title *</label>
                <input
                  className="input-field"
                  placeholder="e.g., Update security authentication flow"
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm(f => ({ ...f, title: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="muted sm" style={{ display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Add details, acceptance criteria, or notes..."
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="row" style={{ gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="muted sm" style={{ display: 'block', marginBottom: '4px' }}>Initial Column</label>
                  <select
                    className="input-field"
                    value={newTaskForm.status}
                    onChange={e => setNewTaskForm(f => ({ ...f, status: e.target.value }))}
                  >
                    <option value="Pending Approval">To Do</option>
                    <option value="Approved">In Progress</option>
                    <option value="Completed">Done</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label className="muted sm" style={{ display: 'block', marginBottom: '4px' }}>Due Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={newTaskForm.deadline}
                    onChange={e => setNewTaskForm(f => ({ ...f, deadline: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer row" style={{ justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary sm" disabled={creating || !newTaskForm.title.trim()}>
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskCard({ card, currentCol, onMove }) {
  const isTrelloLinked = Boolean(card.trelloCardUrl || card.trelloCardId)
  const cardUrl = card.trelloCardUrl || (card.trelloCardId ? `https://trello.com/c/${card.trelloCardId}` : null)

  return (
    <div
      className="mcard col"
      style={{
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'transform 0.15s ease, border-color 0.15s ease'
      }}
    >
      <div className="between" style={{ alignItems: 'flex-start', gap: '8px' }}>
        <b style={{ fontSize: '14px', lineHeight: 1.3 }}>{card.title}</b>
        {card.priority && (
          <span className={`tag ${card.priority === 'High' ? 'danger-tag' : ''}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
            {card.priority}
          </span>
        )}
      </div>

      {card.description && (
        <p className="muted sm" style={{ margin: '6px 0', fontSize: '12px', lineHeight: 1.4 }}>
          {card.description}
        </p>
      )}

      {/* Meta tags */}
      <div className="row" style={{ gap: '10px', margin: '6px 0', flexWrap: 'wrap', fontSize: '12px' }}>
        {card.owner && (
          <span className="row muted" style={{ gap: '4px' }}>
            <User size={12} /> {card.owner}
          </span>
        )}
        {card.deadline && card.deadline !== 'Unspecified' && (
          <span className="row muted" style={{ gap: '4px' }}>
            <Clock size={12} /> {card.deadline}
          </span>
        )}
        {card.sourceMeetingTitle && (
          <span className="muted" style={{ fontSize: '11px', opacity: 0.85 }}>
            📌 {card.sourceMeetingTitle}
          </span>
        )}
      </div>

      {/* Trello Link & Move Buttons */}
      <div className="between" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          {cardUrl ? (
            <a
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="row"
              style={{
                gap: '4px',
                color: '#38bdf8',
                fontSize: '11px',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              <Trello size={12} /> Open in Trello <ExternalLink size={10} />
            </a>
          ) : (
            <span className="muted" style={{ fontSize: '11px' }}>Local Task</span>
          )}
        </div>

        <div className="row" style={{ gap: '4px' }}>
          {currentCol !== 'todo' && (
            <button
              className="btn sm icon-only"
              title="Move left"
              onClick={() => onMove(currentCol === 'done' ? 'inprogress' : 'todo')}
              style={{ padding: '3px 6px', height: '24px' }}
            >
              <ArrowLeft size={12} />
            </button>
          )}

          {currentCol !== 'done' && (
            <button
              className="btn sm icon-only"
              title="Move right"
              onClick={() => onMove(currentCol === 'todo' ? 'inprogress' : 'done')}
              style={{ padding: '3px 6px', height: '24px' }}
            >
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
