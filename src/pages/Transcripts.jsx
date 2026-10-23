import { useState, useEffect, useMemo } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { 
  FileUp, 
  FileText, 
  Copy, 
  Check, 
  Download, 
  Search, 
  Clock, 
  Users, 
  Sparkles,
  Upload,
  Video
} from 'lucide-react'
import Modal from '../components/Modal.jsx'
import { transcript as demoTranscript, liveTranscript } from '../data/demo.js'

// Initial seed transcripts from external apps and CommitFlow
const INITIAL_TRANSCRIPTS = [
  {
    id: 'zoom-client-review',
    title: 'Client Architecture Review - Acme Corp',
    source: 'Zoom',
    sourceColor: '#2d8cff',
    date: 'Yesterday, 2:30 PM',
    duration: '45 min',
    participants: ['Alex Rivera', 'David Chen', 'Elena Rostova', 'Michael Chang'],
    entries: [
      { who: 'Alex Rivera', t: '00:01', text: "Thanks for joining everyone. Today we're reviewing the Acme Corp cloud migration plan." },
      { who: 'David Chen', t: '00:15', text: "We have finalized the {Kubernetes cluster architecture} on AWS. I will document the IAM roles by Wednesday." },
      { who: 'Elena Rostova', t: '00:32', text: "Great. I'll prepare the {database backup and failover} strategy and share the draft with security." },
      { who: 'Michael Chang', t: '00:48', text: "We also need to ensure compliance logs are retained for 90 days. I can verify the policy." },
      { who: 'Alex Rivera', t: '01:05', text: "Confirmed. Let's reconvene on Thursday to approve the migration checklist before execution." }
    ]
  },
  {
    id: 'meet-q4-product',
    title: 'Q4 Product Roadmap & Feature Finalization',
    source: 'Google Meet',
    sourceColor: '#00ac47',
    date: 'Today, 10:00 AM',
    duration: '35 min',
    participants: ['Sarah Nguyen', 'James Chen', 'Maria Kim'],
    entries: demoTranscript.map((t, idx) => ({
      who: t.who,
      t: `10:1${idx + 2}`,
      text: t.text
    }))
  },
  {
    id: 'teams-eng-standup',
    title: 'Daily Engineering Standup',
    source: 'Microsoft Teams',
    sourceColor: '#505ac9',
    date: 'Oct 21, 9:30 AM',
    duration: '20 min',
    participants: ['John Bergson', 'Sarah Franci', 'Lydia Botosh'],
    entries: liveTranscript.map(t => ({
      who: t.who,
      t: t.t,
      text: t.text
    }))
  }
]

// Flexible transcript parser supporting Zoom, Teams, Google Meet, WebVTT, SRT, and plain text
export function parseTranscriptText(text) {
  if (!text || !text.trim()) return []

  const lines = text.split(/\r?\n/)
  const entries = []
  let currentSpeaker = ''
  let currentTime = ''
  let currentText = []

  const commit = () => {
    if (currentText.length > 0) {
      entries.push({
        who: currentSpeaker || 'Participant',
        t: currentTime || '',
        text: currentText.join(' ').trim()
      })
      currentText = []
    }
  }

  // Regex patterns for various meeting app transcript formats
  const bracketTimeSpeaker = /^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s+([^:]+):\s*(.*)$/i
  const speakerTime = /^([^:(]+?)\s*[\(\[](\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)[\)\]]:?\s*(.*)$/i
  const speakerOnly = /^([A-Z][a-zA-Z0-9\s.-]{1,30}):\s*(.*)$/
  const vttTimestamp = /^\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?/
  const vttVoice = /^<v\s+([^>]+)>(.*)$/

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine || rawLine === 'WEBVTT' || /^\d+$/.test(rawLine)) {
      continue
    }

    if (vttTimestamp.test(rawLine)) {
      const match = rawLine.match(/^(\d{1,2}:\d{2}(?::\d{2})?)/)
      currentTime = match ? match[1] : ''
      continue
    }

    const voiceMatch = rawLine.match(vttVoice)
    if (voiceMatch) {
      commit()
      currentSpeaker = voiceMatch[1].trim()
      if (voiceMatch[2].trim()) currentText.push(voiceMatch[2].trim())
      continue
    }

    const bMatch = rawLine.match(bracketTimeSpeaker)
    if (bMatch) {
      commit()
      currentTime = bMatch[1].trim()
      currentSpeaker = bMatch[2].trim()
      if (bMatch[3].trim()) currentText.push(bMatch[3].trim())
      continue
    }

    const stMatch = rawLine.match(speakerTime)
    if (stMatch) {
      commit()
      currentSpeaker = stMatch[1].trim()
      currentTime = stMatch[2].trim()
      if (stMatch[3].trim()) currentText.push(stMatch[3].trim())
      continue
    }

    const sMatch = rawLine.match(speakerOnly)
    if (sMatch) {
      commit()
      currentSpeaker = sMatch[1].trim()
      currentTime = currentTime || ''
      if (sMatch[2].trim()) currentText.push(sMatch[2].trim())
      continue
    }

    // Continuation line
    currentText.push(rawLine)
  }
  commit()

  // Fallback if no speaker delimiters matched: group paragraphs
  if (entries.length === 0) {
    const paragraphs = text.split(/\n\s*\n/)
    paragraphs.forEach((p, idx) => {
      const clean = p.trim()
      if (clean) {
        entries.push({
          who: `Speaker ${(idx % 3) + 1}`,
          t: '',
          text: clean
        })
      }
    })
  }

  return entries
}

