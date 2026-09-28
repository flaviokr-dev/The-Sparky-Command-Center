import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import { worldPos, type SceneLink, type SceneNode, type Status } from './layout'

// The fleet as a live constellation. The core is the fabric switch; every node, model server and link is
// real telemetry: colour = status, particle speed = activity (fabric throughput, GPU util, decode tok/s).

export interface Palette { core: string; amber: string; bad: string; violet: string; bg: string; grid: string; gridSection: string; ink: string }

const tmp = new THREE.Color()
// The canvas listens on the whole page (for parallax), so ignore picks that land on real UI above it.
type Ev = { stopPropagation: () => void; nativeEvent: Event }
const onUi = (e: Ev) => !!(e.nativeEvent.target as HTMLElement | null)?.closest?.('a,button,input,textarea,select,label,.chat,.nav,.menu,.hero__content p,.hero__title')
const colorOf = (s: Status, p: Palette) => (s === 'bad' ? p.bad : s === 'warn' ? p.amber : s === 'busy' ? p.violet : p.core)

function Hub({ node, pal, onPick, onHover, animate, portal, hovered }: { node: SceneNode; pal: Palette; onPick: (id: string) => void; onHover: (id: string | null) => void; animate: boolean; portal?: MutableRefObject<HTMLElement>; hovered: boolean }) {
  const outer = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const col = colorOf(node.status, pal)
  useFrame(({ clock }) => {
    if (!animate) return
    const t = clock.elapsedTime
    if (outer.current) { outer.current.rotation.y = t * 0.22; outer.current.rotation.x = Math.sin(t * 0.4) * 0.3 }
    if (inner.current) { inner.current.rotation.y = -t * 0.6; inner.current.scale.setScalar(1 + Math.sin(t * 2.1) * 0.06 + node.activity * 0.12) }
    if (ringA.current) ringA.current.rotation.z = t * (0.1 + node.activity * 0.4)
    if (ringB.current) ringB.current.rotation.z = -t * 0.07
  })
  return (
    <group onClick={(e) => { e.stopPropagation(); if (!onUi(e)) onPick(node.id) }} onPointerOver={(e) => { e.stopPropagation(); if (!onUi(e)) onHover(node.id) }} onPointerOut={() => onHover(null)}>
      <mesh ref={outer}>
        <octahedronGeometry args={[0.78, 0]} />
        <meshBasicMaterial color={col} wireframe transparent opacity={0.6} />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.26, 2]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.15} metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color={col} transparent opacity={0.035} depthWrite={false} />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2.3, 0.2, 0]}>
        <torusGeometry args={[1.25, 0.006, 8, 160]} />
        <meshBasicMaterial color={col} transparent opacity={0.65} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 1.8, -0.5, 0.3]}>
        <torusGeometry args={[1.6, 0.005, 8, 180]} />
        <meshBasicMaterial color={pal.amber} transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.45, 0.003, 6, 220]} />
        <meshBasicMaterial color={pal.gridSection} transparent opacity={0.9} />
      </mesh>
      <Html position={[0, -1.02, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} portal={portal}>
        <div className={`scene-label scene-label--hub scene-label--${node.status} ${hovered ? 'is-hover' : ''}`}><b>{node.label}</b><span>{node.sub}</span></div>
      </Html>
    </group>
  )
}

