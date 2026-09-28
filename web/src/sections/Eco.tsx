import { useState } from 'react'
import { useDash } from '../lib/store'
import { getEcoStatus, postJSON } from '../lib/api'
import { Panel } from '../components/Panel'

// GB10 clock caps. "Status" is a read-only nvidia-smi query and always works. "Apply" changes clocks on
// the nodes, so it is switched off unless config allows writes AND the board is not read-only.
export function Eco() {
  const { config } = useDash()
  const eco = config?.eco
  const [node, setNode] = useState('fleet')
  const [level, setLevel] = useState(() => eco?.levels.find(l => l.default)?.value || eco?.levels[0]?.value || '')
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  if (!eco) return null

  const status = async () => {
    setBusy(true); setOut(`reading clocks on ${eco.nodes.length} nodes (takes a few seconds)...`)
    const r = await getEcoStatus()
    setBusy(false)
    if (!r.ok) return setOut(`status failed: ${r.error}`)
    setOut(Object.entries(r.data.status).map(([n, v]) => `${n.toUpperCase()}:  ${v}`).join('\n'))
  }
  const apply = async () => {
    if (!eco.writes) return
    if (node === 'fleet' && !window.confirm(`Apply ${level} to the whole fleet?`)) return
    setBusy(true); setOut(`applying ${level} to ${node}...`)
    const r = await postJSON<{ ok: boolean; error?: string; applied?: string; nodes?: Record<string, string> }>('/api/eco-set', { node, level })
    setBusy(false)
    if (!r.data?.ok) return setOut(`Not applied: ${r.data?.error || `HTTP ${r.status}`}`)
    setOut(`Applied ${r.data.applied}\n` + Object.entries(r.data.nodes || {}).map(([n, v]) => `${n.toUpperCase()}:  ${v || 'ok'}`).join('\n'))
  }
  return (
    <Panel title={<span>Clock caps · {eco.nodes.length} unified nodes</span>} tone={undefined}
      chips={eco.writes ? undefined : <span className="chip chip--amber" title="Actions are off in this preview">Apply is off · read-only</span>}>
      <div className="eco">
        <label className="field"><span className="mono">Node</span>
          <select value={node} onChange={e => setNode(e.target.value)}>
            <option value="fleet">Whole fleet</option>
            {eco.nodes.map(n => <option key={n.key} value={n.key}>{n.name}</option>)}
          </select>
        </label>
        <label className="field"><span className="mono">Level</span>
          <select value={level} onChange={e => setLevel(e.target.value)}>
            {eco.levels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <div className="eco__btns">
          <button type="button" className="btn btn--sm btn--primary" onClick={apply} disabled={!eco.writes || busy}
            title={eco.writes ? 'Set this clock cap' : 'Disabled: this board is read-only'}>Apply</button>
          <button type="button" className="btn btn--sm" onClick={status} disabled={busy}>Status</button>
          {eco.info_url && <a className="eco__why mono" href={eco.info_url} target="_blank" rel="noopener noreferrer">why?</a>}
        </div>
      </div>
      {out && <pre className="eco__out mono">{out}</pre>}
    </Panel>
  )
}
