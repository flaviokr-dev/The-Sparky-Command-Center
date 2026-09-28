import React, { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { useDash } from '../lib/store'
import { readPalette, useLayout } from '../lib/layout'
import { buildScene } from '../three/layout'
import { FleetMap2D } from '../three/FleetMap2D'
import { usePerfTier, useReducedMotion } from '../hooks/useMotion'
import { MagneticButton } from '../components/MagneticButton'
import { Marquee } from '../components/Marquee'
import { Counter } from '../components/Counter'
import { scrollToTarget } from '../hooks/useLenis'
import { dateLine, fmtBps, fmtTok, fmtTps, isNum } from '../lib/format'
import type { Palette } from '../three/FleetScene'

const FleetScene = lazy(() => import('../three/FleetScene'))

function hasWebGL() {
  try {
    if (new URLSearchParams(window.location.search).get('nowebgl') === '1') return false
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function pickTarget(id: string) {
  const el = document.getElementById(id === 'control' ? 'board' : `card-${id}`)
  if (!el) return
  scrollToTarget(el, -110)
  el.classList.remove('is-flash')
  void el.offsetWidth
  el.classList.add('is-flash')
}

export function Hero({ ready, onAsk }: { ready: boolean; onAsk: () => void }) {
  const { config, metrics, comfy, chat } = useDash()
  const { theme } = useLayout()
  const tier = usePerfTier()
  const reduced = useReducedMotion()
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(true)
  const [webgl] = useState(hasWebGL)
  const [pal, setPal] = useState<Palette>(() => readPalette())
  const labels = useRef<HTMLDivElement>(null) as unknown as React.MutableRefObject<HTMLElement>

  useEffect(() => { const r = requestAnimationFrame(() => setPal(readPalette())); return () => cancelAnimationFrame(r) }, [theme])
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.02 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!ready || !root.current) return
    if (reduced) {
      root.current.querySelectorAll<HTMLElement>('.reveal-line > span, .hero__fade').forEach(n => { n.style.transform = 'none'; n.style.opacity = '1' })
      return
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })
      tl.to('.hero__title .reveal-line > span', { y: 0, duration: 1.3, stagger: 0.1 }, 0.1)
        .to('.hero__fade', { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, 0.5)
    }, root)
    return () => ctx.revert()
  }, [ready, reduced])

  const scene = useMemo(() => buildScene(config, metrics, comfy), [config, metrics, comfy])
  const agg = metrics?.agg
  const down = agg?.down || []
  const models = metrics?.models || []
  const upModels = models.filter(m => m.reachable).length
  const rendering = (comfy || []).filter(l => l.busy).length
  const nodeCount = metrics?.nodes.length || 0
  const fallback = <FleetMap2D nodes={scene.nodes} links={scene.links} onPick={pickTarget} className="hero__map2d" />

  return (
    <section id="top" className="hero" ref={root}>
      <div className="hero__scene">
        {webgl && tier > 0 ? (
          <SceneBoundary fallback={fallback}>
            <Suspense fallback={<div className="hero__fallback" />}>
              <FleetScene nodes={scene.nodes} links={scene.links} pal={pal} tier={tier === 2 ? 2 : 1} active={active && ready} reduced={reduced} onPick={pickTarget} portal={labels} />
            </Suspense>
          </SceneBoundary>
        ) : webgl && reduced ? (
          <SceneBoundary fallback={fallback}>
            <Suspense fallback={<div className="hero__fallback" />}>
              <FleetScene nodes={scene.nodes} links={scene.links} pal={pal} tier={1} active={false} reduced onPick={pickTarget} portal={labels} />
            </Suspense>
          </SceneBoundary>
        ) : fallback}
        <div className="hero__vignette" aria-hidden />
        <div className="hero__labels" ref={labels as unknown as React.RefObject<HTMLDivElement>} />
      </div>

      <div className="container hero__content">
        <div className="hero__top hero__fade">
          <span className="eyebrow">{[config?.title, config?.location].filter(Boolean).join(' · ') || 'Command Center'}</span>
          <span className="hero__coords mono">{dateLine(config?.timezone).toUpperCase()}</span>
        </div>

        <h1 className="hero__title display-xl">
          <span className="reveal-line"><span>FLEET</span></span>
          <span className="reveal-line"><span>COMMAND.</span></span>
          <span className="reveal-line"><span>{!metrics ? ' ' : agg?.all_ok ? <em>ALL SYSTEMS GO.</em> : <em className="is-bad">{down.length} DOWN.</em>}</span></span>
        </h1>

        <div className="hero__grid">
          <p className="hero__lead lead hero__fade">
            {metrics ? (
              <>
                <strong>{agg?.gpu_count} GPUs online</strong> across {nodeCount} nodes, drawing <strong>{agg?.total_power} W</strong>.{' '}
                {agg?.hottest_unit && <>Hottest is {agg.hottest_unit} at {isNum(agg.hottest_temp) ? agg.hottest_temp.toFixed(0) : '-'}°C. </>}
                {models.length > 0 && <>{upModels} of {models.length} model servers up{rendering ? `, ${rendering} render lane${rendering > 1 ? 's' : ''} busy` : ''}. </>}
                {down.length > 0 && <strong className="bad">Down: {down.join(', ')}.</strong>}
              </>
            ) : 'Reading the fleet...'}
          </p>
          <div className="hero__ctas hero__fade">
            {config?.chat.enabled && (
              <MagneticButton className="btn btn--primary" onClick={(e) => { e.preventDefault(); onAsk() }} href="#ask" cursor="ask">
                Ask {config.chat.name} <span className="arrow">→</span>
              </MagneticButton>
            )}
            <MagneticButton className="btn" href="#board" onClick={(e) => { e.preventDefault(); scrollToTarget('#board', -80) }}>
              Open the board <span className="arrow">↓</span>
            </MagneticButton>
            {chat && config?.chat.enabled && (
              <span className={`hero__brain mono ${chat.reachable ? '' : 'is-off'}`}>
                <span className={`led ${chat.reachable ? 'led--live' : 'led--warn'}`} /> {chat.configured ? (chat.reachable ? `brain · ${chat.active_model}${chat.fallback ? ' (fallback)' : ''}` : 'brain unreachable') : 'no model connected'}
              </span>
            )}
          </div>
        </div>

        <div className="hero__stats hero__fade">
          <div className="hstat"><span className="hstat__l">Fleet GPUs</span><span className="hstat__v tnum core">{agg ? <Counter value={agg.gpu_count} /> : '-'}<em>online</em></span></div>
          <div className="hstat"><span className="hstat__l">Total power draw</span><span className="hstat__v tnum violet">{agg ? <Counter value={agg.total_power} /> : '-'}<em>W</em></span></div>
          <div className="hstat"><span className="hstat__l">Hottest unit</span><span className={`hstat__v hstat__v--sm ${isNum(agg?.hottest_temp) && (agg?.hottest_temp || 0) >= (metrics?.thresholds.temp_hot || 84) ? 'bad' : 'good'}`}>{agg?.hottest_unit || '-'}<em>{isNum(agg?.hottest_temp) ? `${agg?.hottest_temp?.toFixed(0)}°C` : ''}</em></span></div>
          <div className="hstat"><span className="hstat__l">Fleet status</span><span className={`hstat__v hstat__v--sm ${agg?.all_ok ? 'good' : 'bad'}`}>● {agg ? (agg.all_ok ? 'ALL OK' : 'DEGRADED') : '...'}</span></div>
        </div>
        <p className="hero__hint mono hero__fade">{webgl && !reduced ? 'Move to look around · click a node to jump to its card' : 'Click a node to jump to its card'}</p>
      </div>
    </section>
  )
}

