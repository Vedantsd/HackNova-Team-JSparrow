import { createContext, useContext, useEffect, useState } from 'react'
const Ctx = createContext({ theme: 'light', setTheme() {} })
export const useTheme = () => useContext(Ctx)
const read = () => { try { return localStorage.getItem('cf-theme') || 'light' } catch { return 'light' } }
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('cf-theme', theme) } catch {}
  }, [theme])
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}
