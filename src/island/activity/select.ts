import type { ActivitySnapshot } from '../../../shared/contracts/activity.ts'
export type ActivityKind = 'battery' | 'media' | 'timer' | 'volume' | 'notification'
export type Transient = { kind: ActivityKind; until: number } | null
export function activeKinds(snapshot: ActivitySnapshot): ActivityKind[] {
  const kinds: ActivityKind[] = []
  if (snapshot.timer.status === 'finished') kinds.push('timer')
  if (snapshot.preferences.media && snapshot.media.availability === 'available') kinds.push('media')
  if (snapshot.timer.status === 'running' || snapshot.timer.status === 'paused') kinds.push('timer')
  if (!kinds.length) kinds.push('battery')
  return kinds
}
export function selectActivities(snapshot: ActivitySnapshot, pinned: ActivityKind | null, transient: Transient, now: number) {
  const active = activeKinds(snapshot)
  const notice = transient && transient.until > now ? transient.kind : null
  const primary = pinned ?? (snapshot.timer.status === 'finished' ? 'timer' : notice ?? active[0])
  return { primary, secondary: active.find(kind => kind !== primary) ?? null, expanded: pinned !== null || notice !== null }
}