function Body({ node, all, pal, showLabel, compactLabel, hovered, onPick, onHover, animate, portal }: {
  node: SceneNode; all: SceneNode[]; pal: Palette; showLabel: boolean; compactLabel: boolean; hovered: boolean; portal?: MutableRefObject<HTMLElement>
  onPick: (id: string) => void; onHover: (id: string | null) => void; animate: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  const led = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const col = colorOf(node.status, pal)
  const isModel = node.kind === 'model'
  const size: [number, number, number] = node.kind === 'discrete' ? [0.62, 0.22, 0.36] : [0.32, 0.32, 0.32]
  useFrame(({ clock }) => {
    const t = animate ? clock.elapsedTime : 0
    const p = worldPos(node, all, t)
    if (ref.current) {
      ref.current.position.set(p[0], p[1], p[2])
      if (animate) ref.current.rotation.y = t * (isModel ? 0.9 : 0.25) + p[0]
    }
    if (led.current) (led.current.material as THREE.MeshBasicMaterial).opacity = animate ? 0.45 + 0.55 * Math.abs(Math.sin(t * (1.5 + node.activity * 4) + p[0])) : 1
    if (halo.current) {
      const pulse = node.status === 'busy' || node.status === 'bad' ? 1 + Math.sin(t * 4) * 0.18 : 1
      halo.current.scale.setScalar((hovered ? 1.35 : 1) * pulse)
    }
  })
  return (
    <group ref={ref}>
      <group onClick={(e) => { e.stopPropagation(); if (!onUi(e)) onPick(node.id) }} onPointerOver={(e) => { e.stopPropagation(); if (!onUi(e)) onHover(node.id) }} onPointerOut={() => onHover(null)}>
        {isModel ? (
          <mesh>
            <icosahedronGeometry args={[node.status === 'busy' ? 0.13 : 0.095, 1]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.6} roughness={0.35} />
          </mesh>
        ) : (
          <mesh>
            <boxGeometry args={size} />
            <meshStandardMaterial color="#0e1216" metalness={0.7} roughness={0.3} />
            <Edges color={col} threshold={15} />
          </mesh>
        )}
        {!isModel && (
          <mesh ref={led} position={[0, size[1] / 2 + 0.1, 0]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshBasicMaterial color={col} transparent />
          </mesh>
        )}
        <mesh ref={halo}>
          <sphereGeometry args={[isModel ? 0.2 : 0.34, 16, 16]} />
          <meshBasicMaterial color={col} transparent opacity={hovered ? 0.14 : node.status === 'ok' ? 0.03 : 0.09} depthWrite={false} />
        </mesh>
      </group>
      {showLabel && (
        <Html position={[0, isModel ? 0.24 : 0.5, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} portal={portal}>
          <div className={`scene-label scene-label--${node.status} ${isModel ? 'scene-label--model' : ''} ${hovered ? 'is-hover' : ''}`}>
            <b>{node.label}</b>{!compactLabel && <span>{node.sub}</span>}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Lines + flowing particles from every node to what it hangs off. */
function Links({ nodes, links, pal, perLink, animate }: { nodes: SceneNode[]; links: SceneLink[]; pal: Palette; perLink: number; animate: boolean }) {
  const total = links.length * perLink
  // Rebuild buffers only when the topology or a status changes; activity is read live from a ref.
  const sig = links.map(l => `${l.a}>${l.b}:${l.status}`).join('|')
  const live = useRef(links)
  live.current = links
  const lineGeo = useRef<THREE.BufferGeometry>(null)
  const ptsGeo = useRef<THREE.BufferGeometry>(null)
  const { positions, colors, offsets, linePos, lineCol } = useMemo(() => {
    const positions = new Float32Array(Math.max(1, total) * 3)
    const colors = new Float32Array(Math.max(1, total) * 3)
    const offsets = new Float32Array(Math.max(1, total))
    const linePos = new Float32Array(Math.max(1, links.length) * 6)
    const lineCol = new Float32Array(Math.max(1, links.length) * 6)
    links.forEach((l, li) => {
      tmp.set(colorOf(l.status, pal))
      for (let k = 0; k < perLink; k++) {
        const i = li * perLink + k
        offsets[i] = Math.random()
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b
      }
      const dim = l.status === 'bad' ? 0.55 : 0.28
      for (let v = 0; v < 2; v++) { lineCol[li * 6 + v * 3] = tmp.r * dim; lineCol[li * 6 + v * 3 + 1] = tmp.g * dim; lineCol[li * 6 + v * 3 + 2] = tmp.b * dim }
    })
    return { positions, colors, offsets, linePos, lineCol }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, perLink, pal])
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes])
  const phase = useRef(new Float32Array(64))

  useFrame(({ clock }, dt) => {
    const t = animate ? clock.elapsedTime : 0
    const lg = lineGeo.current
    const pg = ptsGeo.current
    if (!lg || !pg) return
    const la = lg.getAttribute('position') as THREE.BufferAttribute
    const pa = pg.getAttribute('position') as THREE.BufferAttribute
    const L = la.array as Float32Array
    const P = pa.array as Float32Array
    live.current.forEach((l, li) => {
      if (li >= phase.current.length) return
      const A = byId[l.a], B = byId[l.b]
      if (!A || !B) return
      const a = worldPos(A, nodes, t), b = worldPos(B, nodes, t)
      L.set(a, li * 6); L.set(b, li * 6 + 3)
      if (animate) phase.current[li] += dt * (l.status === 'bad' ? 0 : 0.08 + l.activity * 0.9)
      for (let k = 0; k < perLink; k++) {
        const i = li * perLink + k
        const p = l.status === 'bad' ? offsets[i] : (offsets[i] + phase.current[li]) % 1
        const e = p * p * (3 - 2 * p)
        const lift = Math.sin(p * Math.PI) * 0.18
        P[i * 3] = a[0] + (b[0] - a[0]) * e
        P[i * 3 + 1] = a[1] + (b[1] - a[1]) * e + lift
        P[i * 3 + 2] = a[2] + (b[2] - a[2]) * e
      }
    })
    la.needsUpdate = true
    pa.needsUpdate = true
  })
  return (
    <>
      <lineSegments>
        <bufferGeometry ref={lineGeo}>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[lineCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.9} />
      </lineSegments>
      <points>
        <bufferGeometry ref={ptsGeo}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.05} vertexColors transparent opacity={0.95} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  )
}

function Dust({ count, color }: { count: number; color: string }) {
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 24
      a[i * 3 + 1] = (Math.random() - 0.5) * 12
      a[i * 3 + 2] = (Math.random() - 0.5) * 16 - 3
    }
    return a
  }, [count])
  const ref = useRef<THREE.Points>(null)
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.01 })
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.02} color={color} transparent opacity={0.45} sizeAttenuation depthWrite={false} />
    </points>
  )
}

