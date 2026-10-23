import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import AdminLayout from './components/AdminLayout.jsx'

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

// Admin Panel Pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminMeetings from './pages/admin/AdminMeetings.jsx'
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx'
import AdminSystemHealth from './pages/admin/AdminSystemHealth.jsx'
import AdminAuditLogs from './pages/admin/AdminAuditLogs.jsx'
import AdminSettings from './pages/admin/AdminSettings.jsx'

// -------------------------------------------------------------
// Route Guards
// -------------------------------------------------------------

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
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
          <div style={{ fontSize: '13px' }}>Verifying session...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
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
          <div style={{ fontSize: '13px' }}>Verifying administrator privileges...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />
  }

  return children
}

// -------------------------------------------------------------
// App Routing Configuration
// -------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      {/* Public Authentication Pages */}
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />

      {/* Live Meeting Room (Protected) */}
      <Route
        path="/meetings/:meetingId/live"
        element={<ProtectedRoute><LiveMeeting /></ProtectedRoute>}
      />

      {/* Existing User Panel (Protected - Preserved UI & Navigation) */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/transcripts" element={<Transcripts />} />
        <Route path="/transcripts/:id/analysis" element={<MeetingAnalysis />} />
        <Route path="/summaries" element={<Summaries />} />
        <Route path="/actions" element={<ActionItems />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/calendar" element={<Calendar />} />
        {['team', 'projects', 'analytics', 'integrations'].map(p => (
          <Route key={p} path={'/' + p} element={<Placeholder />} />
        ))}
      </Route>

      {/* Dedicated Admin Panel (Strictly Protected for Administrators) */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="meetings" element={<AdminMeetings />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="system-health" element={<AdminSystemHealth />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
