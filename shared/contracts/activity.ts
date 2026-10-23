import type { BatterySnapshot } from '../desktop.ts'

export type Availability = 'available' | 'unavailable'
export type MediaSnapshot = {
  availability: Availability
  title: string
  artist: string
  artwork: string | null
  playing: boolean
  position: number
  duration: number
  updatedAt: number
  controls: { play: boolean; pause: boolean; previous: boolean; next: boolean; seek: boolean }
}
export type AudioSnapshot = { availability: Availability; volume: number; muted: boolean; device: string }
export type NotificationSnapshot = { id: string; app: string; title: string; body: string; receivedAt: number }
export type NotificationAccess = 'unknown' | 'allowed' | 'denied' | 'requires-package' | 'unavailable'
export type TimerSnapshot = { status: 'idle' | 'running' | 'paused' | 'finished'; duration: number; remaining: number; deadline: number | null }
export type Preferences = { media: boolean; volume: boolean; notifications: boolean; sound: boolean }
export type ActivitySnapshot = {
  battery: BatterySnapshot
  media: MediaSnapshot
  audio: AudioSnapshot
  timer: TimerSnapshot
  notification: NotificationSnapshot | null
  notificationAccess: NotificationAccess
  preferences: Preferences
  bridge: 'starting' | 'ready' | 'unavailable'
}
export type DesktopCommand =
  | { type: 'media'; action: 'play' | 'pause' | 'previous' | 'next' }
  | { type: 'seek'; position: number }
  | { type: 'volume'; volume: number }
  | { type: 'mute'; muted: boolean }
  | { type: 'timer-start'; seconds: number }
  | { type: 'timer-pause' | 'timer-resume' | 'timer-cancel' }
  | { type: 'notification-access' | 'notification-dismiss' }
  | { type: 'preferences'; value: Partial<Preferences> }

export type CommandResult = { ok: boolean; error?: string }
export const emptyMedia: MediaSnapshot = {
  availability: 'unavailable', title: '', artist: '', artwork: null, playing: false,
  position: 0, duration: 0, updatedAt: 0,
  controls: { play: false, pause: false, previous: false, next: false, seek: false },
}
export const emptyAudio: AudioSnapshot = { availability: 'unavailable', volume: 0, muted: false, device: '' }
export const emptyTimer: TimerSnapshot = { status: 'idle', duration: 0, remaining: 0, deadline: null }
export const defaultPreferences: Preferences = { media: true, volume: true, notifications: false, sound: true }
export const initialActivity: ActivitySnapshot = {
  battery: { availability: 'unavailable', percentage: null, source: 'unknown', charging: 'unknown' },
  media: emptyMedia, audio: emptyAudio, timer: emptyTimer, notification: null,
  notificationAccess: 'unknown', preferences: defaultPreferences, bridge: 'starting',
}

export function isDesktopCommand(value: unknown): value is DesktopCommand {
  if (!value || typeof value !== 'object') return false
  const command = value as Record<string, unknown>
  const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
  switch (command.type) {
    case 'media': return ['play', 'pause', 'previous', 'next'].includes(String(command.action))
    case 'seek': return finite(command.position, 0, 604800)
    case 'volume': return finite(command.volume, 0, 1)
    case 'mute': return typeof command.muted === 'boolean'
    case 'timer-start': return finite(command.seconds, 1, 86400) && Number.isInteger(command.seconds)
    case 'preferences': return !!command.value && typeof command.value === 'object' && !Array.isArray(command.value)
      && Object.entries(command.value).every(([key, item]) => ['media', 'volume', 'notifications', 'sound'].includes(key) && typeof item === 'boolean')
    case 'timer-pause': case 'timer-resume': case 'timer-cancel':
    case 'notification-access': case 'notification-dismiss': return true
    default: return false
  }
}
