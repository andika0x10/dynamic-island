import { BrowserWindow, screen } from 'electron'

export const canvas = { width: 460, height: 320 }
export function positionOverlay(window: BrowserWindow) {
  const area = screen.getPrimaryDisplay().workArea
  const width = Math.min(canvas.width, area.width)
  const height = Math.min(canvas.height, Math.max(1, area.height - 12))
  window.setBounds({ x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.min(12, area.height - height), width, height })
}
export function secureWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.webContents.session.setPermissionCheckHandler(() => false)
}
