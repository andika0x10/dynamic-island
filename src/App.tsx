import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import type { BatterySnapshot } from '../shared/desktop.ts'
import './App.css'

const initial: BatterySnapshot = { availability: 'unavailable', percentage: null, source: 'unknown', charging: 'unknown' }
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
function subscribeReducedMotion(callback: () => void) {
  reducedMotionQuery.addEventListener('change', callback)
  return () => reducedMotionQuery.removeEventListener('change', callback)
}
const getReducedMotion = () => reducedMotionQuery.matches

function BatteryIcon({ level, charging }: { level: number | null; charging: boolean }) {
  return <svg width="29" height="18" viewBox="0 0 29 18" fill="none" aria-hidden="true">
    <rect x="1" y="2" width="23" height="14" rx="4" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
    <path d="M26 6v6" stroke="currentColor" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
    <rect x="3.5" y="4.5" width={18 * ((level ?? 0) / 100)} height="9" rx="2" fill="currentColor" />
    {charging && <path d="m14 1-5 9h4l-1 7 6-10h-4l0-6Z" fill="white" stroke="#080808" strokeWidth="1" />}
  </svg>
}

function App() {
  const [battery, setBattery] = useState(initial)
  const [expansion, setExpansion] = useState<'closed' | 'manual' | 'auto'>('closed')
  const expansionRef = useRef(expansion)
  const lastSource = useRef<BatterySnapshot['source']>('unknown')
  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const expanded = expansion !== 'closed'
  const desktop = window.desktop
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion)

  useEffect(() => { expansionRef.current = expansion }, [expansion])
  useEffect(() => {
    if (!desktop) return
    let active = true
    let receivedUpdate = false
    function receive(next: BatterySnapshot) {
      if (!active) return
      const previous = lastSource.current
      lastSource.current = next.source
      setBattery(next)
      if (previous !== 'unknown' && next.source !== 'unknown' && previous !== next.source && expansionRef.current !== 'manual') {
        clearTimeout(autoTimer.current)
        setExpansion('auto')
        autoTimer.current = setTimeout(() => setExpansion(current => current === 'auto' ? 'closed' : current), 4000)
      }
    }
    const unsubscribe = desktop.onBattery(next => { receivedUpdate = true; receive(next) })
    void desktop.getBattery().then(next => { if (!receivedUpdate) receive(next) }).catch(() => {})
    return () => { active = false; unsubscribe(); clearTimeout(autoTimer.current); desktop.setClickThrough(true) }
  }, [desktop])

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { clearTimeout(autoTimer.current); setExpansion('closed') }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])

  // Forwarded movement arrives over transparent pixels too. Test the clipped
  // pill so its transparent corners also pass clicks through to the desktop.
  useEffect(() => {
    if (!desktop) return
    let pointer: { x: number; y: number } | null = null
    function update() {
      const inside = pointer && !!document.elementFromPoint(pointer.x, pointer.y)?.closest('[data-island]')
      desktop!.setClickThrough(!inside)
    }
    function hitTest(event: PointerEvent) {
      pointer = { x: event.clientX, y: event.clientY }
      update()
    }
    function leave() { pointer = null; desktop!.setClickThrough(true) }
    const observer = new ResizeObserver(update)
    const pill = document.querySelector('[data-island]')
    if (pill) observer.observe(pill)
    window.addEventListener('pointermove', hitTest)
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      observer.disconnect()
      window.removeEventListener('pointermove', hitTest)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
    }
  }, [desktop])

  const charging = battery.charging === 'charging'
  const percentage = battery.percentage === null ? '—' : `${battery.percentage}%`
  const title = !desktop ? 'Preview browser' : battery.availability === 'absent' ? 'Tidak ada baterai' : battery.availability === 'unavailable' ? 'Status tidak tersedia' : 'Baterai'
  const status = !desktop ? 'Integrasi Windows tersedia di Electron' : battery.availability === 'absent' ? 'Perangkat ini tidak memiliki baterai' : battery.availability === 'unavailable' ? 'Pembacaan baterai belum tersedia' : {
    charging: 'Sedang mengisi daya', full: 'Baterai penuh', discharging: 'Menggunakan baterai', unknown: 'Status pengisian tidak diketahui',
  }[battery.charging]
  const source = battery.source === 'ac' ? 'Terhubung listrik' : battery.source === 'battery' ? 'Daya baterai' : 'Sumber daya belum diketahui'

  return <MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>
    <main className="overlay">
      <motion.button
        data-island
        className={`island ${expanded ? 'is-expanded' : ''} ${battery.percentage !== null && battery.percentage <= 20 && !charging ? 'low' : ''}`}
        type="button" aria-expanded={expanded} aria-label={`${title}, ${percentage}. ${expanded ? 'Tutup' : 'Buka'} detail baterai`}
        initial={false}
        animate={{ width: expanded ? 360 : 180, height: expanded ? 150 : 40, borderRadius: expanded ? 32 : 20, clipPath: `inset(0 round ${expanded ? 32 : 20}px)` }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36, mass: 1 }}
        onClick={() => { clearTimeout(autoTimer.current); setExpansion(current => current === 'closed' ? 'manual' : 'closed') }}
        onFocus={() => desktop?.setClickThrough(false)}
      >
        <span className="island-header">
          <span className="battery-icon"><BatteryIcon level={battery.percentage} charging={charging} /></span>
          <span className="compact-label">{expanded ? title : !desktop ? 'Preview' : battery.availability === 'absent' ? 'Tanpa baterai' : 'Baterai'}</span>
          <span className="percentage">{percentage}</span>
        </span>
        <AnimatePresence initial={false}>
          {expanded && <motion.span className="details" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
            <span className="status" aria-live="polite">{status}</span>
            <span className="capacity-track"><motion.span initial={false} animate={{ width: `${battery.percentage ?? 0}%` }} className="capacity-fill" /></span>
            <span className="detail-footer"><span>{source}</span><span className="close-hint">Klik untuk tutup</span></span>
          </motion.span>}
        </AnimatePresence>
      </motion.button>
    </main>
  </MotionConfig>
}

export default App
