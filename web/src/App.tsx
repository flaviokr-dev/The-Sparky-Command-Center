import { useCallback, useEffect, useState } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DashboardProvider, useDash } from './lib/store'
import { LayoutProvider } from './lib/layout'
import { Preloader } from './components/Preloader'
import { Nav } from './components/Nav'
import { Chat } from './components/Chat'
import { Footer } from './components/Footer'
import { Hero, Ticker } from './sections/Hero'
import { Board } from './sections/Board'
import { useLenis } from './hooks/useLenis'
import { useReducedMotion } from './hooks/useMotion'

// The boot log plays once per browser session; later loads go straight to the board.
const BOOTED = 'acc2.booted'
const alreadyBooted = () => { try { return sessionStorage.getItem(BOOTED) === '1' } catch { return false } }

export default function App() {
  return (
    <LayoutProvider>
      <DashboardProvider>
        <Shell />
      </DashboardProvider>
    </LayoutProvider>
  )
}

function Shell() {
  const reduced = useReducedMotion()
  const { config, metrics, metricsError } = useDash()
  const [ready, setReady] = useState(() => alreadyBooted())
  const [settled, setSettled] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  useLenis(!reduced)

  useEffect(() => {
    if (metrics || metricsError) { setSettled(true); return }
    const t = setTimeout(() => setSettled(true), 2500)
    return () => clearTimeout(t)
  }, [metrics, metricsError])
  const onDone = useCallback(() => { setReady(true); try { sessionStorage.setItem(BOOTED, '1') } catch { /* private mode */ } }, [])
  useEffect(() => { if (reduced) setReady(true) }, [reduced])
  useEffect(() => { if (config?.title) document.title = config.title }, [config?.title])
  useEffect(() => {
    const t = setTimeout(() => ScrollTrigger.refresh(), 1200)
    const ro = new ResizeObserver(() => ScrollTrigger.refresh())
    ro.observe(document.body)
    return () => { clearTimeout(t); ro.disconnect() }
  }, [ready])
  const ask = useCallback(() => setChatOpen(true), [])
  const close = useCallback(() => setChatOpen(false), [])

  return (
    <>
      {!ready && settled && <Preloader config={config} metrics={metrics} onDone={onDone} />}
      {!ready && !settled && <div className="preloader" aria-hidden />}
      <Nav onAsk={ask} />
      <main>
        <Hero ready={ready} onAsk={ask} />
        <Ticker />
        <Board />
      </main>
      <Footer />
      {config?.chat.enabled && <Chat open={chatOpen} onClose={close} />}
      <div className="noise" aria-hidden />
    </>
  )
}