function Rig({ nodes, links, pal, tier, animate, onPick, portal }: { nodes: SceneNode[]; links: SceneLink[]; pal: Palette; tier: 1 | 2; animate: boolean; onPick: (id: string) => void; portal?: MutableRefObject<HTMLElement> }) {
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const { pointer, size, gl } = useThree()
  const [hover, setHover] = useState<string | null>(null)
  const wide = size.width / size.height > 1.15
  const fit = wide ? Math.min(0.9, Math.max(0.58, size.width / size.height / 1.9)) : Math.min(1.05, Math.max(0.78, size.width / 390))
  const onHover = (id: string | null) => { setHover(id); gl.domElement.style.cursor = id ? 'pointer' : '' }

  useFrame(({ clock }, dt) => {
    if (!group.current) return
    group.current.scale.setScalar(fit)
    group.current.position.set(wide ? 2.35 : 0, wide ? 0.55 : 0.35, 0)
    if (!animate) return
    const k = Math.min(1, dt * 3)
    group.current.rotation.y += ((pointer.x * 0.28) - group.current.rotation.y) * k
    group.current.rotation.x += ((-pointer.y * 0.12) - group.current.rotation.x) * k
    if (spin.current && !hover) spin.current.rotation.y = Math.sin(clock.elapsedTime * 0.06) * 0.5
    if (light.current) {
      light.current.position.x += (pointer.x * 5 - light.current.position.x) * k
      light.current.position.y += (pointer.y * 3 + 1.5 - light.current.position.y) * k
    }
  })
  const hub = nodes.find(n => n.kind === 'hub')
  const bodies = nodes.filter(n => n.kind !== 'hub')
  return (
    <group ref={group}>
      <pointLight ref={light} position={[0, 2, 3]} intensity={18} color={pal.core} distance={12} decay={2} />
      <pointLight position={[-4, -2, 3]} intensity={9} color={pal.amber} distance={10} decay={2} />
      <pointLight position={[4, 3, -2]} intensity={6} color={pal.violet} distance={10} decay={2} />
      <ambientLight intensity={0.4} />
      <group ref={spin}>
        {hub && <Hub node={hub} pal={pal} onPick={onPick} onHover={onHover} animate={animate} portal={portal} hovered={hover === hub.id} />}
        {bodies.map(n => (
          <Body key={n.id} node={n} all={nodes} pal={pal} animate={animate}
            showLabel={n.kind !== 'model' || hover === n.id} portal={portal}
            compactLabel={tier === 1 && hover !== n.id}
            hovered={hover === n.id} onPick={onPick} onHover={onHover} />
        ))}
        <Links nodes={nodes} links={links} pal={pal} perLink={tier === 2 ? 26 : 12} animate={animate} />
      </group>
      <Dust count={tier === 2 ? 1100 : 380} color={pal.ink} />
      <Grid position={[0, -2.2, 0]} args={[40, 40]} cellSize={0.6} cellThickness={0.6} cellColor={pal.grid}
        sectionSize={3} sectionThickness={1} sectionColor={pal.gridSection} fadeDistance={22} fadeStrength={1.6} infiniteGrid />
    </group>
  )
}

export default function FleetScene({ nodes, links, pal, tier, active, reduced, onPick, portal }: {
  nodes: SceneNode[]; links: SceneLink[]; pal: Palette; tier: 1 | 2; active: boolean; reduced: boolean; onPick: (id: string) => void
  portal?: MutableRefObject<HTMLElement>
}) {
  // Reduced motion: one still frame, re-rendered only when the data changes.
  return (
    <Canvas
      dpr={[1, tier === 2 ? 1.75 : 1.25]}
      camera={{ position: [0, 3.6, 8.4], fov: 38, near: 0.1, far: 60 }}
      gl={{ antialias: tier === 2, powerPreference: 'high-performance', alpha: true }}
      frameloop={reduced ? 'demand' : active ? 'always' : 'never'}
      style={{ position: 'absolute', inset: 0 }}
      eventSource={typeof document !== 'undefined' ? (document.getElementById('root') as HTMLElement) : undefined}
      eventPrefix="client"
    >
      <fog attach="fog" args={[pal.bg, 8, 19]} />
      <Rig nodes={nodes} links={links} pal={pal} tier={tier} animate={!reduced} onPick={onPick} portal={portal} />
    </Canvas>
  )
}
