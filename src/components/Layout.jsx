import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
export default function Layout() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  return (
    <div className="shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main">
        <Header query={query} setQuery={setQuery} onMenu={() => setOpen(true)} />
        <main className="content"><Outlet context={{ query }} /></main>
      </div>
    </div>)
}
