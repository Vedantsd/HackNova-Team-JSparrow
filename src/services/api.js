// Service layer connecting to backend REST API or local persistent transcriptStore
// Set VITE_API_BASE_URL in .env if running frontend on different host (secrets stay safely on backend).
import { transcriptStore } from './transcriptStore.js'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, { 
    headers: { 'Content-Type': 'application/json' }, 
    ...opts 
  })
  if (!r.ok) throw new Error(`Request failed: ${r.status}`)
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
  }
}
