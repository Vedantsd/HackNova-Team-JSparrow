import { jsPDF } from 'jspdf'

/**
 * Generate a beautifully styled, professional multi-page PDF document
 * mapping the overall meeting transcript, AI summary, decisions, and action items.
 *
 * @param {Object} options
 * @param {string} options.title - Meeting title
 * @param {string} options.date - Meeting date / timestamp
 * @param {string} [options.duration] - Meeting duration
 * @param {string[]} [options.participants] - List of participant names
 * @param {Object} [options.summary] - { overview, keyDiscussionPoints, outcomes }
 * @param {Array} [options.decisions] - [{ title, details, evidence: { speaker, timestamp, quote } }]
 * @param {Array} [options.actionItems] - [{ title, description, owner, deadline, priority, status }]
 * @param {Array} [options.transcriptEntries] - Array of { speaker, time, text, isSelf } or raw transcript string
 * @param {string} [options.filename] - Output PDF filename
 */
export function generateMeetingPDF({
  title = 'Meeting Summary & Transcript',
  date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  duration = '30 min',
  participants = [],
  summary = null,
  decisions = [],
  actionItems = [],
  transcriptEntries = [],
  filename = ''
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = 210
  const pageHeight = 297
  const marginLeft = 16
  const marginRight = 16
  const marginTop = 20
  const marginBottom = 20
  const contentWidth = pageWidth - marginLeft - marginRight

  let y = marginTop

  // Helper to ensure page bounds
  const checkPageBreak = (neededHeight) => {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage()
      y = marginTop
      drawRunningHeader()
    }
  }

  // Draw running header on page 2 onwards
  const drawRunningHeader = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 130, 150)
    doc.text(`CommitFlow • ${title}`, marginLeft, 10)
    doc.text(date, pageWidth - marginRight, 10, { align: 'right' })
    doc.setDrawColor(220, 225, 235)
    doc.setLineWidth(0.2)
    doc.line(marginLeft, 12, pageWidth - marginRight, 12)
  }

  // ==================== 1. COVER / HEADER BANNER ====================
  // Top accent bar
  doc.setFillColor(79, 70, 229) // Indigo primary
  doc.rect(marginLeft, y, contentWidth, 3, 'F')
  y += 8

  // Brand tag
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(99, 102, 241)
  doc.text('COMMITFLOW • MEETING INTELLIGENCE REPORT', marginLeft, y)
  y += 7

  // Meeting Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42) // Slate 900
  const titleLines = doc.splitTextToSize(title, contentWidth)
  doc.text(titleLines, marginLeft, y)
  y += titleLines.length * 7 + 2

  // Metadata Card / Pill Row
  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.roundedRect(marginLeft, y, contentWidth, 14, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)

  const metaColWidth = contentWidth / 4
  const metaY = y + 9
  doc.text(`Date: ${date}`, marginLeft + 4, metaY)
  doc.text(`Duration: ${duration || 'N/A'}`, marginLeft + metaColWidth + 4, metaY)
  doc.text(`Participants: ${participants.length}`, marginLeft + metaColWidth * 2 + 4, metaY)
  doc.text(`Status: Completed`, marginLeft + metaColWidth * 3 + 4, metaY)

  y += 20

  // ==================== 2. PARTICIPANTS LIST ====================
  if (participants && participants.length > 0) {
    checkPageBreak(18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 41, 59)
    doc.text('Meeting Participants', marginLeft, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(51, 65, 85)
    const partString = participants.join('  •  ')
    const partLines = doc.splitTextToSize(partString, contentWidth)
    doc.text(partLines, marginLeft, y)
    y += partLines.length * 4.5 + 5
  }

  // ==================== 3. EXECUTIVE SUMMARY ====================
  if (summary) {
    checkPageBreak(30)
    // Section Header with icon-like badge
    doc.setFillColor(238, 242, 255)
    doc.roundedRect(marginLeft, y, contentWidth, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(67, 56, 202)
    doc.text('1. Executive AI Summary & Key Takeaways', marginLeft + 3, y + 5)
    y += 11

    if (summary.overview) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(30, 41, 59)
      doc.text('Overview:', marginLeft, y)
      y += 4.5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)
      const overviewLines = doc.splitTextToSize(summary.overview, contentWidth)
      doc.text(overviewLines, marginLeft, y)
      y += overviewLines.length * 4.5 + 4
    }

    if (summary.keyDiscussionPoints && summary.keyDiscussionPoints.length > 0) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(30, 41, 59)
      doc.text('Key Discussion Points:', marginLeft, y)
      y += 4.5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)
      summary.keyDiscussionPoints.forEach(pt => {
        const bulletText = `•  ${pt}`
        const ptLines = doc.splitTextToSize(bulletText, contentWidth - 4)
        checkPageBreak(ptLines.length * 4.5 + 2)
        doc.text(ptLines, marginLeft + 2, y)
        y += ptLines.length * 4.5 + 1.5
      })
      y += 3
    }

    if (summary.outcomes) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(30, 41, 59)
      doc.text('Outcomes & Consensus:', marginLeft, y)
      y += 4.5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)
      const outcomesLines = doc.splitTextToSize(summary.outcomes, contentWidth)
      doc.text(outcomesLines, marginLeft, y)
      y += outcomesLines.length * 4.5 + 5
    }
  }

  // ==================== 4. KEY DECISIONS ====================
  if (decisions && decisions.length > 0) {
    checkPageBreak(25)
    doc.setFillColor(240, 253, 244) // Green tint
    doc.roundedRect(marginLeft, y, contentWidth, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(22, 101, 52)
    doc.text(`2. Key Decisions Made (${decisions.length})`, marginLeft + 3, y + 5)
    y += 11

    decisions.forEach((dec, idx) => {
      checkPageBreak(18)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(15, 23, 42)
      doc.text(`${idx + 1}. ${dec.title}`, marginLeft + 2, y)
      y += 4.5

      if (dec.details) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        const detLines = doc.splitTextToSize(dec.details, contentWidth - 4)
        doc.text(detLines, marginLeft + 4, y)
        y += detLines.length * 4.2 + 2
      }

      if (dec.evidence) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor(100, 116, 139)
        const quote = typeof dec.evidence === 'string' 
          ? dec.evidence 
          : `${dec.evidence.speaker || ''} (${dec.evidence.timestamp || ''}): "${dec.evidence.quote || ''}"`
        const evLines = doc.splitTextToSize(`Evidence: ${quote}`, contentWidth - 6)
        doc.text(evLines, marginLeft + 6, y)
        y += evLines.length * 4 + 3
      }
      y += 2
    })
    y += 4
  }

  // ==================== 5. ACTION ITEMS ====================
  if (actionItems && actionItems.length > 0) {
    checkPageBreak(25)
    doc.setFillColor(254, 243, 199) // Amber tint
    doc.roundedRect(marginLeft, y, contentWidth, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(146, 64, 14)
    doc.text(`3. Assigned Action Items (${actionItems.length})`, marginLeft + 3, y + 5)
    y += 11

    actionItems.forEach((act, idx) => {
      checkPageBreak(20)
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      
      const titleLines = doc.splitTextToSize(`[${act.priority || 'Medium'}] ${act.title}`, contentWidth - 10)
      const boxHeight = Math.max(14, titleLines.length * 4.5 + 8)

      doc.roundedRect(marginLeft, y, contentWidth, boxHeight, 1.5, 1.5, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42)
      doc.text(titleLines, marginLeft + 4, y + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(100, 116, 139)
      const details = `Owner: ${act.owner || 'Unassigned'}   |   Due: ${act.deadline || 'Unspecified'}   |   Status: ${act.status || 'Pending Approval'}`
      doc.text(details, marginLeft + 4, y + titleLines.length * 4.5 + 4)

      y += boxHeight + 3
    })
    y += 4
  }

  // ==================== 6. VERBATIM MEETING TRANSCRIPT ====================
  checkPageBreak(25)
  doc.setFillColor(241, 245, 249) // Slate 100
  doc.roundedRect(marginLeft, y, contentWidth, 7, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(51, 65, 85)
  doc.text('4. Full Meeting Transcript (Who Said What)', marginLeft + 3, y + 5)
  y += 12

  // Normalize transcript entries: supports array of objects or raw text lines
  let turns = []
  if (Array.isArray(transcriptEntries) && transcriptEntries.length > 0) {
    if (typeof transcriptEntries[0] === 'string') {
      turns = transcriptEntries.map(line => {
        const m = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*([^:]+):\s*(.*)$/)
        if (m) return { time: m[1], speaker: m[2].trim(), text: m[3].trim() }
        const s = line.match(/^([^:]+):\s*(.*)$/)
        if (s) return { time: '', speaker: s[1].trim(), text: s[2].trim() }
        return { time: '', speaker: 'Speaker', text: line }
      })
    } else {
      turns = transcriptEntries.map(e => ({
        time: e.time || e.t || '',
        speaker: e.speaker || e.who || 'Participant',
        text: e.text || ''
      }))
    }
  } else if (typeof transcriptEntries === 'string' && transcriptEntries.trim()) {
    turns = transcriptEntries.split(/\r?\n/).filter(l => l.trim()).map(line => {
      const m = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*([^:]+):\s*(.*)$/)
      if (m) return { time: m[1], speaker: m[2].trim(), text: m[3].trim() }
      const s = line.match(/^([^:]+):\s*(.*)$/)
      if (s) return { time: '', speaker: s[1].trim(), text: s[2].trim() }
      return { time: '', speaker: 'Speaker', text: line }
    })
  }

  if (turns.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text('No live transcript turns were recorded for this meeting session.', marginLeft, y)
    y += 10
  } else {
    turns.forEach((turn, idx) => {
      const speakerHeader = `${turn.speaker}${turn.time ? ` (${turn.time})` : ''}`
      const textLines = doc.splitTextToSize(turn.text, contentWidth - 8)
      const turnHeight = 5 + textLines.length * 4.2 + 3

      checkPageBreak(turnHeight)

      // Dialogue card
      doc.setFillColor(250, 250, 252)
      doc.setDrawColor(230, 235, 245)
      doc.roundedRect(marginLeft, y, contentWidth, turnHeight, 1.5, 1.5, 'FD')

      // Speaker Name in bold primary
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(67, 56, 202)
      doc.text(speakerHeader, marginLeft + 4, y + 4)

      // Spoken Content
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)
      doc.text(textLines, marginLeft + 4, y + 8)

      y += turnHeight + 2.5
    })
  }

  // ==================== 7. FOOTERS ACROSS ALL PAGES ====================
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    
    // Bottom divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.2)
    doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12)

    // Left & Right text
    doc.text('CommitFlow Confidential Meeting Report • Generated by AI', marginLeft, pageHeight - 7)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginRight, pageHeight - 7, { align: 'right' })
  }

  // Trigger browser download
  const cleanFilename = filename || `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Summary_Transcript.pdf`
  doc.save(cleanFilename)
  return cleanFilename
}
