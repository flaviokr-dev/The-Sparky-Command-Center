import { useEffect, useRef, useState } from 'react'
import { THEMES, useLayout } from '../lib/layout'

export function ThemeMenu() {
  const { theme, setTheme } = useLayout()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="theme" ref={wrap}>
      <button type="button" className="ctl" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(v => !v)}>◐ Theme</button>
      {open && (
        <div className="theme__menu" role="menu" aria-label="Colour theme">
          {THEMES.map(t => (
            <button key={t.key} type="button" role="menuitemradio" aria-checked={theme === t.key} className="theme__opt"
              onClick={() => { setTheme(t.key); setOpen(false) }}>
              <i style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />{t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
