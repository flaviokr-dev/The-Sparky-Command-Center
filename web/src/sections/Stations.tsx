import { useEffect, useState } from 'react'
import { useDash } from '../lib/store'
import { getLights, type Light } from '../lib/api'
import { Empty, Panel } from '../components/Panel'

// Web stations on the host (links + up/down probe) and the key lights, read-only here.
export function Stations() {
  const { config, stations } = useDash()
  return (
    <div className="stations-wrap">
      {config?.stations.enabled && (
        stations ? (
          <div className="stations">
            {stations.map(s => (
              <a key={s.name} className={`station ${s.up ? '' : 'is-down'}`} href={s.url} target="_blank" rel="noopener noreferrer">
                <span className="station__emoji" aria-hidden>{s.emoji}</span>
                <span className="station__name">{s.name}</span>
                <span className="station__desc">{s.desc}</span>
                <span className={`station__state mono ${s.up ? 'good' : 'bad'}`}>● {s.up ? 'up' : 'down'}{s.port ? ` · :${s.port}` : ''}</span>
              </a>
            ))}
          </div>
        ) : <Empty>Probing stations...</Empty>
      )}
      {config?.keylights.enabled && <KeyLights writes={config.keylights.writes} />}
    </div>
  )
}

function KeyLights({ writes }: { writes: boolean }) {
  const [data, setData] = useState<{ lights: Light[]; down?: boolean } | null>(null)
  useEffect(() => {
    let on = true
    const load = async () => { const r = await getLights(); if (on && r.ok) setData(r.data) }
    load()
    const t = setInterval(load, 30000)
    return () => { on = false; clearInterval(t) }
  }, [])
  const lights = data?.lights || []
  return (
    <Panel title={<span>Key lights</span>} chips={!writes ? <span className="chip chip--amber">controls off · read-only</span> : undefined}>
      {!data ? <Empty>Asking the light panel...</Empty>
        : data.down && !lights.length ? <Empty>The key light panel did not report any lights.</Empty>
          : (
            <div className="lights">
              {lights.map((l, i) => (
                <div key={i} className="light">
                  <span className={`led ${l.on ? 'led--live' : ''}`} />
                  <span className="light__n">{String(l.name || l.ip || `Light ${i + 1}`)}</span>
                  <span className="mono light__v">{l.on ? 'on' : 'off'} · {l.brightness ?? '-'}% · {l.temperature ? `${Math.round(1e6 / Number(l.temperature))}K` : '-'}</span>
                  <button type="button" className="ctl" disabled={!writes} title={writes ? '' : 'Disabled: read-only'}>{l.on ? 'Turn off' : 'Turn on'}</button>
                </div>
              ))}
            </div>
          )}
    </Panel>
  )
}
