import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { emptyAudio, emptyMedia, type AudioSnapshot, type CommandResult, type MediaSnapshot, type NotificationAccess, type NotificationSnapshot } from '../../../shared/contracts/activity.ts'

export type NativeSnapshot = { media: MediaSnapshot; audio: AudioSnapshot; notificationAccess: NotificationAccess; notification: NotificationSnapshot | null }
type Pending = { resolve: (result: CommandResult) => void; timeout: ReturnType<typeof setTimeout> }

export class NativeClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private retries = 0
  private stopped = false
  private serial = 0
  private pending = new Map<number, Pending>()
  private restart: ReturnType<typeof setTimeout> | undefined
  private watchdog: ReturnType<typeof setInterval> | undefined
  private executable: string
  private receive: (snapshot: NativeSnapshot | null) => void
  constructor(executable: string, receive: (snapshot: NativeSnapshot | null) => void) { this.executable = executable; this.receive = receive }
  start() {
    if (this.stopped || !existsSync(this.executable)) { this.receive(null); return }
    const child = spawn(this.executable, [], { windowsHide: true, stdio: 'pipe' })
    this.child = child
    const lines = createInterface({ input: child.stdout })
    let lastMessage = Date.now()
    clearInterval(this.watchdog)
    this.watchdog = setInterval(() => { if (Date.now() - lastMessage > 20000) child.kill() }, 5000)
    child.stderr.resume() // Protocol output only; do not log personal media/notification data.
    child.stdin.on('error', () => {})
    lines.on('line', line => {
      if (line.length > 3_000_000) return
      try {
        const message = JSON.parse(line)
        if (message.type === 'result') {
          const pending = this.pending.get(message.id)
          if (pending) { clearTimeout(pending.timeout); this.pending.delete(message.id); pending.resolve({ ok: message.ok === true, ...(typeof message.error === 'string' ? { error: message.error.slice(0, 200) } : {}) }) }
        } else if (message.type === 'snapshot' && validSnapshot(message)) { lastMessage = Date.now(); this.receive(message) }
      } catch { /* Ignore malformed protocol records. */ }
    })
    let ended = false
    const exit = () => {
      if (ended) return
      ended = true
      clearInterval(this.watchdog)
      lines.close()
      if (this.child === child) this.child = null
      for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.resolve({ ok: false, error: 'Integrasi Windows terputus.' }) }
      this.pending.clear()
      this.receive(null)
      if (!this.stopped && this.retries++ < 3) this.restart = setTimeout(() => this.start(), 1000 * this.retries)
    }
    child.once('error', exit)
    child.once('exit', exit)
  }
  command(value: Record<string, unknown>): Promise<CommandResult> {
    const child = this.child
    if (!child || child.killed || !child.stdin.writable) return Promise.resolve({ ok: false, error: 'Integrasi Windows belum tersedia.' })
    const id = ++this.serial
    return new Promise(resolve => {
      const timeout = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, error: 'Windows tidak merespons. Coba lagi.' }) }, 15000)
      this.pending.set(id, { resolve, timeout })
      child.stdin.write(`${JSON.stringify({ ...value, id })}\n`)
    })
  }
  stop() {
    this.stopped = true
    clearTimeout(this.restart)
    clearInterval(this.watchdog)
    this.child?.kill()
    for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.resolve({ ok: false }) }
    this.pending.clear()
  }
}

export const disconnected: NativeSnapshot = { media: emptyMedia, audio: emptyAudio, notificationAccess: 'unavailable', notification: null }
export function validSnapshot(value: NativeSnapshot): boolean {
  const media = value.media, audio = value.audio
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  return !!media && ['available', 'unavailable'].includes(media.availability)
    && typeof media.title === 'string' && typeof media.artist === 'string'
    && (media.artwork === null || (typeof media.artwork === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(media.artwork) && media.artwork.length < 2_800_000))
    && typeof media.playing === 'boolean' && finite(media.position) && finite(media.duration) && finite(media.updatedAt)
    && !!media.controls && ['play', 'pause', 'previous', 'next', 'seek'].every(key => typeof media.controls[key as keyof MediaSnapshot['controls']] === 'boolean')
    && !!audio && ['available', 'unavailable'].includes(audio.availability) && finite(audio.volume) && audio.volume >= 0 && audio.volume <= 1 && typeof audio.muted === 'boolean' && typeof audio.device === 'string'
    && ['unknown', 'allowed', 'denied', 'requires-package', 'unavailable'].includes(value.notificationAccess)
    && (value.notification === null || (typeof value.notification?.id === 'string' && typeof value.notification.app === 'string' && typeof value.notification.title === 'string' && typeof value.notification.body === 'string' && finite(value.notification.receivedAt)))
}
