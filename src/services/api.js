// Service layer connecting to backend REST API or local persistent transcriptStore
// Set VITE_API_BASE_URL in .env if running frontend on different host (secrets stay safely on backend).
import { transcriptStore } from './transcriptStore.js'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

async function req(path, opts = {}) {
  const token = localStorage.getItem('cf_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(opts.headers || {})
  }

  const r = await fetch(BASE + path, { 
    credentials: 'include',
    ...opts,
    headers
  })

  if (!r.ok) {
    const errData = await r.json().catch(() => ({}))
    throw new Error(errData.error || errData.message || `Request failed with status ${r.status}`)
  }
  return r.json()
}

export const api = {
  // System Health
  getHealth: async () => {
    try {
      return await req('/api/health')
    } catch {
      return {
        status: 'offline',
        database: { connected: false, message: 'Backend server offline' },
        gemini: { configured: false, message: 'Backend server offline' }
      }
    }
  },

  // Transcripts & Meetings
  listMeetings: () => req('/api/meetings'),
  getMeeting: id => req(`/api/meetings/${id}`),
  createMeeting: (data = {}) => req('/api/meetings', { method: 'POST', body: JSON.stringify(data) }),
  getMeetingToken: (meetingId) => req(`/api/meetings/${meetingId}/livekit-token`, { method: 'POST' }),
  getCalendar: (year, month) => req(`/api/calendar?year=${year}&month=${month}`),

  listTranscripts: async () => {
    try {
      const res = await req('/api/transcripts')
      if (Array.isArray(res)) {
        return res
      }
    } catch (e) {
      // Backend unavailable; use local store
    }
    return transcriptStore.getTranscripts()
  },

  getTranscript: async id => {
    try {
      const res = await req(`/api/transcripts/${id}`)
      if (res && res.id) return res
    } catch (e) {
      // Fallback
    }
    return transcriptStore.getTranscript(id)
  },

  uploadTranscript: async data => {
    try {
      const res = await req('/api/transcripts', { method: 'POST', body: JSON.stringify(data) })
      if (res && res.id) return res
    } catch (e) {
      // Fallback
    }
    return transcriptStore.addTranscript(data)
  },

  retryTranscriptProcessing: async id => {
    try {
      const res = await req(`/api/transcripts/${id}/retry`, { method: 'POST' })
      if (res) return res
    } catch (e) {
      // Fallback
    }
    return transcriptStore.retryProcessing(id)
  },

  // Action Items
  listActionItems: async () => {
    try {
      const res = await req('/api/action-items')
      if (Array.isArray(res)) return res
    } catch (e) {
      // Fallback
    }
    return transcriptStore.getAllActionItems()
  },

  approveActionItem: async (transcriptId, actionItemId) => {
    try {
      const res = await req(`/api/action-items/${actionItemId}/approve`, { method: 'POST' })
      if (res) return true
    } catch (e) {}
    return transcriptStore.updateActionItemStatus(transcriptId, actionItemId, 'Approved')
  },

  rejectActionItem: async (transcriptId, actionItemId) => {
    try {
      const res = await req(`/api/action-items/${actionItemId}/reject`, { method: 'POST' })
      if (res) return true
    } catch (e) {}
    return transcriptStore.updateActionItemStatus(transcriptId, actionItemId, 'Rejected')
  },

  editActionItem: async (transcriptId, actionItemId, updates) => {
    try {
      const res = await req(`/api/action-items/${actionItemId}`, { method: 'PUT', body: JSON.stringify(updates) })
      if (res) return true
    } catch (e) {}
    return transcriptStore.editActionItem(transcriptId, actionItemId, updates)
  },

  bulkApproveActionItems: async (actionIds) => {
    return await req('/api/action-items/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ actionIds })
    })
  },

  getActiveUsers: async () => {
    try {
      return await req('/api/users/active')
    } catch (e) {
      return []
    }
  },

  getExportTasksUrl: (format = 'csv', transcriptId = null) => {
    let url = `${BASE}/api/action-items/export?format=${format}&onlyApproved=true`
    if (transcriptId) url += `&transcriptId=${transcriptId}`
    return url
  },

  exportTasksJson: async (transcriptId = null) => {
    let url = `/api/action-items/export?format=json&onlyApproved=true`
    if (transcriptId) url += `&transcriptId=${transcriptId}`
    return await req(url)
  },

  // Unresolved Questions & Follow-ups
  listUnresolvedQuestions: async (status = null) => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      return await req(`/api/unresolved-questions${qs}`)
    } catch (e) {
      return []
    }
  },

  updateUnresolvedQuestion: async (questionId, data) => {
    return await req(`/api/unresolved-questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  createUnresolvedQuestion: async (data) => {
    return await req('/api/unresolved-questions', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  getTeamLeadFollowUps: async (status = null) => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      return await req(`/api/team-lead/follow-ups${qs}`)
    } catch (e) {
      return []
    }
  },

  // -------------------------------------------------------------
  // Authentication & Session
  // -------------------------------------------------------------
  login: async (email, password) => {
    return await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  },

  register: async ({ name, email, password, confirmPassword }) => {
    return await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirmPassword })
    })
  },

  logout: async () => {
    try {
      return await req('/api/auth/logout', { method: 'POST' })
    } catch {
      return { message: 'Logged out' }
    }
  },

  getMe: async () => {
    return await req('/api/auth/me')
  },

  // -------------------------------------------------------------
  // Admin Panel APIs
  // -------------------------------------------------------------
  getAdminStats: async () => {
    return await req('/api/admin/stats')
  },

  getAdminUsers: async (params = {}) => {
    const q = new URLSearchParams()
    if (params.search) q.set('search', params.search)
    if (params.role) q.set('role', params.role)
    if (params.status) q.set('status', params.status)
    if (params.limit) q.set('limit', params.limit)
    if (params.offset) q.set('offset', params.offset)
    const qs = q.toString()
    return await req('/api/admin/users' + (qs ? `?${qs}` : ''))
  },

  updateUserStatus: async (userId, status) => {
    return await req(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  },

  updateUserRole: async (userId, role) => {
    return await req(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    })
  },

  getAdminMeetings: async (params = {}) => {
    const q = new URLSearchParams()
    if (params.limit) q.set('limit', params.limit)
    if (params.offset) q.set('offset', params.offset)
    const qs = q.toString()
    return await req('/api/admin/meetings' + (qs ? `?${qs}` : ''))
  },

  investigateMeeting: async (meetingId) => {
    return await req(`/api/admin/meetings/${meetingId}/investigate`)
  },

  getAdminAuditLogs: async (params = {}) => {
    const q = new URLSearchParams()
    if (params.action) q.set('action', params.action)
    if (params.limit) q.set('limit', params.limit)
    if (params.offset) q.set('offset', params.offset)
    const qs = q.toString()
    return await req('/api/admin/audit-logs' + (qs ? `?${qs}` : ''))
  },

  getAdminSystemHealth: async () => {
    return await req('/api/admin/system-health')
  },

  getAdminSettings: async () => {
    return await req('/api/admin/settings')
  },

  updateAdminSettings: async (settings) => {
    return await req('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
  },

  // -------------------------------------------------------------
  // Admin Teams APIs
  // -------------------------------------------------------------
  getAdminTeams: () => req('/api/admin/teams'),
  createAdminTeam: (data) => req('/api/admin/teams', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminTeam: (teamId, data) => req(`/api/admin/teams/${teamId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminTeam: (teamId) => req(`/api/admin/teams/${teamId}`, { method: 'DELETE' }),
  getAdminTeamMembers: (teamId) => req(`/api/admin/teams/${teamId}/members`),
  addAdminTeamMember: (teamId, data) => req(`/api/admin/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  removeAdminTeamMember: (teamId, userId) => req(`/api/admin/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  getAdminEligibleLeads: () => req('/api/admin/eligible-leads'),

  // -------------------------------------------------------------
  // Team Lead APIs
  // -------------------------------------------------------------
  getTeamLeadDashboard: () => req('/api/team-lead/dashboard'),
  getTeamLeadTeam: () => req('/api/team-lead/team'),
  addTeamLeadMember: (data) => req('/api/team-lead/team/members', { method: 'POST', body: JSON.stringify(data) }),
  removeTeamLeadMember: (userId) => req(`/api/team-lead/team/members/${userId}`, { method: 'DELETE' }),
  getTeamLeadAvailableUsers: () => req('/api/team-lead/available-users'),
  getTeamLeadMeetings: (params = {}) => {
    const q = new URLSearchParams()
    if (params.limit) q.set('limit', params.limit)
    if (params.offset) q.set('offset', params.offset)
    const qs = q.toString()
    return req('/api/team-lead/meetings' + (qs ? `?${qs}` : ''))
  },
  createTeamLeadMeeting: (data) => req('/api/team-lead/meetings', { method: 'POST', body: JSON.stringify(data) }),
  getTeamLeadCalendar: (year, month) => req(`/api/team-lead/calendar?year=${year}&month=${month}`),
  getTeamLeadTranscripts: () => req('/api/team-lead/transcripts'),
  getTeamLeadAnalysis: (transcriptId) => req(`/api/team-lead/transcripts/${transcriptId}/analysis`),
  getTeamLeadActionItems: () => req('/api/team-lead/action-items'),
  assignTeamLeadActionItem: (actionId, assigneeId) => req(`/api/team-lead/action-items/${actionId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ assigneeId })
  }),
  updateTeamLeadActionItem: (actionId, data) => req(`/api/team-lead/action-items/${actionId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  getTeamLeadReports: () => req('/api/team-lead/reports'),

  // -------------------------------------------------------------
  // Trello Project Management Integration APIs
  // -------------------------------------------------------------
  getTrelloStatus: () => req('/api/trello/status'),
  connectTrello: (token) => req('/api/trello/connect', { method: 'POST', body: JSON.stringify({ token }) }),
  disconnectTrello: () => req('/api/trello/disconnect', { method: 'POST' }),
  syncTrello: () => req('/api/trello/sync', { method: 'POST' }),
  getTrelloBoard: () => req('/api/trello/board'),
  exportActionItemToTrello: (actionId) => req(`/api/trello/export/${actionId}`, { method: 'POST' }),
  createTrelloCard: (data) => req('/api/trello/cards', { method: 'POST', body: JSON.stringify(data) }),
  updateTrelloCard: (cardId, data) => req(`/api/trello/cards/${cardId}`, { method: 'PUT', body: JSON.stringify(data) })
}
