import { useDash } from '../lib/store'
import { fmtGB } from '../lib/format'
import { Bar, Chip, Empty, Fresh, Panel } from '../components/Panel'

// ComfyUI render lanes. The badge is about ComfyUI only; the memory bar is the driver/kernel reading for
// that GPU (or the whole unified node), which may be full of something else, so the card names both.
export function Video() {
  const { comfy } = useDash()
  if (!comfy) return <Empty>Waiting for the render lanes...</Empty>
  if (!comfy.length) return <Empty>No lanes configured</Empty>
  return (
    <div className="cards cards--3">
      {comfy.map(l => {
        const dead = !l.reachable
        const pct = l.vram_total && l.vram_used != null ? Math.min(100, (l.vram_used / l.vram_total) * 100) : 0
        const state = dead ? 'ComfyUI offline' : l.busy ? 'RENDERING' : 'ComfyUI idle'
        const q = (l.running || 0) + (l.pending || 0)
        return (
          <Panel key={l.key} id={`card-lane-${l.key}`} tone={dead ? 'bad' : l.busy ? 'violet' : undefined}
            title={<><Chip tone="core">LANE {l.lane}</Chip> <span>{l.name}</span></>}
            chips={<span className={`lanestate lanestate--${dead ? 'bad' : l.busy ? 'busy' : 'good'} mono`}>● {state}</span>}>
            <div className="lane__v tnum">{fmtGB(l.vram_used)}<em>GB used {l.unified ? '· whole node' : '· this GPU'}</em></div>
            <Bar pct={dead ? 0 : pct} tone={dead ? 'muted' : undefined} />
            <div className="lane__meta mono"><span>{fmtGB(l.vram_free)} GB free of {fmtGB(l.vram_total)}</span><span>queue {q}</span></div>
            <div className="lane__peaks mono">
              <span className="violet">peak while rendering <b>{l.peak_busy != null ? `${fmtGB(l.peak_busy)} GB` : '-'}</b></span>
              <span>peak any {fmtGB(l.peak_used)} GB</span>
            </div>
            <p className="lane__src mono">via {l.mem_source || '?'}{l.unified ? ' (unified pool, whole node)' : ''}{l.comfy_used != null && l.mem_source !== 'comfyui' ? ` · ComfyUI self-reports ${fmtGB(l.comfy_used)} GB` : ''}</p>
            <a className="lane__open mono" href={l.url} target="_blank" rel="noopener noreferrer">open ComfyUI <span className="lane__host">{l.url.replace(/^https?:\/\//, '')}</span> →</a>
            <p className="lane__src mono">{l.host}{l.version ? ` · v${l.version}` : ''}</p>
            <Fresh ts={l.ts || undefined} err={dead ? 'ComfyUI not answering' : null} />
          </Panel>
        )
      })}
    </div>
  )
}
