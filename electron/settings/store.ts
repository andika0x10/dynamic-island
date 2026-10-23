import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { defaultPreferences, type Preferences, type TimerSnapshot } from '../../shared/contracts/activity.ts'
import { restoreTimer } from '../services/timer/state.ts'

export class SettingsStore {
  private directory: string
  private file: string
  constructor(directory: string) { this.directory = directory; this.file = join(directory, 'settings.json') }
  load() {
    let value: { preferences?: Partial<Preferences>; timer?: unknown } = {}
    try { value = JSON.parse(readFileSync(this.file, 'utf8')) ?? {} } catch { /* first launch or invalid file */ }
    const preferences = { ...defaultPreferences }
    for (const key of Object.keys(preferences) as Array<keyof Preferences>) {
      if (typeof value.preferences?.[key] === 'boolean') preferences[key] = value.preferences[key]
    }
    return { preferences, timer: restoreTimer(value.timer, Date.now()) }
  }
  save(preferences: Preferences, timer: TimerSnapshot) {
    mkdirSync(this.directory, { recursive: true })
    writeFileSync(`${this.file}.tmp`, JSON.stringify({ preferences, timer }), 'utf8')
    renameSync(`${this.file}.tmp`, this.file)
  }
}
