import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from '../hooks/useMotion'
import type { Metrics, UiConfig } from '../lib/api'
import './preloader.css'

// Boot log: the real units answering their first poll. An unreachable unit boots as FAIL.
const pad = (label: string, width = 34) => label + ' ' + '.'.repeat(Math.max(3, width - label.length))

export function Preloader({ config, metrics, onDone }: { config: UiConfig | null; metrics: Metrics | null; onDone: () => void }) {
  const reduced = useReducedMotion()
  const lines = useMemo(() => {
    const out: { text: string; bad?: boolean }[] = [{ text: `command.center  boot  v${config?.version || '2'}` }]
    if (!metrics) { out.push({ text: pad('link  api') + ' waiting', bad: true }); return out }
    out.push({ text: pad('link  api') + ' online' })
    for (const n of metrics.nodes.slice(0, 8)) out.push({ text: pad(`probe ${n.name.toLowerCase()}`) + (n.reachable ? ' ok' : ' FAIL'), bad: !n.reachable })
    if (config?.switch) out.push({ text: pad(`probe ${config.switch.name.toLowerCase()}`) + (metrics.switch.reachable ? ' ok' : ' warming'), bad: !metrics.switch.reachable })
    for (const m of metrics.models.slice(0, 4)) out.push({ text: pad(`probe ${(m.model || m.key).toLowerCase()}`) + (m.reachable ? ' ok' : ' FAIL'), bad: !m.reachable })
    out.push({ text: pad('sync  fleet') + (metrics.agg.all_ok ? ' all ok' : ` ${metrics.agg.down.length} down`) })
    return out
  }, [config, metrics])

  const [shown, setShown] = useState(0)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (reduced) { onDone(); return }
    let i = 0
    const t = setInterval(() => {
      i += 1
      setShown(i)
      if (i >= lines.length) {
        clearInterval(t)
        setTimeout(() => setLeaving(true), 260)
        setTimeout(onDone, 260 + 900)
      }
    }, 95)
    return () => clearInterval(t)
  }, [reduced, onDone, lines.length])
  if (reduced) return null
  const progress = Math.min(100, Math.round((shown / lines.length) * 100))
  return (
    <div className={`preloader ${leaving ? 'preloader--leave' : ''}`} aria-hidden>
      <div className="preloader__inner">
        <div className="preloader__mark">F L E E T · C O M M A N D</div>
        <div className="preloader__log mono">
          {lines.slice(0, shown).map((l, i) => <div key={i} className={`preloader__line ${l.bad ? 'is-bad' : ''}`}>{l.text}</div>)}
        </div>
        <div className="preloader__bar"><span style={{ width: `${progress}%` }} /></div>
        <div className="preloader__pct mono">{String(progress).padStart(3, '0')}%</div>
      </div>
    </div>
  )
}
