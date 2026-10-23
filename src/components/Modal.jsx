import { useEffect } from 'react'
export default function Modal({ title, children, onClose, className = '' }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (<div className="scrim center" onClick={onClose}>
    <div className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
      <h3>{title}</h3>{children}</div></div>)
}
