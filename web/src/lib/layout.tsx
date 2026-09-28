import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

// Per-browser board layout (module order, collapsed modules, theme). Browser storage only: a wrecked
// layout is fixed by "Reset layout". Nothing here touches the server.

const K_ORDER = 'acc2.modOrder', K_COLLAPSED = 'acc2.modCollapsed', K_THEME = 'acc2.theme'
export const THEMES = [
  { key: 'core', label: 'Core', swatch: ['#5fe3ff', '#060709'] },
  { key: 'sunset', label: 'Sunset', swatch: ['#ff7a1a', '#120c08'] },
  { key: 'breeze', label: 'Breeze', swatch: ['#38bdf8', '#0b1220'] },
  { key: 'matrix', label: 'Matrix', swatch: ['#00ff66', '#000000'] },
  { key: 'light', label: 'Light', swatch: ['#0b6fd4', '#f4f6f9'] },
] as const
export type ThemeKey = typeof THEMES[number]['key']

const read = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb } catch { return fb } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

interface Layout {
  order: (defaults: string[]) => string[]
  move: (id: string, dir: -1 | 1, current: string[]) => void
  collapsed: Set<string>
  toggle: (id: string) => void
  setAll: (ids: string[], collapse: boolean) => void
  rearranging: boolean
  setRearranging: (v: boolean) => void
  reset: () => void
  theme: ThemeKey
  setTheme: (t: ThemeKey) => void
}

const Ctx = createContext<Layout | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>(() => read<string[]>(K_ORDER, []))
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(read<string[]>(K_COLLAPSED, [])))
  const [rearranging, setRearranging] = useState(false)
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    const t = read<string>(K_THEME, 'core')
    return (THEMES.some(x => x.key === t) ? t : 'core') as ThemeKey
  })

  useEffect(() => {
    if (theme === 'core') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (meta && bg) meta.setAttribute('content', bg)
  }, [theme])

  const order = useCallback((defaults: string[]) => {
    const known = saved.filter(id => defaults.includes(id))
    return [...known, ...defaults.filter(id => !known.includes(id))]
  }, [saved])

  const move = useCallback((id: string, dir: -1 | 1, current: string[]) => {
    const i = current.indexOf(id), j = i + dir
    if (i < 0 || j < 0 || j >= current.length) return
    const next = [...current]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSaved(next); write(K_ORDER, next)
  }, [])

  const toggle = useCallback((id: string) => {
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      write(K_COLLAPSED, [...n])
      return n
    })
  }, [])

  const setAll = useCallback((ids: string[], collapse: boolean) => {
    const n = new Set(collapse ? ids : [])
    setCollapsed(n); write(K_COLLAPSED, [...n])
  }, [])

  const reset = useCallback(() => {
    setSaved([]); setCollapsed(new Set()); write(K_ORDER, []); write(K_COLLAPSED, [])
  }, [])

  const setTheme = useCallback((t: ThemeKey) => { setThemeState(t); write(K_THEME, t) }, [])

  return <Ctx.Provider value={{ order, move, collapsed, toggle, setAll, rearranging, setRearranging, reset, theme, setTheme }}>{children}</Ctx.Provider>
}

export function useLayout() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLayout outside LayoutProvider')
  return v
}

/** Read the live theme tokens for the WebGL scene (it cannot read CSS variables itself). */
export function readPalette() {
  const cs = getComputedStyle(document.documentElement)
  const v = (k: string, fb: string) => cs.getPropertyValue(k).trim() || fb
  return {
    core: v('--core', '#5fe3ff'), amber: v('--amber', '#ffb547'), bad: v('--bad', '#ff5d5d'), violet: v('--violet', '#b98cff'),
    bg: v('--bg', '#060709'), grid: v('--scene-grid', '#161c20'), gridSection: v('--scene-grid-2', '#223038'), ink: v('--scene-dust', '#8a979e'),
  }
}
