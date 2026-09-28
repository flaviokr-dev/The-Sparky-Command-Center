export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const fx = (v: number | null | undefined, d = 0, dash = '-') => (isNum(v) ? v.toFixed(d) : dash)

export function fmtTps(v: number | null | undefined) {
  if (!isNum(v)) return '-'
  return v >= 100 ? v.toFixed(0) : v.toFixed(1)
}

export function fmtBps(bps: number | null | undefined) {
  const b = Number(bps) || 0
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' Gbps'
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' Mbps'
  if (b >= 1e3) return (b / 1e3).toFixed(0) + ' Kbps'
  return b.toFixed(0) + ' bps'
}

export function fmtTok(n: unknown) {
  const v = Number(n) || 0
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return String(Math.round(v))
}

export const fmtGB = (b: number | null | undefined) => (isNum(b) ? (b / 1073741824).toFixed(1) : '-')

export function age(ts: number | null | undefined) {
  return ts ? Math.max(0, Math.round(Date.now() / 1000 - ts)) : null
}

export function ago(ts: number | null | undefined) {
  const a = age(ts)
  if (a === null) return 'never'
  if (a < 60) return `${a}s ago`
  if (a < 3600) return `${Math.round(a / 60)}m ago`
  return `${Math.round(a / 3600)}h ago`
}

export function clock(tz: string | null | undefined, withSec = true) {
  try {
    return new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', second: withSec ? '2-digit' : undefined })
  } catch {
    return new Date().toLocaleTimeString('en-US', { hour12: false })
  }
}

export function tzAbbr(tz: string | null | undefined) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, timeZoneName: 'short' }).formatToParts(new Date())
    return p.find(x => x.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

export function dateLine(tz: string | null | undefined) {
  try {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz || undefined })
  } catch {
    return new Date().toDateString()
  }
}

export type Tone = 'good' | 'warn' | 'bad' | 'muted'
export function tempTone(t: number | null | undefined, warn: number, hot: number): Tone {
  if (!isNum(t)) return 'muted'
  return t >= hot ? 'bad' : t >= warn ? 'warn' : 'good'
}
export const tempWord = (tone: Tone) => (tone === 'bad' ? 'HOT' : tone === 'warn' ? 'WARM' : tone === 'good' ? 'COOL' : '-')
