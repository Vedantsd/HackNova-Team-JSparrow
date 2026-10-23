// Service layer. NO endpoints are implemented yet — these are EXPECTED contracts.
// Set VITE_API_BASE_URL in .env (no secrets; Gemini keys stay on the Flask backend).
const BASE = import.meta.env.VITE_API_BASE_URL || ''
async function req(path, opts) {
  const r = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!r.ok) throw new Error(`Request failed: ${r.status}`)
  return r.json()
}
export const api = {
  listMeetings: () => req('/api/meetings'),
  getMeeting: id => req(`/api/meetings/${id}`),
  uploadTranscript: body => req('/api/transcripts', { method: 'POST', body: JSON.stringify(body) }),
  listActionItems: () => req('/api/action-items'),
  approveActionItem: id => req(`/api/action-items/${id}/approve`, { method: 'POST' }), // human approval required
}
