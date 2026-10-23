import { XCircle, Video } from 'lucide-react'

export function getMeetingStatusConfig(meeting) {
  const status = (meeting.status || 'scheduled').toLowerCase()
  const attendance = (meeting.attendance || 'none').toLowerCase()

  if (status === 'cancelled') {
    return {
      dotColor: '#94a3b8',
      dotClass: 'cancelled',
      badgeText: 'Cancelled',
      badgeColor: '#64748b',
      badgeBg: 'rgba(100, 116, 139, 0.14)',
      tooltipLabel: 'Cancelled',
      icon: XCircle
    }
  }

  if (status === 'live') {
    return {
      dotColor: '#3b82f6',
      dotClass: 'blue live',
      badgeText: 'Live Now',
      badgeColor: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.15)',
      tooltipLabel: 'Live Meeting',
      icon: Video
    }
  }

  if (status === 'scheduled' || status === 'upcoming') {
    return {
      dotColor: '#3b82f6',
      dotClass: 'blue',
      badgeText: 'Upcoming',
      badgeColor: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      tooltipLabel: 'Scheduled',
      icon: Video
    }
  }

  if (status === 'completed' || status === 'ended') {
    if (attendance === 'attended') {
      return {
        dotColor: '#22c55e',
        dotClass: 'green',
        badgeText: 'Attended',
        badgeColor: '#22c55e',
        badgeBg: 'rgba(34, 197, 94, 0.12)',
        tooltipLabel: 'Attended',
        icon: Video
      }
    }
    if (attendance === 'missed') {
      return {
        dotColor: '#ef4444',
        dotClass: 'red',
        badgeText: 'Missed',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.12)',
        tooltipLabel: 'Missed',
        icon: Video
      }
    }
    return {
      dotColor: '#22c55e',
      dotClass: 'green',
      badgeText: 'Completed',
      badgeColor: '#22c55e',
      badgeBg: 'rgba(34, 197, 94, 0.12)',
      tooltipLabel: 'Completed',
      icon: Video
    }
  }

  return {
    dotColor: '#3b82f6',
    dotClass: 'blue',
    badgeText: 'Scheduled',
    badgeColor: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.12)',
    tooltipLabel: 'Scheduled',
    icon: Video
  }
}
