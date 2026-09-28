import type { ReactNode } from 'react'
import { age, type Tone } from '../lib/format'

/* The instrument module: JARVIS panel grammar (hairline border, gradient top rule, mono head). */
export function Panel({ id, title, chips, tone, children, className = '', dim = false }: {
  id?: string; title: ReactNode; chips?: ReactNode; tone?: 'amber' | 'violet' | 'bad'; children: ReactNode; className?: string; dim?: boolean
}) {
  return (
    <section id={id} className={`panel card ${tone ? `panel--${tone}` : ''} ${dim ? 'is-dim' : ''} ${className}`}>
      <header className="panel__head card__head">
        <h3 className="panel__title">{title}</h3>
        {chips && <div className="card__chips">{chips}</div>}
      </header>
      <div className="panel__body card__body">{children}</div>
    </section>
  )
}

export const Led = ({ on, tone }: { on?: boolean; tone?: Tone }) => (
  <span className={`led ${tone === 'bad' || on === false ? 'led--bad' : tone === 'warn' ? 'led--warn' : 'led--live'}`} aria-hidden />
)

export const Chip = ({ children, tone, title }: { children: ReactNode; tone?: 'core' | 'violet' | 'amber' | 'bad' | 'good' | 'muted'; title?: string }) => (
  <span className={`chip chip--${tone || 'plain'}`} title={title}>{children}</span>
)

export const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`pill pill--${tone}`}>{children}</span>

export function Bar({ pct, tone }: { pct: number | null | undefined; tone?: Tone }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0))
  const t = tone || (v > 85 ? 'bad' : v > 60 ? 'warn' : 'good')
  return <div className="bar" role="presentation"><span className={`bar--${t}`} style={{ width: `${v}%` }} /></div>
}

export const KV = ({ k, children, accent = false }: { k: ReactNode; children: ReactNode; accent?: boolean }) => (
  <div className="kv"><span className="kv__k">{k}</span><span className={`kv__v ${accent ? 'core' : ''}`}>{children}</span></div>
)

export const Big = ({ label, value, unit, extra, small = false }: { label: string; value: ReactNode; unit?: string; extra?: ReactNode; small?: boolean }) => (
  <div className="bigstat">
    <span className="bigstat__l">{label}</span>
    <span className={`bigstat__v tnum ${small ? 'bigstat__v--sm' : ''}`}>{value}{unit && <em>{unit}</em>}</span>
    {extra}
  </div>
)

export function Sparkline({ values }: { values?: number[] }) {
  if (!values || values.length < 2) return <div className="spark spark--empty" />
  const w = 300, h = 44
  const lo = Math.min(...values), hi = Math.max(...values)
  const span = hi - lo || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - lo) / span) * (h - 10)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label={`temperature trend ${lo.toFixed(0)} to ${hi.toFixed(0)}`}>
      <path d={`${d} L${w},${h} L0,${h} Z`} className="spark__fill" />
      <path d={d} className="spark__line" />
    </svg>
  )
}

/** Freshness footer: live / STALE / error + how long ago the poller last reported. */
export function Fresh({ ts, err, staleAfter = 20 }: { ts?: number; err?: string | null; staleAfter?: number }) {
  const a = age(ts)
  const stale = a !== null && a > staleAfter
  const tone = err ? 'bad' : stale ? 'warn' : 'good'
  return (
    <div className={`fresh fresh--${tone}`}>
      <span><Led tone={tone} /> {err ? 'error' : stale ? 'STALE' : 'live'}</span>
      <span className="tnum">{a === null ? 'waiting' : `updated ${a}s ago`}</span>
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>
