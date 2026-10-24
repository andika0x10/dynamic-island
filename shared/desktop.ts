import type { ActivitySnapshot, CommandResult, DesktopCommand } from './contracts/activity.ts'

export type BatterySnapshot = {
  availability: 'available' | 'absent' | 'unavailable'
  percentage: number | null
  source: 'ac' | 'battery' | 'unknown'
  charging: 'charging' | 'full' | 'discharging' | 'unknown'
}

export interface DesktopAPI {
  setClickThrough(ignore: boolean): void
  getActivity(): Promise<ActivitySnapshot>
  onActivity(callback: (snapshot: ActivitySnapshot) => void): () => void
  command(command: DesktopCommand): Promise<CommandResult>
}
