import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useDash } from '../lib/store'
import { useLayout } from '../lib/layout'
import { Module } from '../components/Module'
import { ThemeMenu } from '../components/ThemeMenu'
import { Empty } from '../components/Panel'
import { UnifiedCard, GpuCard, HostCard, SwitchCard, ModelCard } from './Cards'
import { Video } from './Video'
import { Tokens } from './Tokens'
import { Eco } from './Eco'
import { Stations } from './Stations'
import { clock } from '../lib/format'
import type { SectionCfg } from '../lib/api'

// The board: every v1 module, in the same default order (ECO, tokens, the fleet sections from config,
// video lanes), plus the web stations and key lights that v1 only exposed as API routes.

const K_SUBS = 'acc2.subsCollapsed'
function useSubs() {
  const [subs, setSubs] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(K_SUBS) || '[]') } catch { return [] } })
  const toggle = (id: string) => setSubs(prev => {
    const n = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    try { localStorage.setItem(K_SUBS, JSON.stringify(n)) } catch { /* private mode */ }
    return n
  })
  return { subs, toggle }
}

export function Board() {
  const { config, metrics, metricsError } = useDash()
  const layout = useLayout()
  const subs = useSubs()

  const modules = useMemo(() => {
    const out: { id: string; eyebrow: string; title: ReactNode; subtitle?: ReactNode; tone?: 'amber' | 'violet' | 'good'; render: () => ReactNode; meta?: () => ReactNode }[] = []
    if (!config) return out
    if (config.eco.enabled) out.push({ id: 'eco', eyebrow: 'Clock ECO mode', title: 'GB10 power caps', tone: 'good', render: () => <Eco /> })
    if (config.tokens.enabled) out.push({ id: 'tokens', eyebrow: 'Token tracker', title: 'Tokens served', subtitle: 'cumulative per model, banked across restarts', tone: 'violet', render: () => <Tokens /> })
    for (const s of config.sections) {
      out.push({ id: s.key, eyebrow: s.eyebrow || s.title, title: s.title, subtitle: s.subtitle, render: () => <FleetSection s={s} subs={subs.subs} toggleSub={subs.toggle} /> })
    }
    if (config.comfy.enabled) out.push({ id: 'video', eyebrow: 'Render lanes', title: config.comfy.title, tone: 'violet', render: () => <Video /> })
    if (config.stations.enabled || config.keylights.enabled) out.push({ id: 'stations', eyebrow: 'Web stations', title: 'Stations & lights', render: () => <Stations /> })
    return out
  }, [config, subs.subs]) // eslint-disable-line react-hooks/exhaustive-deps

  const ids = modules.map(m => m.id)
  const order = layout.order(ids)
  const anyCollapsed = ids.some(id => layout.collapsed.has(id))

  return (
    <div id="board" className="board container">
      <div className="toolbar">
        <div className="toolbar__l mono">
          <span className={`led ${metricsError ? 'led--bad' : metrics?.agg.all_ok ? 'led--live' : 'led--warn'}`} />
          <span>{metricsError ? `API error: ${metricsError}` : metrics ? `updated ${new Date(metrics.ts * 1000).toLocaleTimeString('en-US', { hour12: false, timeZone: config?.timezone || undefined })}` : 'connecting'}</span>
          <span className="toolbar__dim">· refresh {((config?.refresh_ms || 2500) / 1000).toFixed(1)}s</span>
          {config?.read_only && <span className="toolbar__ro" title="Monitoring only. Action buttons are visible but switched off.">READ-ONLY</span>}
        </div>
        <div className="toolbar__r">
          <ThemeMenu />
          <button type="button" className={`ctl ${layout.rearranging ? 'is-on' : ''}`} onClick={() => layout.setRearranging(!layout.rearranging)}>{layout.rearranging ? '✓ Done' : '⇅ Rearrange'}</button>
          <button type="button" className="ctl" onClick={() => layout.setAll(ids, !anyCollapsed)}>{anyCollapsed ? '☰ Expand all' : '☰ Collapse all'}</button>
          {layout.rearranging && <button type="button" className="ctl" onClick={layout.reset}>Reset layout</button>}
        </div>
      </div>
      {!config && <Empty>Loading the board...</Empty>}
      {order.map((id, i) => {
        const m = modules.find(x => x.id === id)
        if (!m) return null
        return <Module key={id} id={id} index={i} eyebrow={m.eyebrow} title={m.title} subtitle={m.subtitle} tone={m.tone} order={order}>{m.render()}</Module>
      })}
      <Clock />
    </div>
  )
}

