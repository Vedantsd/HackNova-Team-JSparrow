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
import { api } from '../../services/api.js'
import { getMeetingStatusConfig } from '../../utils/calendarUtils.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function TeamLeadCalendar() {
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])
  const [currentYear, setCurrentYear] = useState(() => today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => today.getMonth())
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredDate, setHoveredDate] = useState(null)
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 })
  const hideTimeoutRef = useRef(null)

  const monthParam = useMemo(() => {
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
  }, [currentYear, currentMonth])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    api.getTeamLeadCalendar(monthParam)
      .then(res => {
        if (!active) return
        setMeetings(res.meetings || [])
        setLoading(false)
      })
      .catch(err => {
        if (!active) return
        setError(err.message || 'Failed to fetch team meetings.')
        setLoading(false)
      })

    return () => { active = false }
  }, [monthParam])

  const meetingsByDate = useMemo(() => {
    const map = {}
    meetings.forEach(m => {
      if (!m.date) return
      if (!map[m.date]) map[m.date] = []
      map[m.date].push(m)
    })
    return map
  }, [meetings])

  const todayStr = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }, [today])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    let startDayOfWeek = firstDay.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const days = []
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      const m = currentMonth === 0 ? 11 : currentMonth - 1
      const y = currentMonth === 0 ? currentYear - 1 : currentYear
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dayNumber: d, isCurrentMonth: false, dateStr, isToday: dateStr === todayStr })
    }

    const totalDays = lastDay.getDate()
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dayNumber: d, isCurrentMonth: true, dateStr, isToday: dateStr === todayStr })
    }

    const remaining = (7 - (days.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1
      const y = currentMonth === 11 ? currentYear + 1 : currentYear
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dayNumber: d, isCurrentMonth: false, dateStr, isToday: dateStr === todayStr })
    }

    return days
  }, [currentYear, currentMonth, todayStr])

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  const handleResetToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

  const handleDayMouseEnter = (dateStr, e) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    const dayMeetings = meetingsByDate[dateStr]
    if (!dayMeetings || dayMeetings.length === 0) {
      setHoveredDate(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const popoverWidth = 320
    let x = rect.left + rect.width / 2 - popoverWidth / 2
    if (x + popoverWidth > window.innerWidth - 16) {
      x = window.innerWidth - popoverWidth - 16
    }
    if (x < 16) x = 16
    let y = rect.bottom + 8
    if (y + 260 > window.innerHeight) {
      y = Math.max(16, rect.top - 260 - 8)
    }

    setPopoverPosition({ x, y })
    setHoveredDate(dateStr)
  }

  const handleDayMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredDate(null)
    }, 120)
  }

  const hoveredMeetings = hoveredDate ? meetingsByDate[hoveredDate] || [] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
            Team Calendar
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13.5px' }}>
            Monthly view of your team's scheduled, live, and completed meetings.
          </p>
        </div>

        {/* Month Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--color-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '2px'
          }}>
            <button className="icon-btn sq" onClick={handlePrevMonth} title="Previous Month">
              <ChevronLeft size={16} />
            </button>
            <span style={{ minWidth: '150px', textAlign: 'center', fontWeight: 600, fontSize: '14px' }}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button className="icon-btn sq" onClick={handleNextMonth} title="Next Month">
              <ChevronRight size={16} />
            </button>
          </div>

          <button className="btn" onClick={handleResetToday} title="Jump to Current Month">
            <RotateCcw size={14} />
            <span>Today</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#ef4444',
          borderRadius: '10px',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Calendar Grid Container */}
      <div style={{
        background: 'var(--color-surface-glass)',
        backdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        {/* Weekday Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          marginBottom: '10px',
          textAlign: 'center',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {WEEKDAYS.map(w => <div key={w} style={{ padding: '6px 0' }}>{w}</div>)}
        </div>

        {/* Days Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px'
        }}>
          {calendarDays.map((day) => {
            const dayMeetings = meetingsByDate[day.dateStr] || []
            const hasMeetings = dayMeetings.length > 0

            return (
              <div
                key={day.dateStr}
                onMouseEnter={(e) => handleDayMouseEnter(day.dateStr, e)}
                onMouseLeave={handleDayMouseLeave}
                style={{
                  minHeight: '85px',
                  borderRadius: '10px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: day.isToday
                    ? 'rgba(6, 182, 212, 0.08)'
                    : day.isCurrentMonth
                    ? 'var(--color-soft)'
                    : 'transparent',
                  border: day.isToday
                    ? '2px solid #06b6d4'
                    : '1px solid var(--color-border)',
                  opacity: day.isCurrentMonth ? 1 : 0.45,
                  transition: 'background 150ms ease, border-color 150ms ease',
                  cursor: hasMeetings ? 'pointer' : 'default',
                  position: 'relative'
                }}
              >
                {/* Day Header */}
                <div className="between">
                  <span style={{
                    fontSize: '12.5px',
                    fontWeight: day.isToday ? 700 : 500,
                    color: day.isToday ? '#22d3ee' : 'var(--color-text)'
                  }}>
                    {day.dayNumber}
                  </span>
                  {day.isToday && (
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: '#22d3ee',
                      letterSpacing: '0.04em'
                    }}>
                      TODAY
                    </span>
                  )}
                </div>

                {/* Meeting Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: 'auto' }}>
                  {dayMeetings.slice(0, 2).map((m) => {
                    const cfg = getMeetingStatusConfig(m)
                    return (
                      <div
                        key={m.id}
                        style={{
                          fontSize: '11px',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          background: cfg.badgeBg,
                          color: cfg.badgeColor,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 500
                        }}
                      >
                        {m.title}
                      </div>
                    )
                  })}
                  {dayMeetings.length > 2 && (
                    <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                      +{dayMeetings.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Hover Popover */}
      {hoveredDate && hoveredMeetings.length > 0 && (
        <div
          onMouseEnter={() => {
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current)
              hideTimeoutRef.current = null
            }
          }}
          onMouseLeave={handleDayMouseLeave}
          style={{
            position: 'fixed',
            left: `${popoverPosition.x}px`,
            top: `${popoverPosition.y}px`,
            width: '320px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div className="between" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
              {new Date(hoveredDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              {hoveredMeetings.length} Meeting{hoveredMeetings.length > 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {hoveredMeetings.map((m) => (
              <div
                key={m.id}
                style={{
                  background: 'var(--color-soft)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div className="between">
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                    {m.title}
                  </span>
                  <span style={{ fontSize: '11px', textTransform: 'capitalize', color: 'var(--color-muted)' }}>
                    {m.status}
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', display: 'flex', gap: '8px' }}>
                  <span>{m.time || '10:00 AM'}</span>
                  <span>•</span>
                  <span>{m.participant_count || 1} participant{m.participant_count > 1 ? 's' : ''}</span>
                </div>
                <button
                  className="btn primary"
                  style={{ marginTop: '4px', height: '28px', fontSize: '11.5px', justifyContent: 'center', background: '#0891b2', borderColor: '#0891b2' }}
                  onClick={() => navigate(`/meetings/${m.id}/live`)}
                >
                  <Video size={13} />
                  <span>Join LiveKit Room</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
