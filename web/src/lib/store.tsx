import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  getChatStatus, getComfy, getConfig, getMetrics, getStations, getTokens,
  type ChatStatus, type ComfyLane, type Metrics, type Res, type Station, type Tokens, type UiConfig,
} from './api'

/** Poll a fetcher. Keeps the last good data when a refresh fails; refreshes when the tab comes back. */
export function usePoll<T>(fetcher: () => Promise<Res<T>>, every: number, enabled = true) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [at, setAt] = useState<number>(0)
  const f = useRef(fetcher)
  f.current = fetcher
  const load = useCallback(async () => {
    const r = await f.current()
    if (r.ok) { setData(r.data); setError(null); setAt(Date.now()) } else setError(r.error)
  }, [])
  useEffect(() => {
    if (!enabled) return
    load()
    const t = every ? setInterval(() => { if (document.visibilityState === 'visible') load() }, every) : 0
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { if (t) clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [load, every, enabled])
  return { data, error, at, reload: load }
}

interface Dash {
  config: UiConfig | null
  configError: string | null
  metrics: Metrics | null
  metricsError: string | null
  metricsAt: number
  comfy: ComfyLane[] | null
  tokens: Tokens | null
  stations: Station[] | null
  chat: ChatStatus | null
  reloadChat: (force?: boolean) => void
}

const Ctx = createContext<Dash | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const cfg = usePoll(getConfig, 0)
  const refresh = cfg.data?.refresh_ms || 2500
  const m = usePoll(getMetrics, refresh)
  const comfy = usePoll(getComfy, 5000, !!cfg.data?.comfy.enabled)
  const tokens = usePoll(getTokens, 30000, !!cfg.data?.tokens.enabled)
  const stations = usePoll(getStations, 30000, !!cfg.data?.stations.enabled)
  const [chat, setChat] = useState<ChatStatus | null>(null)
  const reloadChat = useCallback(async (force = false) => {
    const r = await getChatStatus(force)
    if (r.ok) setChat(r.data)
    else setChat({ enabled: true, configured: false, reachable: false, name: 'Jarvis' })
  }, [])
  useEffect(() => {
    reloadChat()
    const t = setInterval(() => reloadChat(), 30000)
    return () => clearInterval(t)
  }, [reloadChat])

  const value: Dash = {
    config: cfg.data, configError: cfg.error,
    metrics: m.data, metricsError: m.error, metricsAt: m.at,
    comfy: comfy.data?.lanes || null, tokens: tokens.data, stations: stations.data?.stations || null,
    chat, reloadChat,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDash() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDash outside DashboardProvider')
  return v
}
