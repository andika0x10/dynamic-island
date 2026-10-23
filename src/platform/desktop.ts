import { useSyncExternalStore } from 'react'
import { initialActivity, type ActivitySnapshot, type DesktopCommand } from '../../shared/contracts/activity.ts'

const desktop = window.desktop
let snapshot: ActivitySnapshot = { ...initialActivity, bridge: 'unavailable' }
const listeners = new Set<() => void>()
let stop: (() => void) | undefined
let generation = 0
function publish(value: ActivitySnapshot) { snapshot = value; listeners.forEach(listener => listener()) }
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (desktop && !stop) {
    const current = ++generation
    let received = false
    stop = desktop.onActivity(value => { received = true; publish(value) })
    void desktop.getActivity().then(value => { if (current === generation && !received) publish(value) }).catch(() => {})
  }
  return () => { listeners.delete(listener); if (!listeners.size) { generation++; stop?.(); stop = undefined } }
}
export const isDesktop = !!desktop
export const useActivity = () => useSyncExternalStore(subscribe, () => snapshot)
export async function sendCommand(command: DesktopCommand) {
  if (!desktop) return { ok: false, error: 'Buka aplikasi desktop untuk menggunakan fitur ini.' }
  try { return await desktop.command(command) }
  catch { return { ok: false, error: 'Aplikasi tidak merespons. Coba lagi.' } }
}
