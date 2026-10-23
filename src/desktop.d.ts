import type { DesktopAPI } from '../shared/desktop.ts'
declare global {
  interface Window { desktop?: DesktopAPI }
}
