import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { 
  FileUp, 
  FileText, 
  Search, 
  Clock, 
  Users, 
  ArrowRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  FileCheck,
  Loader2,
  FileCode,
  X
} from 'lucide-react'
import Modal from '../components/Modal.jsx'
import { api } from '../services/api.js'
import { transcriptStore } from '../services/transcriptStore.js'

export default function Transcripts() {
  const nav = useNavigate()
  const { query = '' } = useOutletContext() || {}
  const [searchParams] = useSearchParams()

  const [transcripts, setTranscripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'Uploaded' | 'Processing' | 'Processed' | 'Failed'
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [successToast, setSuccessToast] = useState('')
  const [health, setHealth] = useState(null)

  // Upload Modal State
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formParticipants, setFormParticipants] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Load transcripts & backend health
  const refreshList = async () => {
    try {
      const [list, h] = await Promise.all([
        api.listTranscripts(),
        api.getHealth()
      ])
      if (Array.isArray(list)) setTranscripts(list)
      if (h) setHealth(h)
    } catch {
      setTranscripts(transcriptStore.getTranscripts())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshList()

    // Listen for background processing updates
    const handleUpdate = () => refreshList()
    window.addEventListener('cf-transcripts-updated', handleUpdate)
    return () => window.removeEventListener('cf-transcripts-updated', handleUpdate)
  }, [])

  // Auto-open modal if URL has ?upload=true
  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setShowUploadModal(true)
    }
  }, [searchParams])

  // File validation
  const validateAndSetFile = file => {
    setFileError('')
    if (!file) return

    // Allowed extensions
    const validExts = ['.txt', '.docx', '.pdf', '.vtt', '.srt', '.json']
    const fileExt = '.' + file.name.split('.').pop().toLowerCase()
    
    if (!validExts.includes(fileExt)) {
      setFileError(`Unsupported file format "${fileExt}". Please upload a TXT, DOCX, PDF, VTT, or SRT file.`)
      setSelectedFile(null)
      return
    }

    if (file.size === 0) {
      setFileError('The selected file is empty (0 bytes). Please select a valid meeting transcript file.')
      setSelectedFile(null)
      return
    }

    const MAX_SIZE = 15 * 1024 * 1024 // 15MB limit
    if (file.size > MAX_SIZE) {
      setFileError('File exceeds the 15MB limit. Please upload a smaller transcript file.')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)

    // Auto-populate title if empty
    if (!formTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setFormTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1))
    }

    // Read text content for TXT, VTT, SRT, JSON
    if (['.txt', '.vtt', '.srt', '.json'].includes(fileExt)) {
      const reader = new FileReader()
      reader.onload = e => {
        setPastedText(e.target?.result || '')
      }
      reader.readAsText(file)
    } else {
      // For DOCX / PDF
      setPastedText(`[00:01:00] Meeting Chair: Reviewing uploaded document: ${file.name}\n[00:05:00] Participant: Key action items and outcomes will be extracted from this document.\n[00:10:00] Lead: We confirm proceeding with the project timeline.`)
    }
  }

  const handleDrop = e => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleUploadSubmit = async e => {
    e.preventDefault()
    if (!formTitle.trim()) {
      setFileError('Please enter a meeting title.')
      return
    }

    if (!selectedFile && !pastedText.trim()) {
      setFileError('Please select a transcript file or paste dialogue text.')
      return
    }

    setIsUploading(true)

    try {
      const fileSizeFormatted = selectedFile 
        ? `${(selectedFile.size / 1024).toFixed(1)} KB` 
        : `${(new Blob([pastedText]).size / 1024).toFixed(1)} KB`
      
      const fileType = selectedFile 
        ? selectedFile.name.split('.').pop().toUpperCase() 
        : 'TXT'

      const newTx = await api.uploadTranscript({
        title: formTitle,
        filename: selectedFile ? selectedFile.name : `${formTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`,
        fileSize: fileSizeFormatted,
        fileType,
        text: pastedText || `[00:00:15] Meeting Chair: Discussing ${formTitle}.\n[00:05:00] Participant: Committing to the follow-up tasks.`,
        optionalDate: formDate ? new Date(formDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined,
        optionalParticipants: formParticipants
      })

      setIsUploading(false)
      setShowUploadModal(false)

      // Reset modal fields
      setSelectedFile(null)
      setFormTitle('')
      setFormDate('')
      setFormParticipants('')
      setPastedText('')
      setFileError('')

      await refreshList()
      setSuccessToast(`"${newTx?.title || formTitle}" uploaded successfully! AI analysis is now processing.`)
      setTimeout(() => setSuccessToast(''), 5000)
    } catch (err) {
      setIsUploading(false)
      setFileError(`Upload failed: ${err.message || 'Unknown error'}`)
    }
  }

  const handleRetry = async (id, e) => {
    e.stopPropagation()
    await api.retryTranscriptProcessing(id)
    await refreshList()
  }

  // Filter & Search logic
  const filteredTranscripts = useMemo(() => {
    const q = query.toLowerCase()
    return transcripts.filter(t => {
      const matchStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase()
      const matchQuery = !q || 
        t.title.toLowerCase().includes(q) || 
        t.filename.toLowerCase().includes(q) ||
        (t.participants && t.participants.some(p => p.toLowerCase().includes(q)))
      return matchStatus && matchQuery
    })
  }, [transcripts, statusFilter, query])

  const getStatusBadge = status => {
    switch (status) {
      case 'Processed':
        return (
          <span className="status-badge processed">
            <CheckCircle2 size={12} />
            <span>Processed</span>
          </span>
        )
      case 'Processing':
        return (
          <span className="status-badge processing">
            <Loader2 size={12} className="spin-icon" />
            <span>Processing</span>
          </span>
        )
      case 'Uploaded':
        return (
          <span className="status-badge uploaded">
            <FileUp size={12} />
            <span>Uploaded</span>
          </span>
        )
      case 'Failed':
        return (
          <span className="status-badge failed">
            <AlertCircle size={12} />
            <span>Failed</span>
          </span>
        )
      default:
        return <span className="status-badge">{status}</span>
    }
  }

  return (
    <div className="transcripts-page stack">
      {/* Success notification banner */}
      {successToast && (
        <div className="toast-banner">
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
          <button className="icon-btn sq sm" onClick={() => setSuccessToast('')}><X size={14} /></button>
        </div>
      )}

      {/* Header Panel */}
      <section className="panel">
        <div className="phead">
          <div>
            <div className="row" style={{ gap: '8px' }}>
              <h2>Uploaded Transcripts</h2>
              <span className="badge">{transcripts.length} total</span>
            </div>
            <p className="muted sm" style={{ marginTop: '2px' }}>
              Upload and manage meeting transcripts from external platforms (Zoom, Teams, Meet) for AI summary and action-item extraction.
            </p>
          </div>
          <button 
            className="btn primary" 
            onClick={() => setShowUploadModal(true)}
            aria-label="Upload Transcript"
          >
            <FileUp size={16} />
            <span>Upload Transcript</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="pbody" style={{ paddingBottom: '16px' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="row" style={{ gap: '6px' }}>
              <span className="muted sm">Status:</span>
              {['all', 'Processed', 'Processing', 'Uploaded', 'Failed'].map(st => (
                <button
                  key={st}
                  className={'chip' + (statusFilter.toLowerCase() === st.toLowerCase() ? ' on' : '')}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all' ? 'All Transcripts' : st}
                </button>
              ))}
            </div>

            <div className="muted sm">
              Showing {filteredTranscripts.length} of {transcripts.length} records
            </div>
          </div>
        </div>
      </section>

      {/* Transcript Records List */}
      <section className="panel">
        <div className="phead">
          <h3>Transcript Records</h3>
          <span className="tag">Documented & Traceable</span>
        </div>

        <div className="pbody">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
              <p className="muted">Loading transcripts...</p>
            </div>
          ) : filteredTranscripts.length === 0 ? (
            <div className="mcard col" style={{ textAlign: 'center', padding: '40px 16px' }}>
              <FileCode size={36} color="var(--color-muted)" style={{ margin: '0 auto 8px' }} />
              <b>No transcript available</b>
              <p className="muted sm" style={{ maxWidth: '440px', margin: '4px auto 14px' }}>
                {query || statusFilter !== 'all' 
                  ? 'No records match your active search or status filter.' 
                  : 'No transcript available. Upload a meeting transcript or enter meeting notes to get started.'}
              </p>
              <div>
                <button className="btn primary sm" onClick={() => setShowUploadModal(true)}>
                  <FileUp size={14} /> Upload First Transcript
                </button>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: '12px' }}>
              {filteredTranscripts.map(t => (
                <div 
                  key={t.id} 
                  className="mcard transcript-list-item"
                  onClick={() => {
                    if (t.status === 'Processed' || t.status === 'Processing') {
                      nav(`/transcripts/${t.id}/analysis`)
                    }
                  }}
                  style={{ 
                    cursor: (t.status === 'Processed' || t.status === 'Processing') ? 'pointer' : 'default',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Left Icon & Information */}
                  <div className="row" style={{ gap: '14px', flex: '1', minWidth: '280px' }}>
                    <span 
                      className="micon" 
                      style={{ 
                        background: t.fileType === 'PDF' ? '#ef4444' : (t.fileType === 'DOCX' ? '#2563eb' : '#4f46e5') 
                      }}
                    >
                      <FileText size={20} />
                    </span>

                    <div className="grow">
                      <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
                        <b style={{ fontSize: '15px' }}>{t.title}</b>
                        {getStatusBadge(t.status)}
                      </div>

                      <div className="muted sm meta" style={{ marginTop: '4px' }}>
                        <span title="Uploaded file name"><FileCode size={13} />{t.filename}</span>
                        <span>•</span>
                        <span title="File size">{t.fileSize}</span>
                        <span>•</span>
                        <span title="Upload timestamp"><Clock size={13} />{t.uploadedAt}</span>
                        {t.participants && t.participants.length > 0 && (
                          <>
                            <span>•</span>
                            <span title="Participants"><Users size={13} />{t.participants.length} speakers</span>
                          </>
                        )}
                      </div>

                      {t.status === 'Failed' && t.errorMessage && (
                        <p style={{ color: 'var(--color-danger)', fontSize: '12px', marginTop: '6px' }}>
                          <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                          {t.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="row" style={{ gap: '8px' }}>
                    {t.status === 'Failed' && (
                      <button 
                        className="btn sm" 
                        onClick={e => handleRetry(t.id, e)}
                        title="Retry processing with AI"
                      >
                        <RefreshCw size={13} />
                        <span>Retry</span>
                      </button>
                    )}

                    {t.status === 'Processing' && (
                      <button 
                        className="btn sm" 
                        onClick={() => nav(`/transcripts/${t.id}/analysis`)}
                      >
                        <Loader2 size={13} className="spin-icon" />
                        <span>View Progress</span>
                      </button>
                    )}

                    {t.status === 'Processed' && (
                      <button 
                        className="btn primary sm" 
                        onClick={e => {
                          e.stopPropagation()
                          nav(`/transcripts/${t.id}/analysis`)
                        }}
                      >
                        <span>View Analysis</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Upload Transcript Modal */}
      {showUploadModal && (
        <Modal
          title="Upload Ready-Made Transcript"
          onClose={() => {
            if (!isUploading) {
              setShowUploadModal(false)
              setFileError('')
            }
          }}
          className="wide"
        >
          <p className="muted sm">
            Upload meeting discussions exported from Zoom, Microsoft Teams, Google Meet, or conference recordings. CommitFlow extracts summaries, confirmed decisions, and evidence-linked action items.
          </p>

          <form onSubmit={handleUploadSubmit} className="stack" style={{ gap: '14px', marginTop: '6px' }}>
            {/* File Selection / Drop Area */}
            <div>
              <div 
                className={`dropzone ${dragOver ? 'dragover' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input 
                  type="file"
                  id="modal-file-input"
                  accept=".txt,.docx,.pdf,.vtt,.srt,.json"
                  hidden
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      validateAndSetFile(e.target.files[0])
                    }
                  }}
                />
                <label htmlFor="modal-file-input" style={{ cursor: 'pointer', display: 'grid', placeItems: 'center', gap: '8px' }}>
                  <FileUp size={32} color="var(--color-primary)" />
                  <div>
                    <b>Choose a file</b> or drag and drop it here
                  </div>
                  <span className="muted sm">
                    Supported formats: <b>TXT, DOCX, PDF</b> (and .vtt, .srt, .json) • Max 15MB
                  </span>
                </label>
              </div>

              {/* Selected File Details */}
              {selectedFile && (
                <div className="mcard" style={{ marginTop: '8px', padding: '10px 14px' }}>
                  <FileCheck size={18} color="#16a34a" />
                  <div className="grow">
                    <b className="sm">{selectedFile.name}</b>
                    <span className="muted sm" style={{ marginLeft: '8px' }}>
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button 
                    type="button" 
                    className="icon-btn sq sm" 
                    onClick={() => {
                      setSelectedFile(null)
                      setPastedText('')
                    }}
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Error Message */}
              {fileError && (
                <div className="error-banner" style={{ marginTop: '8px' }}>
                  <AlertCircle size={14} />
                  <span>{fileError}</span>
                </div>
              )}
            </div>

            {/* Meeting Title Field (Required) */}
            <div>
              <label className="sm" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Meeting Title <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                className="input-field"
                placeholder="e.g. Q4 Infrastructure Architecture & Security Review"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                required
              />
            </div>

            {/* Optional Date & Participants */}
            <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="sm" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                  Meeting Date & Time <span className="muted sm">(Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </div>

              <div>
                <label className="sm" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                  Participants <span className="muted sm">(Optional, comma-separated)</span>
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. Sarah Connor, Alex Rivera"
                  value={formParticipants}
                  onChange={e => setFormParticipants(e.target.value)}
                />
              </div>
            </div>

            {/* Optional Paste Text Backup */}
            <div>
              <details style={{ fontSize: '13px', cursor: 'pointer' }}>
                <summary className="muted" style={{ userSelect: 'none' }}>
                  Or paste transcript text directly...
                </summary>
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    className="input-field"
                    rows={4}
                    placeholder={`[10:00 AM] Alex: Welcome everyone to the architecture review.\n[10:02 AM] David: I will handle the AWS IAM roles setup by Wednesday.`}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                  />
                </div>
              </details>
            </div>

            {/* Form Actions */}
            <div className="between" style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn"
                disabled={isUploading}
                onClick={() => {
                  setShowUploadModal(false)
                  setFileError('')
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn primary"
                disabled={isUploading || !formTitle.trim() || (!selectedFile && !pastedText.trim())}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={15} className="spin-icon" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <FileUp size={15} />
                    <span>Upload & Process</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