const highlightMarks = text => 
  text.split(/(\{[^}]+\})/).map((p, i) => 
    p.startsWith('{') ? <mark key={i}>{p.slice(1, -1)}</mark> : p
  )

const getInitials = name => 
  (name || 'P').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()

export default function Transcripts() {
  const { query = '' } = useOutletContext() || {}
  const [searchParams] = useSearchParams()
  const [transcripts, setTranscripts] = useState(() => {
    try {
      const saved = localStorage.getItem('cf-transcripts')
      if (saved) return JSON.parse(saved)
    } catch {}
    return INITIAL_TRANSCRIPTS
  })

  const [selectedId, setSelectedId] = useState(() => transcripts[0]?.id || '')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [innerSearch, setInnerSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)

  // Upload modal form state
  const [uploadMode, setUploadMode] = useState('file') // 'file' | 'paste'
  const [formTitle, setFormTitle] = useState('')
  const [formSource, setFormSource] = useState('Zoom')
  const [formText, setFormText] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Open modal if ?upload=true query param is present
  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setShowModal(true)
    }
  }, [searchParams])

  // Save to localStorage when transcripts change
  useEffect(() => {
    try {
      localStorage.setItem('cf-transcripts', JSON.stringify(transcripts))
    } catch {}
  }, [transcripts])

  const selectedTranscript = useMemo(() => {
    return transcripts.find(t => t.id === selectedId) || transcripts[0] || null
  }, [transcripts, selectedId])

  // Filtered transcript list
  const filteredList = useMemo(() => {
    const q = query.toLowerCase()
    return transcripts.filter(t => {
      const matchSource = sourceFilter === 'all' || t.source.toLowerCase() === sourceFilter.toLowerCase()
      const matchQuery = !q || 
        t.title.toLowerCase().includes(q) || 
        t.source.toLowerCase().includes(q) ||
        t.entries.some(e => e.text.toLowerCase().includes(q) || e.who.toLowerCase().includes(q))
      return matchSource && matchQuery
    })
  }, [transcripts, sourceFilter, query])

  // Filter entries in the selected transcript
  const displayedEntries = useMemo(() => {
    if (!selectedTranscript) return []
    if (!innerSearch.trim()) return selectedTranscript.entries
    const s = innerSearch.toLowerCase()
    return selectedTranscript.entries.filter(e => 
      e.who.toLowerCase().includes(s) || e.text.toLowerCase().includes(s)
    )
  }, [selectedTranscript, innerSearch])

  // Handle file drop / input
  const processFile = file => {
    if (!file) return
    setFileName(file.name)
    if (!formTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setFormTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1))
    }
    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result || ''
      setFormText(content)
    }
    reader.readAsText(file)
  }

  const handleDrop = e => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  // Parse preview
  const parsedPreview = useMemo(() => {
    if (!formText.trim()) return []
    return parseTranscriptText(formText)
  }, [formText])

  const detectedSpeakers = useMemo(() => {
    const set = new Set(parsedPreview.map(p => p.who))
    return Array.from(set)
  }, [parsedPreview])

  // Source colors
  const getSourceColor = src => {
    switch (src) {
      case 'Zoom': return '#2d8cff'
      case 'Google Meet': return '#00ac47'
      case 'Microsoft Teams': return '#505ac9'
      case 'Slack Huddle': return '#4a154b'
      case 'Webex': return '#00b4d8'
      default: return '#4f46e5'
    }
  }

  const handleSaveUpload = () => {
    if (!formTitle.trim() || !formText.trim()) return

    const parsedEntries = parseTranscriptText(formText)
    const speakers = Array.from(new Set(parsedEntries.map(e => e.who)))
    
    const newTranscript = {
      id: 'transcript-' + Date.now(),
      title: formTitle.trim(),
      source: formSource,
      sourceColor: getSourceColor(formSource),
      date: 'Just now',
      duration: `${Math.max(1, Math.round(parsedEntries.length * 1.5))} min`,
      participants: speakers.length ? speakers : ['Participant'],
      entries: parsedEntries
    }

    setTranscripts(prev => [newTranscript, ...prev])
    setSelectedId(newTranscript.id)
    setShowModal(false)

    // Reset form
    setFormTitle('')
    setFormText('')
    setFileName('')
    setFormSource('Zoom')
  }

  const handleCopyTranscript = () => {
    if (!selectedTranscript) return
    const text = selectedTranscript.entries
      .map(e => `${e.who}${e.t ? ` (${e.t})` : ''}: ${e.text}`)
      .join('\n\n')
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleDownloadTranscript = () => {
    if (!selectedTranscript) return
    const text = `Meeting: ${selectedTranscript.title}\nSource: ${selectedTranscript.source}\nDate: ${selectedTranscript.date}\nParticipants: ${selectedTranscript.participants.join(', ')}\n\n---\n\n` +
      selectedTranscript.entries
        .map(e => `[${e.t || '--:--'}] ${e.who}:\n${e.text}`)
        .join('\n\n')
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedTranscript.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-transcript.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="transcripts-page stack">
      {/* Page Header Bar */}
      <section className="panel">
        <div className="phead">
          <div className="row">
            <h2>Transcripts</h2>
            <span className="badge">{transcripts.length} total</span>
          </div>
          <div className="row">
            <button 
              className="btn primary" 
              onClick={() => setShowModal(true)}
              aria-label="Upload ready-made transcript"
            >
              <FileUp size={16} />
              <span>Upload Transcript</span>
            </button>
          </div>
        </div>
        <div className="pbody" style={{ paddingBottom: '16px' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="row">
              <span className="muted sm">Filter by source:</span>
              {['all', 'Zoom', 'Google Meet', 'Microsoft Teams', 'Other'].map(src => (
                <button
                  key={src}
                  className={'chip' + (sourceFilter.toLowerCase() === src.toLowerCase() ? ' on' : '')}
                  onClick={() => setSourceFilter(src)}
                >
                  {src}
                </button>
              ))}
            </div>
            <div className="muted sm">
              Import transcripts directly from external apps or local recordings.
            </div>
          </div>
        </div>
      </section>

      {/* Main Two-Column View */}
      <div className="grid2">
        {/* Left: Transcripts List */}
        <section className="panel">
          <div className="phead">
            <h3>Meeting Transcripts</h3>
            <span className="tag">Ready to review</span>
          </div>
          <div className="pbody" style={{ gap: '10px' }}>
            {filteredList.length === 0 ? (
              <div className="mcard col" style={{ textAlign: 'center', padding: '32px 16px' }}>
                <p className="muted">No transcripts match your filter.</p>
                <div style={{ marginTop: '12px' }}>
                  <button className="btn sm primary" onClick={() => setShowModal(true)}>
                    <Upload size={14} /> Upload First Transcript
                  </button>
                </div>
              </div>
            ) : (
              filteredList.map(t => {
                const isSelected = selectedTranscript?.id === t.id
                return (
                  <div
                    key={t.id}
                    className={`mcard transcript-card ${isSelected ? 'active-transcript' : ''}`}
                    onClick={() => setSelectedId(t.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span 
                      className="micon" 
                      style={{ background: t.sourceColor || '#4f46e5' }}
                      title={`Imported from ${t.source}`}
                    >
                      <Video size={18} />
                    </span>
                    <div className="grow">
                      <div className="between" style={{ alignItems: 'flex-start' }}>
                        <b className="sm" style={{ fontSize: '13.5px' }}>{t.title}</b>
                        <span 
                          className="source-badge"
                          style={{ borderColor: t.sourceColor, color: t.sourceColor }}
                        >
                          {t.source}
                        </span>
                      </div>
                      <div className="muted sm meta">
                        <span><Clock size={12} />{t.date}</span>
                        <span><Users size={12} />{t.participants.length} speakers</span>
                        <span><FileText size={12} />{t.entries.length} segments</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Right: Selected Transcript Detail */}
        <section className="panel">
          {selectedTranscript ? (
            <>
              <div className="phead" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                <div className="between" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div className="row" style={{ gap: '8px' }}>
                      <h2>{selectedTranscript.title}</h2>
                      <span 
                        className="source-badge" 
                        style={{ borderColor: selectedTranscript.sourceColor, color: selectedTranscript.sourceColor }}
                      >
                        {selectedTranscript.source}
                      </span>
                    </div>
                    <div className="muted sm meta" style={{ marginTop: '4px' }}>
                      <span><Clock size={12} />{selectedTranscript.date}</span>
                      <span>•</span>
                      <span>{selectedTranscript.duration}</span>
                      <span>•</span>
                      <span>{selectedTranscript.entries.length} spoken segments</span>
                    </div>
                  </div>
                  <div className="row">
                    <button 
                      className="btn sm" 
                      onClick={handleCopyTranscript}
                      title="Copy full transcript"
                    >
                      {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                      <span className="hide-sm">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      className="btn sm" 
                      onClick={handleDownloadTranscript}
                      title="Download as text file"
                    >
                      <Download size={14} />
                      <span className="hide-sm">Export</span>
                    </button>
                  </div>
                </div>

                {/* Inner Search Bar */}
                <div className="search" style={{ width: '100%', height: '36px' }}>
                  <Search size={14} />
                  <input
                    value={innerSearch}
                    onChange={e => setInnerSearch(e.target.value)}
                    placeholder="Search inside this transcript..."
                    aria-label="Search within transcript"
                  />
                  {innerSearch && (
                    <button 
                      className="muted sm" 
                      style={{ background: 'none', border: 0, cursor: 'pointer' }}
                      onClick={() => setInnerSearch('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Dialogue Transcript List */}
              <div className="pbody" style={{ maxHeight: '680px', overflowY: 'auto' }}>
                {displayedEntries.length === 0 ? (
                  <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                    No speech segments match "{innerSearch}".
                  </p>
                ) : (
                  displayedEntries.map((entry, idx) => (
                    <div key={idx} className="line transcript-entry">
                      <span className="avatar sm" style={{ marginTop: '2px' }}>
                        {getInitials(entry.who)}
                      </span>
                      <div className="grow">
                        <div className="row" style={{ gap: '6px', marginBottom: '2px' }}>
                          <b className="sm">{entry.who}</b>
                          {entry.t && <span className="muted sm" style={{ fontSize: '11px' }}>{entry.t}</span>}
                        </div>
                        <div className="transcript-bubble">
                          <p style={{ margin: 0, lineHeight: 1.55 }}>
                            {highlightMarks(entry.text)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="pbody" style={{ textAlign: 'center', padding: '48px 16px' }}>
              <p className="muted">No transcript selected.</p>
            </div>
          )}
        </section>
      </div>

      {/* Upload Ready-Made Transcript Modal */}
      {showModal && (
        <Modal 
          title="Upload Ready-Made Transcript" 
          onClose={() => setShowModal(false)}
          className="wide"
        >
          <p className="muted sm">
            Import a meeting transcript from Zoom, Google Meet, Microsoft Teams, or another tool to generate summaries, action items, and traceable work.
          </p>

          <div className="stack" style={{ gap: '14px', marginTop: '6px' }}>
            {/* Title & Source App Row */}
            <div className="grid2" style={{ gridTemplateColumns: '1fr 180px', gap: '12px' }}>
              <div>
                <label className="sm" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Meeting Name / Title
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. Q4 Sprint Planning or Client Demo"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="sm" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Source Platform
                </label>
                <select
                  className="input-field"
                  value={formSource}
                  onChange={e => setFormSource(e.target.value)}
                >
                  <option value="Zoom">Zoom</option>
                  <option value="Google Meet">Google Meet</option>
                  <option value="Microsoft Teams">Microsoft Teams</option>
                  <option value="Slack Huddle">Slack Huddle</option>
                  <option value="Webex">Webex</option>
                  <option value="Other">Other / External</option>
                </select>
              </div>
            </div>

            {/* Input Mode Selector */}
            <div className="row" style={{ gap: '8px' }}>
              <button
                type="button"
                className={'chip' + (uploadMode === 'file' ? ' on' : '')}
                onClick={() => setUploadMode('file')}
              >
                <Upload size={13} style={{ marginRight: '4px' }} />
                Upload File (.txt, .vtt, .srt, .json)
              </button>
              <button
                type="button"
                className={'chip' + (uploadMode === 'paste' ? ' on' : '')}
                onClick={() => setUploadMode('paste')}
              >
                <FileText size={13} style={{ marginRight: '4px' }} />
                Paste Text Directly
              </button>
            </div>

            {/* File Upload Mode */}
            {uploadMode === 'file' && (
              <div>
                <div
                  className={`dropzone ${dragOver ? 'dragover' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="transcript-file-input"
                    accept=".txt,.vtt,.srt,.json"
                    hidden
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        processFile(e.target.files[0])
                      }
                    }}
                  />
                  <label htmlFor="transcript-file-input" style={{ cursor: 'pointer', display: 'grid', placeItems: 'center', gap: '8px' }}>
                    <FileUp size={28} color="var(--color-primary)" />
                    <div>
                      <b>Click to browse</b> or drag and drop your transcript file
                    </div>
                    <span className="muted sm">Supports .txt, .vtt, .srt, .json files</span>
                  </label>
                </div>
                {fileName && (
                  <div className="row" style={{ marginTop: '8px', gap: '8px' }}>
                    <span className="tag" style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.1)' }}>
                      Selected: {fileName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Paste Text Mode */}
            {uploadMode === 'paste' && (
              <div>
                <label className="sm" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Transcript Dialogue
                </label>
                <textarea
                  className="input-field"
                  rows={7}
                  placeholder={`Example format:\n\n[10:00 AM] Sarah: Let's finalize the sprint deliverables.\n[10:02 AM] Alex: I'll complete the API schema review today.\n[10:05 AM] Maria: I will push the frontend updates by tomorrow.`}
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                />
              </div>
            )}

            {/* Live Parsing Preview Feedback */}
            {formText && (
              <div 
                className="mcard" 
                style={{ 
                  background: 'var(--color-soft)', 
                  padding: '12px',
                  borderRadius: '10px'
                }}
              >
                <Sparkles size={16} color="var(--color-primary)" />
                <div className="grow">
                  <b className="sm">Parser Detected:</b>
                  <div className="muted sm" style={{ marginTop: '2px' }}>
                    {parsedPreview.length} speech segments • {detectedSpeakers.length} speaker{detectedSpeakers.length === 1 ? '' : 's'} ({detectedSpeakers.slice(0, 4).join(', ')}{detectedSpeakers.length > 4 ? '...' : ''})
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="between" style={{ marginTop: '6px' }}>
              <button 
                type="button" 
                className="btn" 
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!formTitle.trim() || !formText.trim()}
                onClick={handleSaveUpload}
                style={{ opacity: (!formTitle.trim() || !formText.trim()) ? 0.6 : 1 }}
              >
                <FileUp size={15} />
                <span>Add to Transcripts</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
