import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Clock, 
  Users, 
  Video, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ExternalLink,
  Sparkles,
  AlertCircle
} from 'lucide-react'
import { api } from '../services/api.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

import { getMeetingStatusConfig } from '../utils/calendarUtils.js'

export default function Calendar() {
  const nav = useNavigate()

  // Track today's local date
  const today = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return {
      year: y,
      month: now.getMonth(), // 0-indexed
      dateString: `${y}-${m}-${d}`,
      dayNumber: now.getDate()
    }
  }, [])

  // Current calendar view year & month
  const [viewYear, setViewYear] = useState(today.year)
  const [viewMonth, setViewMonth] = useState(today.month) // 0-indexed (0=Jan, 9=Oct, etc.)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Interactive popover state
  const [activeDateKey, setActiveDateKey] = useState(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, align: 'left', vertical: 'bottom' })
  const popoverHoverTimeout = useRef(null)
  const containerRef = useRef(null)

  // Load calendar meetings for active year & month
  const fetchCalendar = async (year, monthIndex) => {
    try {
      setLoading(true)
      setError(null)
      const apiMonth = monthIndex + 1 // 1-indexed for backend
      const res = await api.getCalendar(year, apiMonth)
      if (res && Array.isArray(res.meetings)) {
        setMeetings(res.meetings)
      } else {
        setMeetings([])
      }
    } catch (err) {
      console.warn('Calendar fetch error:', err)
      setError('Unable to load calendar events. Showing offline schedule.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendar(viewYear, viewMonth)
  }, [viewYear, viewMonth])

  // Navigation handlers
  const handlePrevMonth = () => {
    setActiveDateKey(null)
    setViewMonth(prev => {
      if (prev === 0) {
        setViewYear(y => y - 1)
        return 11
      }
      return prev - 1
    })
  }

  const handleNextMonth = () => {
    setActiveDateKey(null)
    setViewMonth(prev => {
      if (prev === 11) {
        setViewYear(y => y + 1)
        return 0
      }
      return prev + 1
    })
  }

  const handleGoToday = () => {
    setActiveDateKey(null)
    setViewYear(today.year)
    setViewMonth(today.month)
  }

  // Pre-index meetings by date YYYY-MM-DD
  const meetingsByDate = useMemo(() => {
    const map = new Map()
    meetings.forEach(m => {
      if (!m.date) return
      const list = map.get(m.date) || []
      list.push(m)
      map.set(m.date, list)
    })
    return map
  }, [meetings])

  // Generate calendar grid cells (Monday-Sunday convention)
  const calendarDays = useMemo(() => {
    const days = []
    
    // First day of current month: 0=Sun, 1=Mon, ..., 6=Sat
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay()
    // Convert to Monday start: Mon=0, ..., Sun=6
    const startOffset = (firstDayIndex + 6) % 7

    const totalDaysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const totalDaysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    // 1. Previous month leading padding days
    const prevMonthYear = viewMonth === 0 ? viewYear - 1 : viewYear
    const prevMonthIndex = viewMonth === 0 ? 11 : viewMonth - 1
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i
      const dStr = `${prevMonthYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      days.push({
        dayNumber: dayNum,
        dateString: dStr,
        isCurrentMonth: false,
        isToday: dStr === today.dateString,
        meetings: meetingsByDate.get(dStr) || []
      })
    }

    // 2. Current month days
    for (let dayNum = 1; dayNum <= totalDaysInCurrentMonth; dayNum++) {
      const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      days.push({
        dayNumber: dayNum,
        dateString: dStr,
        isCurrentMonth: true,
        isToday: dStr === today.dateString,
        meetings: meetingsByDate.get(dStr) || []
      })
    }

    // 3. Next month trailing padding days to fill 7-day rows (up to 35 or 42 cells)
    const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear
    const nextMonthIndex = viewMonth === 11 ? 0 : viewMonth + 1
    const totalCells = days.length <= 35 ? 35 : 42
    const trailingCount = totalCells - days.length
    for (let dayNum = 1; dayNum <= trailingCount; dayNum++) {
      const dStr = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      days.push({
        dayNumber: dayNum,
        dateString: dStr,
        isCurrentMonth: false,
        isToday: dStr === today.dateString,
        meetings: meetingsByDate.get(dStr) || []
      })
    }

    return days
  }, [viewYear, viewMonth, today.dateString, meetingsByDate])

  // Popover positioning and hover management
  const handleCellMouseEnter = (day, cellElement, colIndex, rowIndex) => {
    if (!day.meetings || day.meetings.length === 0) {
      handleClosePopover()
      return
    }

    if (popoverHoverTimeout.current) {
      clearTimeout(popoverHoverTimeout.current)
      popoverHoverTimeout.current = null
    }

    if (!containerRef.current || !cellElement) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const cellRect = cellElement.getBoundingClientRect()

    // Determine smart placement: align left or right based on column index / viewport boundary
    const isRightCol = colIndex >= 4 || (cellRect.left + 330 > window.innerWidth)
    const isBottomRow = rowIndex >= 2 || (cellRect.bottom + 260 > window.innerHeight)

    setPopoverPos({
      top: cellRect.top - containerRect.top,
      bottom: containerRect.bottom - cellRect.bottom,
      left: cellRect.left - containerRect.left,
      width: cellRect.width,
      height: cellRect.height,
      align: isRightCol ? 'right' : 'left',
      vertical: isBottomRow ? 'top' : 'bottom'
    })

    setActiveDateKey(day.dateString)
  }

  const handleCellMouseLeave = () => {
    if (popoverHoverTimeout.current) clearTimeout(popoverHoverTimeout.current)
    popoverHoverTimeout.current = setTimeout(() => {
      setActiveDateKey(null)
    }, 180)
  }

  const handlePopoverMouseEnter = () => {
    if (popoverHoverTimeout.current) {
      clearTimeout(popoverHoverTimeout.current)
      popoverHoverTimeout.current = null
    }
  }

  const handlePopoverMouseLeave = () => {
    if (popoverHoverTimeout.current) clearTimeout(popoverHoverTimeout.current)
    popoverHoverTimeout.current = setTimeout(() => {
      setActiveDateKey(null)
    }, 180)
  }

  const handleClosePopover = () => {
    if (popoverHoverTimeout.current) clearTimeout(popoverHoverTimeout.current)
    setActiveDateKey(null)
  }

  // Keyboard accessibility
  const handleKeyDown = (e, day, cellElement, colIdx, rowIdx) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (activeDateKey === day.dateString) {
        handleClosePopover()
      } else {
        handleCellMouseEnter(day, cellElement, colIdx, rowIdx)
      }
    } else if (e.key === 'Escape') {
      handleClosePopover()
    }
  }

  // Close popover when clicking anywhere outside
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        handleClosePopover()
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  // Find meetings of currently active date
  const activeDateMeetings = activeDateKey ? meetingsByDate.get(activeDateKey) || [] : []

  return (
    <div className="calendar-page stack" ref={containerRef} style={{ position: 'relative' }}>
      {/* Top Header Card */}
      <section className="panel">
        <div className="phead" style={{ flexWrap: 'wrap', gap: '16px' }}>
          {/* Month / Year Title */}
          <div className="row" style={{ gap: '10px' }}>
            <span className="micon soft" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
              <CalendarDays size={20} />
            </span>
            <div>
              <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 700 }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <span className="muted sm">
                {meetings.length} {meetings.length === 1 ? 'meeting scheduled' : 'meetings across month'}
              </span>
            </div>
          </div>

          {/* Navigation Controls: Prev, Today, Next */}
          <div className="row" style={{ gap: '8px' }}>
            <button 
              className="btn sm" 
              onClick={handleGoToday} 
              title="Jump to today's date"
              aria-label="Jump to today"
            >
              <RotateCcw size={13} />
              <span>Today</span>
            </button>

            <div className="row" style={{ gap: '4px' }}>
              <button 
                className="icon-btn sq" 
                onClick={handlePrevMonth} 
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                className="icon-btn sq" 
                onClick={handleNextMonth} 
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Meeting Indicators Visual Legend */}
        <div className="pbody" style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-soft)' }}>
          <div className="calendar-legend-bar">
            <span className="legend-title muted sm">Meeting Status Legend:</span>
            <div className="legend-items-row">
              <span className="legend-item">
                <span className="legend-dot blue" />
                <span className="legend-label">Upcoming / Scheduled</span>
              </span>
              <span className="legend-item">
                <span className="legend-dot green" />
                <span className="legend-label">Attended</span>
              </span>
              <span className="legend-item">
                <span className="legend-dot red" />
                <span className="legend-label">Missed</span>
              </span>
              <span className="legend-item">
                <span className="legend-dot unknown" />
                <span className="legend-label">Ended (Unknown Attendance)</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Monthly Calendar Grid Card */}
      <section className="panel" style={{ overflow: 'visible' }}>
        {error && (
          <div style={{ padding: '12px 20px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', fontSize: '13px' }}>
            <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
            {error}
          </div>
        )}

        {/* Weekday Column Headers */}
        <div className="calendar-weekdays-row" role="row">
          {WEEKDAYS.map(w => (
            <div key={w} className="calendar-weekday-header" role="columnheader">
              {w}
            </div>
          ))}
        </div>

        {/* 7-Column Days Grid */}
        <div className="calendar-grid" role="grid" aria-label={`Calendar grid for ${MONTH_NAMES[viewMonth]} ${viewYear}`}>
          {calendarDays.map((day, idx) => {
            const colIndex = idx % 7
            const rowIndex = Math.floor(idx / 7)
            const hasMeetings = day.meetings.length > 0
            const isSelected = activeDateKey === day.dateString

            return (
              <div
                key={day.dateString + '-' + idx}
                role="gridcell"
                tabIndex={0}
                aria-selected={isSelected}
                aria-label={`${day.dateString}${hasMeetings ? `, ${day.meetings.length} meetings` : ''}`}
                className={`calendar-day-cell ${day.isCurrentMonth ? 'current-month' : 'other-month'} ${day.isToday ? 'is-today' : ''} ${hasMeetings ? 'has-meetings' : ''} ${isSelected ? 'active-hover' : ''}`}
                onMouseEnter={(e) => handleCellMouseEnter(day, e.currentTarget, colIndex, rowIndex)}
                onMouseLeave={handleCellMouseLeave}
                onClick={(e) => {
                  e.stopPropagation()
                  if (activeDateKey === day.dateString) {
                    handleClosePopover()
                  } else {
                    handleCellMouseEnter(day, e.currentTarget, colIndex, rowIndex)
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e, day, e.currentTarget, colIndex, rowIndex)}
              >
                {/* Date Number Top Header */}
                <div className="day-cell-top">
                  <span className={`day-number ${day.isToday ? 'today-pill' : ''}`}>
                    {day.dayNumber}
                  </span>
                  {day.isToday && (
                    <span className="today-indicator-tag">Today</span>
                  )}
                </div>

                {/* Persistent Meeting Indicators (Visible before hover) */}
                {hasMeetings && (
                  <div className="day-indicators-container">
                    <div className="day-dots-row">
                      {day.meetings.slice(0, 3).map((m, mIdx) => {
                        const cfg = getMeetingStatusConfig(m)
                        return (
                          <span
                            key={m.id || mIdx}
                            className={`meeting-indicator-dot ${cfg.dotClass}`}
                            title={`${m.title} (${cfg.tooltipLabel})`}
                          />
                        )
                      })}
                      {day.meetings.length > 3 && (
                        <span className="more-meetings-count" title={`${day.meetings.length - 3} more meetings`}>
                          +{day.meetings.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Compact meeting label on larger screens */}
                    <div className="day-meetings-preview-list hide-sm">
                      {day.meetings.slice(0, 2).map((m, mIdx) => {
                        const cfg = getMeetingStatusConfig(m)
                        return (
                          <div 
                            key={m.id || mIdx} 
                            className="day-preview-pill"
                            style={{ borderLeftColor: cfg.dotColor }}
                          >
                            <span className="preview-pill-text">{m.title}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Floating Meeting Details Popover on Hover / Tap */}
        {activeDateKey && activeDateMeetings.length > 0 && (
          <div
            className={`calendar-hover-popover ${popoverPos.align} ${popoverPos.vertical}`}
            style={{
              top: popoverPos.vertical === 'top' 
                ? `${Math.max(10, popoverPos.top - 12)}px` 
                : `${popoverPos.top + popoverPos.height + 8}px`,
              left: popoverPos.align === 'right' 
                ? `${Math.max(10, popoverPos.left + popoverPos.width - 320)}px` 
                : `${Math.min(window.innerWidth - 340, popoverPos.left)}px`,
              transform: popoverPos.vertical === 'top' ? 'translateY(-100%)' : 'none'
            }}
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handlePopoverMouseLeave}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`Meetings for ${activeDateKey}`}
          >
            {/* Popover Header */}
            <div className="popover-header">
              <div>
                <b className="popover-date-title">
                  {new Date(activeDateKey + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                  })}
                </b>
                <span className="muted sm" style={{ display: 'block', fontSize: '11px', marginTop: '1px' }}>
                  {activeDateMeetings.length} {activeDateMeetings.length === 1 ? 'Meeting Scheduled' : 'Meetings on this date'}
                </span>
              </div>
              <button 
                className="icon-btn sq sm" 
                onClick={handleClosePopover} 
                aria-label="Close details popover"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable list of meetings on this date */}
            <div className="popover-meetings-list">
              {activeDateMeetings.map(m => {
                const cfg = getMeetingStatusConfig(m)
                const IconComponent = cfg.icon

                return (
                  <div key={m.id} className="popover-meeting-card">
                    {/* Header Row: Title & Status Badge */}
                    <div className="between" style={{ alignItems: 'flex-start', gap: '8px' }}>
                      <b className="popover-meeting-name">{m.title}</b>
                      <span 
                        className="popover-status-badge"
                        style={{ color: cfg.badgeColor, backgroundColor: cfg.badgeBg }}
                      >
                        <IconComponent size={11} style={{ marginRight: '3px' }} />
                        {cfg.badgeText}
                      </span>
                    </div>

                    {/* Time & Duration Row */}
                    <div className="popover-meta-row muted sm">
                      <span><Clock size={12} /> {m.time || 'TBD'}</span>
                      <span>•</span>
                      <span>{m.duration || '30 min'}</span>
                      {m.participantCount !== undefined && (
                        <>
                          <span>•</span>
                          <span><Users size={12} /> {m.participantCount} {m.participantCount === 1 ? 'attendee' : 'attendees'}</span>
                        </>
                      )}
                    </div>

                    {/* Attendance Clarification Row for Ended Meetings */}
                    {(m.status === 'done' || m.status === 'ended') && (
                      <div className="popover-attendance-row">
                        <span className="muted sm">Attendance:</span>{' '}
                        <b style={{ color: cfg.badgeColor, fontSize: '11.5px' }}>
                          {m.attendanceLabel || cfg.badgeText}
                        </b>
                      </div>
                    )}

                    {/* Host info if available */}
                    {m.hostName && (
                      <div className="muted sm" style={{ fontSize: '11px', marginTop: '2px' }}>
                        Host: {m.hostName}
                      </div>
                    )}

                    {/* Quick navigation action */}
                    <div className="popover-card-footer">
                      {m.status === 'live' || m.status === 'scheduled' ? (
                        <button 
                          className="btn primary sm full-width"
                          style={{ height: '28px', fontSize: '12px' }}
                          onClick={() => nav(`/meetings/${m.id}/live`)}
                        >
                          <Video size={13} /> {m.status === 'live' ? 'Join Live Room' : 'Open Meeting Room'}
                        </button>
                      ) : (
                        <button 
                          className="btn sm full-width"
                          style={{ height: '28px', fontSize: '12px' }}
                          onClick={() => nav(`/transcripts`)}
                        >
                          <ExternalLink size={13} /> View Transcript & Summary
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
