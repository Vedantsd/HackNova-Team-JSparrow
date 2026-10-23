// Service layer connecting to backend REST API or local persistent transcriptStore
// Set VITE_API_BASE_URL in .env (Gemini API keys stay safely on Flask backend).
import { transcriptStore } from './transcriptStore.js'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

async function req(path, opts) {
  if (!BASE) return null
  const r = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!r.ok) throw new Error(`Request failed: ${r.status}`)
  return r.json()
}

export const api = {
  // Transcripts & Meetings
  listMeetings: () => req('/api/meetings'),
  getMeeting: id => req(`/api/meetings/${id}`),

  listTranscripts: async () => {
    try {
      const res = await req('/api/transcripts')
      if (res) return res
    } catch {}
    return transcriptStore.getTranscripts()
  },

  getTranscript: async id => {
    try {
      const res = await req(`/api/transcripts/${id}`)
      if (res) return res
    } catch {}
    return transcriptStore.getTranscript(id)
  },

  uploadTranscript: async data => {
    try {
      const res = await req('/api/transcripts', { method: 'POST', body: JSON.stringify(data) })
      if (res) return res
    } catch {}
    return transcriptStore.addTranscript(data)
  },

  retryTranscriptProcessing: async id => {
    try {
      const res = await req(`/api/transcripts/${id}/retry`, { method: 'POST' })
      if (res) return res
    } catch {}
    return transcriptStore.retryProcessing(id)
  },

  // Action Items
  listActionItems: async () => {
    try {
      const res = await req('/api/action-items')
      if (res) return res
    } catch {}
    return transcriptStore.getAllActionItems()
  },

  approveActionItem: async (transcriptId, actionItemId) => {
    try {
      await req(`/api/action-items/${actionItemId}/approve`, { method: 'POST' })
    } catch {}
    return transcriptStore.updateActionItemStatus(transcriptId, actionItemId, 'Approved')
  },

  rejectActionItem: async (transcriptId, actionItemId) => {
    try {
      await req(`/api/action-items/${actionItemId}/reject`, { method: 'POST' })
    } catch {}
    return transcriptStore.updateActionItemStatus(transcriptId, actionItemId, 'Rejected')
  },

  editActionItem: async (transcriptId, actionItemId, updates) => {
    try {
      await req(`/api/action-items/${actionItemId}`, { method: 'PUT', body: JSON.stringify(updates) })
    } catch {}
    return transcriptStore.editActionItem(transcriptId, actionItemId, updates)
  }
}
