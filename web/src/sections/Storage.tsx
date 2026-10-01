import { useDash } from '../lib/store'
import { Panel, Bar, Pill, Led, Empty } from '../components/Panel'
import { ago, fmtGB, isNum, type Tone } from '../lib/format'
import type { CatalogGroup, DockerImage, Filesystem, FleetCatalog, LocalModel, ModelHead, NodeStorage } from '../lib/api'

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
  const catalog = metrics.catalog

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
            {' '}A letter below lights when that machine has the files on its own SSD.
          </p>
          {catalog && <Pressure catalog={catalog} />}
        </Panel>
      </div>
      {catalog && <Catalog catalog={catalog} />}
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

function Pressure({ catalog }: { catalog: FleetCatalog }) {
  const rows = catalog.pressure || []
  if (!rows.length) {
    return <p className="storage__note">No machine is at 92% or more.</p>
  }
  return (
    <div className="pressure">
      {rows.map(p => (
        <div key={p.key} className="pressure__node">
          <b>{p.name} is {p.pct ?? '-'}% full, {fmtGB(p.free)} GiB free.</b>
          {p.items.length ? (
            <ol>
              {p.items.map((item, i) => (
                <li key={item.label}>{item.label}: {fmtGB(item.bytes)} GiB{i === 0 ? ', the most Docker can give back' : ''}</li>
              ))}
            </ol>
          ) : <p>Docker has nothing unused to give back on this machine.</p>}
          {p.weights_larger && p.biggest && (
            <p>The checkpoints are larger than that. The biggest is {p.biggest.family}: {p.biggest.label} {fmtGB(p.biggest.bytes)} GiB. This list does not delete it.</p>
          )}
        </div>
      ))}
      <p className="storage__note">A ranking only. Nothing is deleted from this page.</p>
    </div>
  )
}

function Catalog({ catalog }: { catalog: FleetCatalog }) {
  return (
    <Panel className="card--wide" title={<>Models and variants</>}
      chips={<span className="chip chip--muted">one row across the fleet</span>}>
      <p className="storage__note">Same files on more than one machine are one row. A filled letter means that SSD has the copy. Cyan means the running server on that machine is using it.</p>
      <GroupList title="Weights" groups={catalog.weights} marks={catalog.marks} empty="No checkpoints reported yet." />
      <GroupList title="Images" groups={catalog.images} marks={catalog.marks} empty="No images reported yet." />
    </Panel>
  )
}

function GroupList({ title, groups, marks, empty }: { title: string; groups: CatalogGroup[]; marks: FleetCatalog['marks']; empty: string }) {
  return (
    <>
      <div className="subhead">{title}</div>
      {groups.length ? groups.map(group => (
        <section key={group.name} className="family">
          <h3>{group.name}</h3>
          {group.variants.map(row => (
            <article key={(row.folder || row.label) + row.label} className={`variant${row.serving ? ' is-serving' : ''}`}>
              <div className="variant__copy">
                <b>{row.label}</b>
                {row.folder && <span className="mono variant__folder">{row.folder}</span>}
                <span>{fmtGB(row.size)} GiB{row.places.length > 1 ? ' each' : ''}. {row.where}{row.note ? `. ${row.note}` : ''}{row.serving ? '. In the running server.' : ''}</span>
              </div>
              <div className="marks" aria-label={row.where}>
                {marks.map(m => {
                  const hit = row.places.find(p => p.key === m.key)
                  const state = !m.reachable ? 'down' : hit ? (hit.serving ? 'serving' : 'on') : 'off'
                  return <span key={m.key} className={`mark is-${state}`} title={m.name}>{m.mark}</span>
                })}
              </div>
            </article>
          ))}
        </section>
      )) : <p className="storage__note">{empty}</p>}
    </>
  )
}

function shortName(ref: string) {
  const [repo, ver] = ref.split(':')
  const name = (repo || ref).split('/').pop() || ref
  return ver ? `${name}:${ver}` : name
}

function shareLabel(part: number, whole: number) {
  if (!whole) return ''
  const pct = (part / whole) * 100
  if (pct < 1) return '<1%'
  return `${Math.round(pct)}%`
}

function servingPaths(heads: ModelHead[]) {
  return new Set(heads.flatMap(h => h.mounts.map(m => m.source)))
}

function isServing(model: LocalModel, live: Set<string>) {
  return live.has(model.path) || (model.aliases || []).some(a => live.has(a))
}

