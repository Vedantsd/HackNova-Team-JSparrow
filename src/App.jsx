import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Meetings from './pages/Meetings.jsx'
import Settings from './pages/Settings.jsx'
import Placeholder from './pages/Placeholder.jsx'
import LiveMeeting from './pages/LiveMeeting.jsx'
import Transcripts from './pages/Transcripts.jsx'
export default function App() {
  return (
    <Routes>
      <Route path="/meetings/:meetingId/live" element={<LiveMeeting />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/transcripts" element={<Transcripts />} />
        <Route path="/settings" element={<Settings />} />
        {['calendar','summaries','actions','team','projects','analytics','integrations'].map(p =>
          <Route key={p} path={'/' + p} element={<Placeholder />} />)}
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>)
}
