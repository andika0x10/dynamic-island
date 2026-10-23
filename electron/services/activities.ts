import { EventEmitter } from 'node:events'
import { initialActivity, type ActivitySnapshot, type CommandResult, type DesktopCommand } from '../../shared/contracts/activity.ts'
import type { BatterySnapshot } from '../../shared/desktop.ts'
import { SettingsStore } from '../settings/store.ts'
import { advanceTimer, transitionTimer } from './timer/state.ts'
import { disconnected, NativeClient } from './native-helper/client.ts'

export class ActivityService extends EventEmitter {
  snapshot: ActivitySnapshot
  private store: SettingsStore
  private native: NativeClient
  private clock: ReturnType<typeof setInterval> | undefined
  private nativeReady = false
  private dismissed = new Set<string>()
  constructor(directory: string, executable: string) {
    super()
    this.store = new SettingsStore(directory)
    this.snapshot = { ...initialActivity, ...this.store.load() }
    this.native = new NativeClient(executable, next => {
      this.snapshot = { ...this.snapshot, ...(next ?? disconnected), bridge: next ? 'ready' : 'unavailable' }
      if (this.snapshot.notification && this.dismissed.has(this.snapshot.notification.id)) this.snapshot.notification = null
      if (next && !this.nativeReady) {
        this.nativeReady = true
        void this.native.command({ type: 'preferences', value: this.snapshot.preferences })
      }
      if (!next) this.nativeReady = false
      this.publish()
    })
  }
  start() {
    this.native.start()
    this.clock = setInterval(() => {
      const timer = advanceTimer(this.snapshot.timer, Date.now())
      if (timer !== this.snapshot.timer) {
        this.snapshot = { ...this.snapshot, timer }
        if (timer.status === 'finished') this.persist()
        this.publish()
      }
    }, 250)
  }
  setBattery(battery: BatterySnapshot) { this.snapshot = { ...this.snapshot, battery }; this.publish() }
  private publish() { this.emit('change', this.snapshot) }
  private persist(): CommandResult {
    try { this.store.save(this.snapshot.preferences, this.snapshot.timer); return { ok: true } }
    catch { return { ok: false, error: 'Pengaturan tidak dapat disimpan. Periksa akses folder aplikasi.' } }
  }
  async command(command: DesktopCommand): Promise<CommandResult> {
    if (command.type.startsWith('timer-')) {
      const action = command.type.slice(6) as 'start' | 'pause' | 'resume' | 'cancel'
      this.snapshot = { ...this.snapshot, timer: transitionTimer(this.snapshot.timer, action, Date.now(), command.type === 'timer-start' ? command.seconds : 0) }
      const result = this.persist(); this.publish(); return result
    }
    if (command.type === 'preferences') {
      this.snapshot = { ...this.snapshot, preferences: { ...this.snapshot.preferences, ...command.value } }
      if (!this.snapshot.preferences.notifications) this.snapshot.notification = null
      const result = this.persist()
      void this.native.command({ type: 'preferences', value: this.snapshot.preferences })
      this.publish(); return result
    }
    if (command.type === 'notification-dismiss') {
      if (this.snapshot.notification) this.dismissed.add(this.snapshot.notification.id)
      if (this.dismissed.size > 200) this.dismissed.delete(this.dismissed.values().next().value!)
      this.snapshot = { ...this.snapshot, notification: null }; this.publish(); return { ok: true }
    }
    return this.native.command(command)
  }
  stop() { clearInterval(this.clock); this.native.stop(); this.persist(); this.removeAllListeners() }
}