function Contents({ node }: { node: NodeStorage }) {
  const models = node.models || []
  const images = node.images || []
  const heads = node.heads || []
  const dockerImages = node.docker?.images
  const modelBytes = models.reduce((a, m) => a + (m.size || 0), 0)
  const maxModel = models.reduce((a, m) => Math.max(a, m.size || 0), 0)
  const maxImage = images.reduce((a, m) => Math.max(a, m.size || 0), 0)
  const live = servingPaths(heads)
  return (
    <>
      <div className="subhead">Models <i>{models.length ? `${fmtGB(modelBytes)} GiB on this SSD` : 'none on this SSD'}</i></div>
      {models.length ? (
        <div className="rack">
          <div className="rack__map" aria-hidden>
            {models.map((m, i) => (
              <div key={m.path} className={`rack__seg hue-${i % 4}${isServing(m, live) ? ' is-live' : ''}`} style={{ flexGrow: m.size }} title={`${m.name} ${fmtGB(m.size)} GiB`} />
            ))}
          </div>
          {models.map((m, i) => (
            <Weight key={m.path} model={m} hue={i % 4} max={maxModel} total={modelBytes} live={isServing(m, live)} />
          ))}
        </div>
      ) : <p className="storage__note">No local checkpoint on this SSD. Weights mounted from another machine stay off this list.</p>}

      <div className="subhead">Images <i>{dockerImages?.size ? `${fmtGB(dockerImages.size)} GiB unique` : `${images.length} on disk`}</i></div>
      {images.length ? (
        <div className="shelf">
          {images.map((img, i) => (
            <Can key={img.id + (img.tags[0] || '')} img={img} hue={i % 4} max={maxImage} />
          ))}
        </div>
      ) : <p className="storage__note">No Docker images reported.</p>}
      {dockerImages?.reclaimable ? (
        <p className="storage__note">{fmtGB(dockerImages.reclaimable)} GiB of images can be reclaimed. Each block’s number is its layer total, so a shared layer shows up on every image that uses it.</p>
      ) : null}

      <div className="subhead">Heads <i>{heads.length ? `${heads.length} running` : 'idle'}</i></div>
      {heads.length ? heads.map(h => <Engine key={h.name} head={h} models={models} />) : (
        <p className="storage__note">No model server container running here.</p>
      )}
    </>
  )
}

function Weight({ model, hue, max, total, live }: { model: LocalModel; hue: number; max: number; total: number; live: boolean }) {
  const width = max ? Math.max(8, (model.size / max) * 100) : 0
  return (
    <article className={`weight hue-${hue}${live ? ' is-live' : ''}`}>
      <div className="weight__fill" style={{ width: `${width}%` }} />
      <div className="weight__body">
        <span className="weight__gib">{fmtGB(model.size)}<small>GiB</small></span>
        <div className="weight__id">
          <b>{model.name}{live && <em>serving</em>}</b>
          <span className="mono" title={[model.path, ...(model.aliases || [])].join('\n')}>{model.path}</span>
          {(model.aliases || []).length > 0 && (
            <span className="weight__alias">same files also at {(model.aliases || []).join(' · ')}</span>
          )}
        </div>
        <span className="weight__share">{shareLabel(model.size, total)}</span>
      </div>
    </article>
  )
}

function Can({ img, hue, max }: { img: DockerImage; hue: number; max: number }) {
  const grow = max ? Math.max(1, Math.round((img.size / max) * 6)) : 1
  const tags = img.tags || []
  return (
    <article className={`can hue-${hue}`} style={{ flexGrow: grow }} title={tags.join('\n')}>
      <span className="can__size">{fmtGB(img.size)}<small>GiB</small></span>
      <span className="can__tag">{shortName(tags[0] || img.id)}{tags.length > 1 ? ` +${tags.length - 1}` : ''}</span>
      <span className="mono can__id">{img.id}</span>
    </article>
  )
}

function Engine({ head, models }: { head: ModelHead; models: LocalModel[] }) {
  const local = new Set(models.flatMap(m => [m.path, ...(m.aliases || [])]))
  return (
    <div className="engine">
      <div className="engine__box">
        <span className="engine__status"><Led on={head.status === 'running'} />{head.status}</span>
        <b>{head.name}</b>
        <span className="engine__image" title={head.image}>{shortName(head.image)}</span>
      </div>
      <div className="engine__mounts">
        {head.mounts.length ? head.mounts.map(m => {
          const here = local.has(m.source)
          const leaf = m.source.split('/').filter(Boolean).pop() || m.source
          return (
            <div key={m.source + m.dest} className={`mount${here ? ' is-here' : ''}`}>
              <span className="mount__dest">{m.dest}</span>
              <span className="mount__src" title={m.source}>{leaf} · {here ? 'this SSD' : 'another machine'}</span>
            </div>
          )
        }) : <p className="storage__note">Running, with no model directory mounted.</p>}
      </div>
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
