export default function Logo({ size = 28 }) {
  return (<span className="logo"><svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--color-primary)"/>
    <path d="M9 16l5 5 9-10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    <b>CommitFlow</b></span>)
}
