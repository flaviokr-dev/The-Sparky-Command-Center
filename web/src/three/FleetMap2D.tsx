import { worldPos, type SceneLink, type SceneNode } from './layout'

// No-WebGL fallback: the same constellation, flattened to SVG + buttons. Still live, still clickable.
const project = (p: [number, number, number]) => ({ x: 50 + p[0] * 9.5, y: 48 + p[2] * 11 - p[1] * 7 })

export function FleetMap2D({ nodes, links, onPick, className = '' }: { nodes: SceneNode[]; links: SceneLink[]; onPick: (id: string) => void; className?: string }) {
  const pos = Object.fromEntries(nodes.map(n => [n.id, project(worldPos(n, nodes, 0))]))
  return (
    <div className={`map2d ${className}`} role="group" aria-label="Fleet map">
      <svg className="map2d__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {links.map(l => {
          const A = pos[l.a], B = pos[l.b]
          if (!A || !B) return null
          return (
            <g key={`${l.a}-${l.b}`}>
              <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="map2d__link" />
              <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} className={`map2d__flow map2d__flow--${l.status}`} />
            </g>
          )
        })}
      </svg>
      {nodes.map(n => (
        <button key={n.id} type="button" className={`map2d__node map2d__node--${n.kind} is-${n.status}`} style={{ left: `${pos[n.id].x}%`, top: `${pos[n.id].y}%` }}
          onClick={() => onPick(n.id)} title={`${n.label} · ${n.sub}`}>
          <span className="map2d__glyph" aria-hidden />
          {n.kind !== 'model' && <span className="map2d__label mono">{n.label}</span>}
        </button>
      ))}
    </div>
  )
}
