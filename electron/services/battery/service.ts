import { powerMonitor } from 'electron'
import type { BatterySnapshot } from '../../../shared/desktop.ts'
import { queryBattery } from '../../battery.ts'

export function startBatteryService(receive: (value: BatterySnapshot) => void) {
  let querying = false, again = false, stopped = false
  async function refresh() {
    if (stopped) return
    if (querying) { again = true; return }
    querying = true
    try { const value = await queryBattery(powerMonitor.isOnBatteryPower()); if (!stopped) receive(value) }
    finally { querying = false; if (again) { again = false; void refresh() } }
  }
  powerMonitor.on('on-ac', refresh)
  powerMonitor.on('on-battery', refresh)
  powerMonitor.on('resume', refresh)
  const interval = setInterval(refresh, 30000)
  void refresh()
  return () => {
    stopped = true
    clearInterval(interval)
    powerMonitor.removeListener('on-ac', refresh)
    powerMonitor.removeListener('on-battery', refresh)
    powerMonitor.removeListener('resume', refresh)
  }
}
