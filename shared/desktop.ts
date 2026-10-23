export type BatterySnapshot = {
  availability: 'available' | 'absent' | 'unavailable'
  percentage: number | null
  source: 'ac' | 'battery' | 'unknown'
  charging: 'charging' | 'full' | 'discharging' | 'unknown'
}

export interface DesktopAPI {
  getBattery(): Promise<BatterySnapshot>
  onBattery(callback: (snapshot: BatterySnapshot) => void): () => void
  setClickThrough(ignore: boolean): void
}

export const channels = {
  getBattery: 'battery:get',
  batteryChanged: 'battery:changed',
  clickThrough: 'overlay:click-through',
} as const
