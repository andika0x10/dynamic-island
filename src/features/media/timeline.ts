import type { MediaSnapshot } from '../../../shared/contracts/activity.ts'

export function mediaTimeline(media: MediaSnapshot, now: number) {
  if (!Number.isFinite(media.duration) || media.duration <= 0) return null
  const elapsed = media.playing && media.updatedAt > 0 && Number.isFinite(media.updatedAt)
    ? Math.max(0, now - media.updatedAt) / 1000 : 0
  const position = Math.min(media.duration, Math.max(0, (Number.isFinite(media.position) ? media.position : 0) + elapsed))
  return { position, duration: media.duration }
}
