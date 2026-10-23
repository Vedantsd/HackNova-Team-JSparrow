import { useLocation } from 'react-router-dom'
export default function Placeholder() {
  const n = useLocation().pathname.slice(1)
  return (<section className="panel"><div className="phead"><h2 style={{ textTransform: 'capitalize' }}>{n}</h2></div>
    <div className="pbody"><p className="muted">This section is planned and not built yet. It will use the backend once available.</p></div></section>)
}
