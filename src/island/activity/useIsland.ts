import { useEffect, useRef, useState } from 'react'
import type { ActivitySnapshot } from '../../../shared/contracts/activity.ts'
import { useNow } from '../../shared/hooks/useNow.ts'
import { selectActivities, type ActivityKind, type Transient } from './select.ts'

export function useIsland(snapshot: ActivitySnapshot) {
  const [pinned, setPinned] = useState<ActivityKind | null>(null)
  const [transient, setTransient] = useState<Transient>(null)
  const previous = useRef(snapshot)
  const now = useNow()
  useEffect(() => {
    const before = previous.current
    previous.current = snapshot
    let notice: Transient = null
    if (before.battery.source !== 'unknown' && snapshot.battery.source !== 'unknown' && before.battery.source !== snapshot.battery.source) notice = { kind: 'battery', until: Date.now() + 4000 }
    if (snapshot.preferences.volume && before.audio.availability === 'available' && snapshot.audio.availability === 'available'
      && (Math.abs(before.audio.volume - snapshot.audio.volume) > .001 || before.audio.muted !== snapshot.audio.muted)) notice = { kind: 'volume', until: Date.now() + 3000 }
    if (snapshot.preferences.notifications && snapshot.notification && before.notification?.id !== snapshot.notification.id) notice = { kind: 'notification', until: Date.now() + 6000 }
    if (before.timer.status !== 'finished' && snapshot.timer.status === 'finished') notice = { kind: 'timer', until: Date.now() + 10000 }
    if (notice) setTransient(notice)
    if (pinned === 'media' && (!snapshot.preferences.media || snapshot.media.availability !== 'available')) setPinned(null)
    if (pinned === 'volume' && !snapshot.preferences.volume) setPinned(null)
    if (!snapshot.notification && transient?.kind === 'notification') setTransient(null)
  }, [snapshot, pinned, transient?.kind])
  const close = () => { setPinned(null); setTransient(null) }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPinned(null); setTransient(null) } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  return { ...selectActivities(snapshot, pinned, transient, now), open: setPinned, close }
}
