import { useDash } from '../lib/store'
import { fmtTok } from '../lib/format'
import type { TokenRow } from '../lib/api'
import { Counter } from '../components/Counter'
import { Empty } from '../components/Panel'

export function Tokens() {
  const { tokens, config } = useDash()
  if (!tokens) return <Empty>Waiting for the token store...</Empty>
  const order = config?.tokens.order || []
  const keys = Object.keys(tokens).filter(k => !k.startsWith('_') && typeof tokens[k] === 'object')
  const sorted = [...order.filter(k => keys.includes(k)), ...keys.filter(k => !order.includes(k))]
  if (!sorted.length) return <Empty>No token data yet (the tracker is warming up)</Empty>
  return (
    <div className="cards cards--4">
      {sorted.map(k => {
        const m = tokens[k] as TokenRow
        const dead = m.reachable === false
        return (
          <div key={k} className="panel card tok">
            <div className="tok__head mono"><span>{m.name || k}</span><span className={dead ? 'bad' : 'good'}>● {dead ? 'offline' : 'live'}</span></div>
            <div className="tok__v tnum"><Counter value={Number(m.total_tokens) || 0} format={fmtTok} /><em>tokens</em></div>
            <div className="tok__split mono"><span>prompt {fmtTok(m.total_prompt)}</span><span>gen {fmtTok(m.total_gen)}</span></div>
            <div className="tok__today mono">today: {fmtTok(m.today_tokens)}</div>
          </div>
        )
      })}
    </div>
  )
}
