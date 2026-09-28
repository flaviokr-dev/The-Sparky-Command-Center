import { useEffect, useRef, useState } from 'react'
import { useDash } from '../lib/store'

// Ask <name>: a slide-out console that streams from /api/chat. The server grounds every turn on the live
// board (nodes, switch, models, lanes, tokens) and proxies to whatever OpenAI-compatible endpoint is in
// config: a local model, or an agent that speaks the same API. History stays in this browser only.

interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean; model?: string; fallback?: boolean }
const K_HIST = 'acc2.chat.v1'
const load = (): Msg[] => { try { return JSON.parse(localStorage.getItem(K_HIST) || '[]') } catch { return [] } }
const save = (m: Msg[]) => { try { localStorage.setItem(K_HIST, JSON.stringify(m.slice(-40))) } catch { /* private mode */ } }

export function Chat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, chat, reloadChat } = useDash()
  const name = config?.chat.name || 'Jarvis'
  const [msgs, setMsgs] = useState<Msg[]>(load)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [checking, setChecking] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 350) }, [open])
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }) }, [msgs, open, status])
  useEffect(() => { if (!busy) save(msgs) }, [msgs, busy])
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])

  const configured = !!chat?.configured
  const reachable = !!chat?.reachable

  const send = async (q: string) => {
    q = q.trim()
    if (!q || busy) return
    const history = [...msgs.filter(m => !m.error), { role: 'user' as const, content: q }]
    setMsgs([...msgs, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setText(''); setBusy(true); setStatus('connecting')
    const ctl = new AbortController()
    abort.current = ctl
    const patch = (fn: (m: Msg) => Msg) => setMsgs(prev => { const n = [...prev]; n[n.length - 1] = fn(n[n.length - 1]); return n })
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }), signal: ctl.signal })
      if (!r.ok || !r.body) {
        let err = `HTTP ${r.status}`
        try { const j = await r.json(); err = j.error || err } catch { /* not json */ }
        patch(m => ({ ...m, content: err, error: true }))
        reloadChat(true)
        return
      }
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      setStatus('thinking')
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const line = buf.slice(0, i).trim()
          buf = buf.slice(i + 2)
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') continue
          let ev: { delta?: string; status?: string; reset?: boolean; error?: string; meta?: { model: string; fallback: boolean } }
          try { ev = JSON.parse(payload) } catch { continue }
          if (ev.meta) patch(m => ({ ...m, model: ev.meta!.model, fallback: ev.meta!.fallback }))
          if (ev.status) setStatus(ev.status)
          if (ev.reset) patch(m => ({ ...m, content: '' }))
          if (ev.error) patch(m => ({ ...m, error: true }))
          if (ev.delta) { setStatus(''); patch(m => ({ ...m, content: m.content + ev.delta })) }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') patch(m => ({ ...m, content: (m.content || '') + (m.content ? '\n\n' : '') + '[stopped]' }))
      else patch(m => ({ ...m, content: `The request failed: ${(e as Error).message}`, error: true }))
    } finally {
      setBusy(false); setStatus(''); abort.current = null
    }
  }

  const retry = async () => { setChecking(true); await reloadChat(true); setChecking(false) }
  const sugs = config?.chat.suggestions?.length ? config.chat.suggestions : ['What is down right now?']

  return (
    <>
      <div className={`chat__scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`chat ${open ? 'is-open' : ''}`} aria-label={`Ask ${name}`} aria-hidden={!open} data-lenis-prevent="">
        <header className="chat__bar">
          <span className="term__dots" aria-hidden><i /><i /><i /></span>
          <span className="mono chat__title">ask {name.toLowerCase()}{chat?.active_model ? ` · ${chat.active_model}` : ''}</span>
          {msgs.length > 0 && !busy && <button type="button" className="chat__clear mono" onClick={() => { setMsgs([]); save([]) }} title="Clear this conversation (it only lives in this browser)">Clear</button>}
          <button type="button" className="chat__close mono" onClick={onClose} aria-label="Close">ESC ✕</button>
        </header>
        <div className={`chat__conn mono ${reachable ? 'is-ok' : configured ? 'is-warn' : 'is-off'}`}>
          <span className={`led ${reachable ? 'led--live' : configured ? 'led--warn' : ''}`} />
          <span className="chat__conn-t">{!chat ? 'checking the model...' : !chat.enabled ? 'chat is disabled in config' : !configured ? 'no model connected' : reachable ? `connected · ${chat.active_model}${chat.fallback ? ' (fallback)' : ''} · grounded on the live board` : 'model not reachable right now'}</span>
          {chat && configured && !reachable && <button type="button" className="chat__retry" onClick={retry} disabled={checking}>{checking ? 'checking' : 'Retry'}</button>}
        </div>
        <div className="chat__log" ref={log}>
          {chat && !configured ? <Connect name={name} onRetry={retry} checking={checking} /> : (
            <>
              {!msgs.length && (
                <div className="chat__hello">
                  <p className="mono core">{name} online.</p>
                  <p>I read the same live data as this board: every node, the switch, the model servers, the render lanes and the token counts. Ask what is down, what is hot, or how fast a model is running. I can look, not touch: this board is read-only.</p>
                  <div className="chat__sugs">
                    {sugs.map(s => <button key={s} type="button" className="chip" onClick={() => send(s)} disabled={busy}>{s}</button>)}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => {
                const streaming = busy && i === msgs.length - 1
                return (
                  <div key={i} className={`chat__msg chat__msg--${m.role} ${m.error ? 'is-error' : ''}`}>
                    <span className="mono chat__who">{m.role === 'user' ? 'you' : name.toLowerCase()}{m.role === 'assistant' && m.model ? <span className="chat__model"> · {m.model}{m.fallback ? ' (fallback)' : ''}</span> : null}</span>
                    <p>{m.content || (streaming ? <span className="term__cursor" /> : '')}</p>
                    {streaming && status && <span className="mono chat__status">{status}</span>}
                  </div>
                )
              })}
            </>
          )}
        </div>
        <form className="chat__form" onSubmit={(e) => { e.preventDefault(); send(text) }}>
          <span className="mono core" aria-hidden>&gt;</span>
          <textarea ref={input} rows={2} value={text} onChange={e => setText(e.target.value)} disabled={!configured}
            placeholder={configured ? `Ask ${name} about the fleet` : 'Connect a model first'}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} aria-label="Message" />
          {busy ? <button type="button" className="chat__send mono" onClick={() => abort.current?.abort()}>Stop</button>
            : <button type="submit" className="chat__send mono" disabled={!text.trim() || !configured}>Send</button>}
        </form>
      </aside>
    </>
  )
}

function Connect({ name, onRetry, checking }: { name: string; onRetry: () => void; checking: boolean }) {
  return (
    <div className="connect">
      <p className="mono amber">Connect a model</p>
      <h4>{name} needs a brain.</h4>
      <p>The rest of the board works without one. To turn on chat, point it at any OpenAI-compatible <code>/v1/chat/completions</code> server, then restart <code>server.py</code>.</p>
      <ol>
        <li>Run a model locally. Any of these work:
          <ul className="mono">
            <li>Ollama: <code>http://localhost:11434/v1</code></li>
            <li>vLLM: <code>http://localhost:8000/v1</code></li>
            <li>llama.cpp server: <code>http://localhost:8080/v1</code></li>
            <li>LM Studio: <code>http://localhost:1234/v1</code></li>
          </ul>
        </li>
        <li>Add it to <code>config.json</code>:
          <pre className="mono">{`"chat": {
  "base_url": "http://localhost:11434/v1",
  "model": "llama3.1:8b"
}`}</pre>
          or set <code>CC_CHAT_BASE_URL</code> and <code>CC_CHAT_MODEL</code> in <code>.env</code>.</li>
        <li>Prefer an agent? Use its OpenAI-compatible URL (for example a Hermes profile's API server) and its key in <code>CC_CHAT_API_KEY</code>.</li>
      </ol>
      <button type="button" className="btn btn--sm" onClick={onRetry} disabled={checking}>{checking ? 'Checking...' : 'Check again'}</button>
    </div>
  )
}
