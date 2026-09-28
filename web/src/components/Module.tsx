import type { ReactNode } from 'react'
import { useLayout } from '../lib/layout'

// A board module: numbered eyebrow, display title, meta line, collapse chevron. In rearrange mode it grows
// up/down buttons (works with touch, unlike drag and drop).
export function Module({ id, index, eyebrow, title, subtitle, meta, tone, order, children }: {
  id: string; index: number; eyebrow: string; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode
  tone?: 'amber' | 'violet' | 'good'; order: string[]; children: ReactNode
}) {
  const { collapsed, toggle, rearranging, move } = useLayout()
  const isCollapsed = collapsed.has(id)
  const pos = order.indexOf(id)
  return (
    <section id={`mod-${id}`} className={`mod ${isCollapsed ? 'is-collapsed' : ''} ${rearranging ? 'is-rearranging' : ''}`} data-mod={id}>
      <div className="mod__head">
        <button type="button" className="mod__toggle" onClick={() => toggle(id)} aria-expanded={!isCollapsed} aria-controls={`mod-body-${id}`}>
          <span className={`eyebrow ${tone === 'amber' ? 'eyebrow--ember' : ''} ${tone ? `eyebrow--${tone}` : ''}`}>{String(index + 1).padStart(2, '0')} · {eyebrow}</span>
          <span className="mod__title display-m">{title}</span>
          {subtitle && <span className="mod__sub mono">{subtitle}</span>}
        </button>
        <div className="mod__side">
          {meta && <div className="mod__meta mono">{meta}</div>}
          {rearranging ? (
            <div className="mod__move">
              <button type="button" className="ctl" onClick={() => move(id, -1, order)} disabled={pos <= 0} aria-label="Move up">↑</button>
              <button type="button" className="ctl" onClick={() => move(id, 1, order)} disabled={pos >= order.length - 1} aria-label="Move down">↓</button>
            </div>
          ) : (
            <button type="button" className="mod__chev" onClick={() => toggle(id)} aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}>
              <span aria-hidden>{isCollapsed ? '+' : '−'}</span>
            </button>
          )}
        </div>
      </div>
      {!isCollapsed && <div className="mod__body" id={`mod-body-${id}`}>{children}</div>}
    </section>
  )
}