export function Ticker() {
  const { metrics, tokens, comfy } = useDash()
  if (!metrics) return <div className="ticker" />
  const items: ReactNode[] = []
  for (const m of metrics.models) {
    items.push(<span className="tick"><b>{m.model || m.label}</b>{m.reachable ? <>{fmtTps(m.decode_tps)} tok/s decode<i>/</i>{m.running || 0} live</> : <span className="bad">down</span>}</span>)
  }
  if (metrics.switch?.reachable) items.push(<span className="tick"><b>Fabric</b>{fmtBps(metrics.switch.total_bps)}</span>)
  items.push(<span className="tick"><b>Fleet draw</b>{metrics.agg.total_power} W</span>)
  if (metrics.agg.hottest_unit) items.push(<span className="tick"><b>Hottest</b>{metrics.agg.hottest_unit} {metrics.agg.hottest_temp?.toFixed(0)}°C</span>)
  if (comfy?.length) items.push(<span className="tick"><b>Render lanes</b>{comfy.filter(l => l.reachable).length}/{comfy.length} up<i>/</i>{comfy.filter(l => l.busy).length} rendering</span>)
  if (tokens) {
    const today = Object.entries(tokens).filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object').reduce((s, [, v]) => s + (Number((v as { today_tokens?: number }).today_tokens) || 0), 0)
    items.push(<span className="tick"><b>Tokens today</b>{fmtTok(today)}</span>)
  }
  return (
    <div className="ticker" aria-label="Live fleet ticker">
      <Marquee speed={48} items={items.map((it, i) => <span key={i} className="tick__wrap">{it}<span className="tick__sep" aria-hidden>◆</span></span>)} />
    </div>
  )
}
