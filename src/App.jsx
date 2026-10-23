import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import TeamLeadLayout from './components/TeamLeadLayout.jsx'

// Auth Pages
import Login from './pages/Login.jsx'
import SignUp from './pages/SignUp.jsx'

// User Panel Pages
import Dashboard from './pages/Dashboard.jsx'
import Meetings from './pages/Meetings.jsx'
import Settings from './pages/Settings.jsx'
import Placeholder from './pages/Placeholder.jsx'
import Calendar from './pages/Calendar.jsx'
import LiveMeeting from './pages/LiveMeeting.jsx'
import Transcripts from './pages/Transcripts.jsx'
import MeetingAnalysis from './pages/MeetingAnalysis.jsx'
import Summaries from './pages/Summaries.jsx'
import ActionItems from './pages/ActionItems.jsx'
import FollowUps from './pages/FollowUps.jsx'
import TrelloBoard from './pages/TrelloBoard.jsx'

// Admin Panel Pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminTeams from './pages/admin/AdminTeams.jsx'
import AdminMeetings from './pages/admin/AdminMeetings.jsx'
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx'
import AdminSystemHealth from './pages/admin/AdminSystemHealth.jsx'
import AdminAuditLogs from './pages/admin/AdminAuditLogs.jsx'
import AdminSettings from './pages/admin/AdminSettings.jsx'

// Team Lead Panel Pages
import TeamLeadDashboard from './pages/teamlead/TeamLeadDashboard.jsx'
import TeamLeadTeam from './pages/teamlead/TeamLeadTeam.jsx'
import TeamLeadMeetings from './pages/teamlead/TeamLeadMeetings.jsx'
import TeamLeadCalendar from './pages/teamlead/TeamLeadCalendar.jsx'
import TeamLeadTranscripts from './pages/teamlead/TeamLeadTranscripts.jsx'
import TeamLeadAnalysis from './pages/teamlead/TeamLeadAnalysis.jsx'
import TeamLeadActionItems from './pages/teamlead/TeamLeadActionItems.jsx'
import TeamLeadReports from './pages/teamlead/TeamLeadReports.jsx'
import TeamLeadProfile from './pages/teamlead/TeamLeadProfile.jsx'

// -------------------------------------------------------------
// Route Guards & Strict Panel Isolation
// -------------------------------------------------------------

function LoadingScreen({ message }) {
  return (
    <div style={{
      display: 'grid',
      placeItems: 'center',
      height: '100vh',
      background: 'var(--color-background)',
      color: 'var(--color-muted)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px'
        }} />
        <div style={{ fontSize: '13px' }}>{message || 'Verifying credentials...'}</div>
      </div>
    </div>
  )
}

function getRoleHome(role) {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'team_lead') return '/team-lead/dashboard'
  return '/user/dashboard'
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Verifying administrator privileges..." />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== 'admin') {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return children
}

function TeamLeadRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Verifying team lead authorization..." />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== 'team_lead') {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return children
}

function UserRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Verifying member access..." />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== 'user') {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return children
}

function LiveMeetingRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Connecting to secure meeting..." />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  return children
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen message="Loading workspace..." />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={getRoleHome(user.role)} replace />
}

// -------------------------------------------------------------
// App Routing Configuration
// -------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      {/* Root redirector based on authenticated user's role */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Authentication Pages */}
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />

      {/* Live Meeting Room (Protected across authorized roles) */}
      <Route
        path="/meetings/:meetingId/live"
        element={<LiveMeetingRoute><LiveMeeting /></LiveMeetingRoute>}
      />

      {/* --------------------------------------------------------- */}
      {/* 1. Dedicated User / Team Member Panel                     */}
      {/* --------------------------------------------------------- */}
      <Route path="/user" element={<UserRoute><Layout /></UserRoute>}>
        <Route index element={<Navigate to="/user/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="transcripts" element={<Transcripts />} />
        <Route path="transcripts/:id/analysis" element={<MeetingAnalysis />} />
        <Route path="analysis" element={<Summaries />} />
        <Route path="action-items" element={<ActionItems />} />
        <Route path="follow-ups" element={<FollowUps />} />
        <Route path="trello" element={<TrelloBoard />} />
        <Route path="projects" element={<TrelloBoard />} />
        <Route path="profile" element={<Settings />} />
        <Route path="settings" element={<Settings />} />
        {['analytics', 'integrations'].map(p => (
          <Route key={p} path={p} element={<Placeholder />} />
        ))}
      </Route>

      {/* --------------------------------------------------------- */}
      {/* 2. Dedicated Team Lead Panel                              */}
      {/* --------------------------------------------------------- */}
      <Route path="/team-lead" element={<TeamLeadRoute><TeamLeadLayout /></TeamLeadRoute>}>
        <Route index element={<Navigate to="/team-lead/dashboard" replace />} />
        <Route path="dashboard" element={<TeamLeadDashboard />} />
        <Route path="team" element={<TeamLeadTeam />} />
        <Route path="meetings" element={<TeamLeadMeetings />} />
        <Route path="calendar" element={<TeamLeadCalendar />} />
        <Route path="transcripts" element={<TeamLeadTranscripts />} />
        <Route path="analysis" element={<TeamLeadAnalysis />} />
        <Route path="action-items" element={<TeamLeadActionItems />} />
        <Route path="follow-ups" element={<FollowUps isTeamLead={true} />} />
        <Route path="reports" element={<TeamLeadReports />} />
        <Route path="profile" element={<TeamLeadProfile />} />
      </Route>

      {/* --------------------------------------------------------- */}
      {/* 3. Dedicated Admin Panel                                  */}
      {/* --------------------------------------------------------- */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="teams" element={<AdminTeams />} />
        <Route path="meetings" element={<AdminMeetings />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="system-health" element={<AdminSystemHealth />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* --------------------------------------------------------- */}
      {/* Legacy Route Aliases & Redirects                         */}
      {/* --------------------------------------------------------- */}
      <Route path="/teamlead/*" element={<Navigate to="/team-lead" replace />} />
      <Route path="/follow-ups" element={<Navigate to="/user/follow-ups" replace />} />
      <Route path="/meetings" element={<Navigate to="/user/meetings" replace />} />
      <Route path="/calendar" element={<Navigate to="/user/calendar" replace />} />
      <Route path="/transcripts" element={<Navigate to="/user/transcripts" replace />} />
      <Route path="/transcripts/:id/analysis" element={<Navigate to="/user/transcripts" replace />} />
      <Route path="/summaries" element={<Navigate to="/user/analysis" replace />} />
      <Route path="/actions" element={<Navigate to="/user/action-items" replace />} />
      <Route path="/settings" element={<Navigate to="/user/profile" replace />} />

      {/* Catch-all fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
