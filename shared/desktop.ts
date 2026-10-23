import type { ActivitySnapshot, CommandResult, DesktopCommand } from './contracts/activity.ts'

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
  getActivity(): Promise<ActivitySnapshot>
  onActivity(callback: (snapshot: ActivitySnapshot) => void): () => void
  command(command: DesktopCommand): Promise<CommandResult>
}

export const channels = {
  getBattery: 'battery:get',
  batteryChanged: 'battery:changed',
  clickThrough: 'overlay:click-through',
  getActivity: 'activity:get',
  activityChanged: 'activity:changed',
  command: 'activity:command',
} as const
