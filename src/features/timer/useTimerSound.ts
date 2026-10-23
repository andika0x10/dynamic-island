import { useEffect, useRef } from 'react'
import type { TimerSnapshot } from '../../../shared/contracts/activity.ts'
export function useTimerSound(timer: TimerSnapshot, enabled: boolean) {
  const previous = useRef(timer.status)
  useEffect(() => {
    const finished = previous.current !== 'finished' && timer.status === 'finished'
    previous.current = timer.status
    if (!finished || !enabled) return
    const context = new AudioContext()
    void context.resume().then(() => {
      for (let i = 0; i < 3; i++) {
        const oscillator = context.createOscillator(), gain = context.createGain()
        oscillator.frequency.value = 880
        const start = context.currentTime + i * .25
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(.12, start + .015)
        gain.gain.exponentialRampToValueAtTime(.001, start + .18)
        oscillator.connect(gain); gain.connect(context.destination)
        oscillator.start(start); oscillator.stop(start + .2)
      }
    }).catch(() => {})
    const timeout = setTimeout(() => { void context.close() }, 1500)
    return () => { clearTimeout(timeout); void context.close() }
  }, [timer.status, enabled])
}
