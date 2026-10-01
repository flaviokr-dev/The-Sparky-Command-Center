import { useDash } from '../lib/store'
import { Panel, Bar, Pill, Led, Empty } from '../components/Panel'
import { ago, fmtGB, isNum, type Tone } from '../lib/format'
import type { Filesystem, ModelHead, NodeStorage } from '../lib/api'

function tone(pct: number | null | undefined): Tone {
  if (!isNum(pct)) return 'muted'
  if (pct >= 92) return 'bad'
  if (pct >= 80) return 'warn'
  return 'good'
}

function rootOf(n: NodeStorage) {
  return n.filesystems.find(f => f.mount === '/' && f.kind !== 'network')
    || n.filesystems.find(f => f.kind !== 'network')
    || n.filesystems[0]
}

function sum(rows: Filesystem[], key: 'size' | 'used' | 'avail') {
  const roots = rows.filter(f => f.mount === '/')
  const pick = roots.length ? roots : rows
  return pick.reduce((a, f) => a + (f[key] || 0), 0)
}

export function Storage() {
  const { metrics } = useDash()
  const nodes = metrics?.storage || []
  if (!metrics) return <Empty>Waiting for the first poll...</Empty>
  if (!nodes.length) return <Empty>No nodes configured.</Empty>

  const live = nodes.filter(n => n.reachable)
  const roots = live.map(rootOf).filter((f): f is Filesystem => !!f)
  const total = sum(roots, 'size')
  const used = sum(roots, 'used')
  const free = sum(roots, 'avail')
  const tight = [...live].sort((a, b) => (rootOf(b)?.pct || 0) - (rootOf(a)?.pct || 0))[0]

  return (
    <div className="storage">
      <div className="cards cards--1">
        <Panel title={<><Led on />Fleet SSD</>} tone="amber">
          <div className="bigrow">
            <Stat label="Capacity" value={fmtGB(total)} unit="GiB" />
            <Stat label="Used" value={fmtGB(used)} unit="GiB" />
            <Stat label="Free" value={fmtGB(free)} unit="GiB" />
          </div>
          <p className="storage__note">
            {tight ? `${tight.name} is the fullest, ${rootOf(tight)?.pct ?? '-'}% on ${rootOf(tight)?.mount}.` : 'No disk reading yet.'}
            {' '}Each machine lists what is on its own SSD: checkpoints, Docker images, and the running head. Refreshed every 30s.
          </p>
        </Panel>
      </div>
      <div className="cards cards--4">
        {nodes.map(n => {
          const root = rootOf(n)
          return (
            <Panel key={n.key} title={<><Led on={n.reachable} tone={n.reachable ? tone(root?.pct) : 'bad'} />{n.name}</>}
              chips={root ? <Pill tone={tone(root.pct)}>{root.pct ?? '-'}%</Pill> : <Pill tone="muted">no disk</Pill>}
              dim={!n.reachable}>
              <div className="bigrow bigrow--2">
                <Stat label="Used" value={n.reachable ? fmtGB(root?.used) : '-'} unit="GiB" />
                <Stat label="Free" value={n.reachable ? fmtGB(root?.avail) : '-'} unit="GiB" />
              </div>
              {n.reachable && root && <Bar pct={root.pct} tone={tone(root.pct)} />}
              <span className="sublabel">{n.err ? n.err : ago(n.ts)}</span>
            </Panel>
          )
        })}
      </div>

      {nodes.map(n => (
        <Panel key={`${n.key}-detail`} className="card--wide" title={<>{n.name} · disk contents</>}
          chips={<span className="chip chip--muted">{n.reachable ? `${n.disks.length} disk${n.disks.length === 1 ? '' : 's'}` : 'unreachable'}</span>}
          dim={!n.reachable}>
          {!n.reachable && <p className="card__err">{n.err || 'No reading yet.'}</p>}
          {n.reachable && (
            <>
              <div className="storage__disks">
                {(n.disks.length ? n.disks : []).map(d => (
                  <div key={d.name} className="storage__disk">
                    <span className="mono">{d.name}</span>
                    <b>{fmtGB(d.size)} GiB</b>
                    <span>{d.model || 'unidentified'}</span>
                    <span>{d.tran || (d.rotational ? 'spinning' : 'flash')}</span>
                  </div>
                ))}
                {!n.disks.length && <p className="storage__note">lsblk did not list a disk. Filesystems below are still from df.</p>}
              </div>
              <FsTable title="On this SSD" rows={n.filesystems.filter(f => f.kind !== 'network')} />
              {n.filesystems.some(f => f.kind === 'network') && (
                <FsTable title="Mounted from another box" rows={n.filesystems.filter(f => f.kind === 'network')} />
              )}
              <Contents node={n} />
            </>
          )}
        </Panel>
      ))}
    </div>
  )
}

