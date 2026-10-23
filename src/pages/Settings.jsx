import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../theme.jsx'
export default function Settings() {
  const { theme, setTheme } = useTheme()
  return (<section className="panel"><div className="phead"><h2>Settings</h2></div>
    <div className="pbody"><h3>Appearance</h3>
      <div className="row" role="radiogroup" aria-label="Theme">
        {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([v, l, I]) => (
          <button key={v} role="radio" aria-checked={theme === v} className={'themeopt' + (theme === v ? ' on' : '')} onClick={() => setTheme(v)}><I size={18} />{l}</button>))}
      </div><p className="muted sm">Your choice is saved in this browser and applies to every page.</p></div></section>)
}
