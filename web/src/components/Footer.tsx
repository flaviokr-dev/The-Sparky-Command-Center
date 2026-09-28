import { useDash } from '../lib/store'
import { scrollToTarget } from '../hooks/useLenis'

export function Footer() {
  const { config, metrics, chat } = useDash()
  const short = (config?.title || 'Command Center').replace(/\s*command center$/i, '') || 'Command'
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__cols">
          <div>
            <p className="footer__h mono">Board</p>
            {(config?.sections || []).map(s => <a key={s.key} href={`#mod-${s.key}`} onClick={(e) => { e.preventDefault(); scrollToTarget(`#mod-${s.key}`, -84) }}>{s.eyebrow || s.title}</a>)}
          </div>
          <div>
            <p className="footer__h mono">Brain</p>
            <p>{chat?.configured ? chat.active_model || chat.model : 'no model connected'}</p>
            <p className="muted">{chat?.configured ? (chat.reachable ? `OpenAI-compatible · ${chat.endpoints} endpoint${chat.endpoints === 1 ? '' : 's'}` : 'unreachable right now') : 'set chat.base_url in config.json'}</p>
          </div>
          <div>
            <p className="footer__h mono">Fleet</p>
            <p>{metrics ? `${metrics.nodes.filter(n => n.reachable).length} of ${metrics.nodes.length} nodes answering` : '-'}</p>
            {metrics && metrics.agg.down.length > 0 && <p className="amber">down: {metrics.agg.down.join(', ')}</p>}
          </div>
          <div>
            <p className="footer__h mono">Mode</p>
            <p>{config?.read_only ? 'Read-only monitoring' : 'Actions enabled'}</p>
            <p className="muted">polled over SSH + HTTP, never touches live inference</p>
          </div>
        </div>
        <div className="footer__word" aria-hidden><span>{short.toUpperCase()}</span></div>
        <div className="footer__base mono"><span>{config?.title || 'Command Center'} · v{config?.version || '2'}</span><span>{config?.location || 'self-hosted'}</span></div>
      </div>
    </footer>
  )
}