function FsTable({ title, rows }: { title: string; rows: Filesystem[] }) {
  if (!rows.length) return null
  return (
    <>
      <div className="subhead">{title}</div>
      <table className="storage__table">
        <thead>
          <tr>
            <th>Mount</th><th>Device</th><th>Size</th><th>Used</th><th>Free</th><th>Fill</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(f => (
            <tr key={f.mount + f.source}>
              <td className="mono">{f.mount}</td>
              <td className="mono storage__src" title={f.source}>{f.source}</td>
              <td>{fmtGB(f.size)}</td>
              <td>{fmtGB(f.used)}</td>
              <td>{fmtGB(f.avail)}</td>
              <td className="storage__fill">
                <Bar pct={f.pct} tone={tone(f.pct)} />
                <span className={tone(f.pct)}>{f.pct ?? '-'}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Contents({ node }: { node: NodeStorage }) {
  const models = node.models || []
  const images = node.images || []
  const heads = node.heads || []
  const dockerImages = node.docker?.images
  const modelBytes = models.reduce((a, m) => a + (m.size || 0), 0)
  return (
    <>
      <div className="subhead">Models on this SSD</div>
      <p className="storage__note">Folders with a config.json on this disk. A copy mounted from another Spark is not listed here. Hardlinked copies of the same files are one row.</p>
      {models.length ? (
        <table className="storage__table">
          <thead>
            <tr><th>Checkpoint</th><th>Path</th><th>Size</th></tr>
          </thead>
          <tbody>
            {models.map(m => (
              <tr key={m.path}>
                <td>{m.name}</td>
                <td className="mono storage__src" title={[m.path, ...(m.aliases || [])].join('\n')}>
                  {m.path}
                  {(m.aliases || []).map(a => <div key={a}>{a}</div>)}
                </td>
                <td>{fmtGB(m.size)} GiB</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="storage__note">No local checkpoint on this SSD.</p>}
      {models.length > 1 && (
        <p className="storage__note">Sum of those folders: {fmtGB(modelBytes)} GiB.</p>
      )}

      <div className="subhead">Images</div>
      <p className="storage__note">
        {images.length} image{images.length === 1 ? '' : 's'}
        {dockerImages?.size ? `, ${fmtGB(dockerImages.size)} GiB unique on disk` : ''}
        {dockerImages?.reclaimable ? `, ${fmtGB(dockerImages.reclaimable)} GiB reclaimable` : ''}.
        {' '}The size next to each tag is the layer total, so shared layers appear on every image that uses them.
      </p>
      {images.length ? (
        <table className="storage__table">
          <thead>
            <tr><th>Tag</th><th>Id</th><th>Layers</th></tr>
          </thead>
          <tbody>
            {images.map(img => (
              <tr key={img.id + (img.tags[0] || '')}>
                <td className="storage__tags">{img.tags.join(', ')}</td>
                <td className="mono storage__src">{img.id}</td>
                <td>{fmtGB(img.size)} GiB</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="storage__note">No Docker images reported.</p>}

      <div className="subhead">Heads</div>
      <p className="storage__note">The model server running on this machine, and the weight path mounted into it.</p>
      {heads.length ? heads.map(h => <HeadRow key={h.name} head={h} />) : (
        <p className="storage__note">No model server container running here.</p>
      )}
    </>
  )
}

function HeadRow({ head }: { head: ModelHead }) {
  return (
    <div className="storage__head">
      <div className="storage__disk">
        <b>{head.name}</b>
        <span>{head.status}</span>
        <span className="storage__tags">{head.image}</span>
      </div>
      {head.mounts.length ? (
        <table className="storage__table">
          <thead><tr><th>On disk</th><th>Inside the container</th></tr></thead>
          <tbody>
            {head.mounts.map(m => (
              <tr key={m.source + m.dest}>
                <td className="mono storage__src" title={m.source}>{m.source}</td>
                <td className="mono">{m.dest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="storage__note">Running, with no model directory mounted.</p>}
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bigstat">
      <span className="bigstat__l">{label}</span>
      <span className="bigstat__v">{value}{unit && <small> {unit}</small>}</span>
    </div>
  )
}
