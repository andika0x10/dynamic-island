import type { BatterySnapshot } from '../../../shared/desktop.ts'
export const batteryLevel = (battery: BatterySnapshot) => battery.percentage === null ? '—' : `${battery.percentage}%`
