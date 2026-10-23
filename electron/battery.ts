import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { BatterySnapshot } from '../shared/desktop.ts'

export function unavailable(source: BatterySnapshot['source'] = 'unknown'): BatterySnapshot {
  return { availability: 'unavailable', percentage: null, source, charging: 'unknown' }
}

export function normalizeBattery(json: string, onBattery: boolean): BatterySnapshot {
  const source = onBattery ? 'battery' : 'ac'
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Expected battery array')
  if (parsed.length === 0) return { availability: 'absent', percentage: null, source, charging: 'unknown' }
  const rows = parsed as Array<{ EstimatedChargeRemaining?: unknown; BatteryStatus?: unknown }>
  if (rows.some(row => !row || typeof row !== 'object')) throw new Error('Invalid battery row')
  const levels = rows.map(row => row.EstimatedChargeRemaining).filter(
    (level): level is number => typeof level === 'number' && Number.isFinite(level) && level >= 0 && level <= 100,
  )
  const percentage = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null
  const statuses = rows.map(row => row.BatteryStatus)
  let charging: BatterySnapshot['charging'] = 'unknown'
  if (onBattery) charging = 'discharging'
  else if (statuses.some(status => typeof status === 'number' && [6, 7, 8, 9].includes(status))) charging = 'charging'
  else if (statuses.every(status => status === 3)) charging = 'full'
  return { availability: 'available', percentage, source, charging }
}

type Runner = (callback: (error: Error | null, stdout: string) => void) => void

export function queryBattery(onBattery: boolean, runner: Runner = runPowerShell): Promise<BatterySnapshot> {
  return new Promise(resolve => {
    runner((error, stdout) => {
      if (error) return resolve(unavailable(onBattery ? 'battery' : 'ac'))
      try { resolve(normalizeBattery(stdout.replace(/^\uFEFF/, '').trim(), onBattery)) }
      catch { resolve(unavailable(onBattery ? 'battery' : 'ac')) }
    })
  })
}

function runPowerShell(callback: (error: Error | null, stdout: string) => void) {
  const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const command = '$ErrorActionPreference = "Stop"; $b = @(Get-CimInstance -ClassName Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus); ConvertTo-Json -InputObject $b -Compress'
  execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
    { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024, encoding: 'utf8' }, callback)
}
