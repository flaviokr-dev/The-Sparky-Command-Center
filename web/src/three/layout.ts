import type { ComfyLane, Metrics, UiConfig } from '../lib/api'
import { fmtBps, isNum } from '../lib/format'

// One layout for both the WebGL constellation and the SVG fallback, so the two always agree.
// The fabric switch (or the command center itself when there is no switch) is the core; unified-memory
// nodes sit on the inner ring, discrete GPU hosts on the outer ring, and each model server orbits the
// node it runs on.

export type Status = 'ok' | 'warn' | 'bad' | 'busy'
export type Kind = 'hub' | 'unified' | 'discrete' | 'model'

export interface SceneNode {
  id: string            // also the DOM anchor: #card-<id>
  kind: Kind
  label: string
  sub: string
  status: Status
  activity: number      // 0..1, drives particle speed / pulse
  parent?: string
  base: [number, number, number]
  orbit?: { r: number; phase: number; speed: number }
}

export interface SceneLink { a: string; b: string; status: Status; activity: number }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function buildScene(cfg: UiConfig | null, m: Metrics | null, lanes: ComfyLane[] | null): { nodes: SceneNode[]; links: SceneLink[] } {
  const nodes: SceneNode[] = []
  const links: SceneLink[] = []
  const warn = m?.thresholds.temp_warn ?? 70
  const hot = m?.thresholds.temp_hot ?? 84
  const sw = m?.switch
  const hubId = cfg?.switch ? 'switch' : 'control'
  const bps = sw?.total_bps || 0
  const fabricAct = bps > 0 ? clamp01(Math.log10(bps) / 11) : 0.08

  nodes.push({
    id: hubId, kind: 'hub',
    label: cfg?.switch ? cfg.switch.name : (cfg?.title || 'Command Center'),
    sub: cfg?.switch ? (sw?.reachable ? `${fmtBps(bps)} fabric` : 'unreachable') : 'control plane',
    status: cfg?.switch ? (sw ? (sw.reachable ? 'ok' : 'bad') : 'warn') : 'ok',
    activity: fabricAct, base: [0, 0, 0],
  })

  const all = m?.nodes || []
  const uni = all.filter(n => n.profile === 'unified')
  const dis = all.filter(n => n.profile !== 'unified')
  // Nodes that config knows about but metrics has not reported yet still get a place.
  const cfgNodes = cfg?.nodes || []
  const uniKeys = cfgNodes.filter(n => n.profile === 'unified').map(n => n.key)
  const disKeys = cfgNodes.filter(n => n.profile !== 'unified').map(n => n.key)

  // All hosts share one ring (unified first, then discrete) so the constellation stays compact.
  const ringKeys = [...uniKeys, ...disKeys]
  const slot = (key: string): [number, number, number] => {
    const i = ringKeys.indexOf(key)
    const a = (i / Math.max(1, ringKeys.length)) * Math.PI * 2 + Math.PI / 5
    const r = 2.35
    return [Math.cos(a) * r, (i % 2 ? 0.22 : -0.16), Math.sin(a) * r * 0.9]
  }

  uniKeys.forEach((key) => {
    const n = uni.find(x => x.key === key) as (typeof uni)[number] | undefined
    const temp = n && n.profile === 'unified' ? n.temp : null
    const status: Status = !n || !n.reachable ? 'bad' : isNum(temp) && temp >= warn ? (temp >= hot ? 'bad' : 'warn') : 'ok'
    const util = n && n.profile === 'unified' && isNum(n.util) ? n.util / 100 : 0
    nodes.push({
      id: `node-${key}`, kind: 'unified', label: (cfgNodes.find(c => c.key === key)?.name || key),
      sub: n?.reachable && n.profile === 'unified' ? `${isNum(n.temp) ? n.temp.toFixed(0) : '-'}°C · ${isNum(n.power) ? n.power.toFixed(0) : '-'} W` : 'unreachable',
      status, activity: clamp01(0.12 + util), base: slot(key),
    })
    links.push({ a: `node-${key}`, b: hubId, status: status === 'bad' ? 'bad' : 'ok', activity: Math.max(fabricAct, util) })
  })

  disKeys.forEach((key) => {
    const n = dis.find(x => x.key === key)
    let status: Status = 'bad'
    let sub = 'unreachable'
    let act = 0.1
    if (n && n.profile === 'discrete' && n.reachable) {
      const temps = n.gpus.map(g => g.temp).filter(isNum)
      const top = temps.length ? Math.max(...temps) : null
      status = isNum(top) && top >= warn ? (top >= hot ? 'bad' : 'warn') : 'ok'
      const pw = n.gpus.reduce((s, g) => s + (g.power || 0), 0)
      sub = `${n.gpus.length} GPU · ${pw.toFixed(0)} W`
      const u = n.gpus.map(g => g.util || 0)
      act = clamp01(0.1 + (u.length ? u.reduce((s, v) => s + v, 0) / u.length / 100 : 0))
    }
    nodes.push({
      id: `node-${key}`, kind: 'discrete', label: cfgNodes.find(c => c.key === key)?.name || key, sub, status, activity: act,
      base: slot(key),
    })
    links.push({ a: `node-${key}`, b: hubId, status: status === 'bad' ? 'bad' : 'ok', activity: act })
  })

  const models = m?.models || []
  const byParent: Record<string, number> = {}
  ;(cfg?.models || []).forEach((mc) => {
    const st = models.find(x => x.key === mc.key)
    const parent = mc.node && nodes.some(n => n.id === `node-${mc.node}`) ? `node-${mc.node}` : hubId
    const k = byParent[parent] = (byParent[parent] || 0) + 1
    const busy = !!st && (st.running || 0) > 0
    const status: Status = !st || !st.reachable ? 'bad' : busy ? 'busy' : 'ok'
    const tps = st?.decode_tps || 0
    nodes.push({
      id: `model-${mc.key}`, kind: 'model', parent,
      label: st?.model || mc.key,
      sub: !st || !st.reachable ? 'down' : busy ? `${tps.toFixed(0)} tok/s · ${st.running} live` : 'idle',
      status, activity: clamp01(busy ? 0.35 + tps / 400 : 0.08),
      base: [0, 0, 0], orbit: { r: parent === hubId ? 1.35 : 0.62, phase: k * 2.1, speed: busy ? 0.9 : 0.35 },
    })
    links.push({ a: `model-${mc.key}`, b: parent, status: status === 'bad' ? 'bad' : status, activity: clamp01(busy ? 0.4 + tps / 300 : 0.06) })
  })

  // Render lanes do not get their own bodies (six extra satellites crowd the scene); a rendering lane
  // makes its host glow busy instead.
  for (const l of lanes || []) {
    if (!l.busy) continue
    const host = nodes.find(n => n.kind !== 'model' && n.kind !== 'hub' && l.name.toLowerCase().includes(n.label.toLowerCase()))
    if (host && host.status === 'ok') host.status = 'busy'
  }
  return { nodes, links }
}

/** Static world position (orbiting models use their parent's base plus orbit phase at t). */
export function worldPos(n: SceneNode, all: SceneNode[], t: number): [number, number, number] {
  if (!n.orbit || !n.parent) return n.base
  const p = all.find(x => x.id === n.parent)
  const pb = p ? p.base : [0, 0, 0]
  const a = n.orbit.phase + t * n.orbit.speed * 0.5
  return [pb[0] + Math.cos(a) * n.orbit.r, pb[1] + 0.32 + Math.sin(a * 1.3) * 0.08, pb[2] + Math.sin(a) * n.orbit.r]
}