/* Keeps "updated Ns ago" lines ticking between polls without re-fetching. */
function Clock() {
  const [, setT] = useState(0)
  useEffect(() => { const t = setInterval(() => setT(x => x + 1), 1000); return () => clearInterval(t) }, [])
  return null
}

function FleetSection({ s, subs, toggleSub }: { s: SectionCfg; subs: string[]; toggleSub: (id: string) => void }) {
  const { config, metrics } = useDash()
  if (!config) return null
  if (!metrics) return <Empty>Waiting for the first poll...</Empty>
  const th = metrics.thresholds
  const hist = metrics.history || {}
  const nodes = s.nodes.map(k => metrics.nodes.find(n => n.key === k)).filter(Boolean) as typeof metrics.nodes
  const unified = nodes.filter(n => n.profile === 'unified')
  const discrete = nodes.filter(n => n.profile === 'discrete')
  const models = metrics.models.filter(m => s.units.includes(m.unit))
  const nodeCfg = (k: string) => config.nodes.find(n => n.key === k)
  const subId = `${s.key}:models`
  const subOpen = !subs.includes(subId)
  return (
    <div className="fleet">
      {unified.length > 0 && (
        <div className="cards cards--4">
          {unified.map(n => n.profile === 'unified' && (
            <UnifiedCard key={n.key} s={n} hist={hist[`spark:${n.key}:temp`]} warn={nodeCfg(n.key)?.temp_warn ?? th.temp_warn} hot={nodeCfg(n.key)?.temp_hot ?? th.temp_hot} stale={th.stale_after_s} />
          ))}
        </div>
      )}
      {s.switch && config.switch && (
        <div className="cards cards--1">
          <SwitchCard sw={metrics.switch} name={config.switch.name} badge={config.switch.badge} warn={config.switch.temp_warn} hot={config.switch.temp_hot} stale={Math.max(th.stale_after_s, 30)} />
        </div>
      )}
      {discrete.map(b => b.profile === 'discrete' && (
        <div key={b.key} className="fleet__host">
          {b.gpus.length > 0 && (
            <div className="cards cards--4">
              {b.gpus.map(g => <GpuCard key={g.index} g={g} hist={hist[`gpu:${b.key}:${g.index}:temp`]} warn={nodeCfg(b.key)?.temp_warn ?? th.temp_warn} hot={nodeCfg(b.key)?.temp_hot ?? th.temp_hot} />)}
            </div>
          )}
          <div className="cards cards--1"><HostCard box={b} stale={th.stale_after_s} /></div>
        </div>
      ))}
      {(models.length > 0 || (s.models_title && s.nodes.length > 0)) && (
        <>
          {s.nodes.length > 0 && (
            <button type="button" className={`subhead ${subOpen ? '' : 'is-collapsed'}`} onClick={() => toggleSub(subId)} aria-expanded={subOpen}>
              <span>{subOpen ? '−' : '+'}</span> {s.models_title || 'Model performance'} <i>{models.length ? `${models.length}` : 'none configured'}</i>
            </button>
          )}
          {subOpen && models.length > 0 && <div className="cards cards--3">{models.map(m => <ModelCard key={m.key} m={m} stale={th.stale_after_s} />)}</div>}
        </>
      )}
    </div>
  )
}
