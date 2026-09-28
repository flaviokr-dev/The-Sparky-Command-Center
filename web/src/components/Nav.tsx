import { useEffect, useState } from 'react'
import { useDash } from '../lib/store'
import { useLayout } from '../lib/layout'
import { scrollToTarget } from '../hooks/useLenis'
import { clock, tzAbbr } from '../lib/format'

const LINKS: { id: string; label: string }[] = [
  { id: 'eco', label: 'Eco' }, { id: 'tokens', label: 'Tokens' }, { id: 'video', label: 'Render' }, { id: 'stations', label: 'Stations' },
]

export function Nav({ onAsk }: { onAsk: () => void }) {
  const { config, metrics, metricsError } = useDash()
  const { collapsed, toggle } = useLayout()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [time, setTime] = useState('')

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    const f = () => setTime(clock(config?.timezone))
    f(); const t = setInterval(f, 1000); return () => clearInterval(t)
  }, [config?.timezone])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])

  const sections = config?.sections.map(s => ({ id: s.key, label: s.eyebrow || s.title })) || []
  const links = [...sections, ...LINKS.filter(l => (l.id === 'eco' && config?.eco.enabled) || (l.id === 'tokens' && config?.tokens.enabled) || (l.id === 'video' && config?.comfy.enabled) || (l.id === 'stations' && (config?.stations.enabled || config?.keylights.enabled)))]
  const go = (id: string) => {
    setOpen(false)
    if (collapsed.has(id)) toggle(id)
    setTimeout(() => scrollToTarget(`#mod-${id}`, -84), 30)
  }
  const down = metrics?.agg.down || []
  const ok = !!metrics && !metricsError && metrics.agg.all_ok
  const short = (config?.title || 'Command Center').replace(/\s*command center$/i, '')
  const chatName = config?.chat.name || 'Jarvis'

  return (
    <>
      <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
        <a href="#top" className="nav__logo" onClick={(e) => { e.preventDefault(); setOpen(false); scrollToTarget('#top', 0) }} aria-label="Top of the page">
          <span className="nav__mark" aria-hidden><i /></span>
          <span className="nav__word">{short.toUpperCase()}<span> CC</span></span>
        </a>
        <nav className="nav__links" aria-label="Sections">
          {links.map(l => <a key={l.id} href={`#mod-${l.id}`} onClick={(e) => { e.preventDefault(); go(l.id) }}>{l.label}</a>)}
        </nav>
        <div className="nav__right">
          <div className={`nav__status mono ${ok ? '' : 'is-attn'}`} title={down.length ? `Down: ${down.join(', ')}` : 'Every unit answered its last poll'}>
            <span className={`led ${!metrics || metricsError ? 'led--warn' : ok ? 'led--live' : 'led--bad'}`} />
            <span className="nav__health">{!metrics ? 'CONNECTING' : metricsError ? 'API ERROR' : ok ? 'ALL OK' : `${down.length} DOWN`}</span>
            <span className="nav__sep">·</span>
            <span className="nav__clock tnum">{time} {tzAbbr(config?.timezone)}</span>
          </div>
          {config?.chat.enabled && (
            <button type="button" className="nav__cta" onClick={onAsk} data-cursor="ask"><span className="nav__cta-dot" aria-hidden /> Ask {chatName}</button>
          )}
          <button type="button" className={`nav__burger ${open ? 'is-open' : ''}`} onClick={() => setOpen(v => !v)} aria-label="Menu" aria-expanded={open}>
            <span /><span />
          </button>
        </div>
      </header>
      <div className={`menu ${open ? 'menu--open' : ''}`} aria-hidden={!open}>
        <div className="menu__links">
          {links.map((l, i) => <a key={l.id} href={`#mod-${l.id}`} style={{ transitionDelay: `${(i + 1) * 40}ms` }} onClick={(e) => { e.preventDefault(); go(l.id) }}>{l.label}</a>)}
          {config?.chat.enabled && <a href="#ask" className="menu__ask" onClick={(e) => { e.preventDefault(); setOpen(false); onAsk() }}>Ask {chatName}</a>}
        </div>
        <div className="menu__foot mono">
          <span className={ok ? 'good' : 'amber'}>● {!metrics ? 'connecting' : ok ? 'all ok' : `${down.length} down`}</span>
          <span>{time} {tzAbbr(config?.timezone)}</span>
        </div>
      </div>
    </>
  )
}
