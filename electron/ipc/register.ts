import { BrowserWindow, ipcMain } from 'electron'
import { channels } from '../../shared/desktop.ts'
import { isDesktopCommand } from '../../shared/contracts/activity.ts'
import type { ActivityService } from '../services/activities.ts'

export function registerIPC(service: ActivityService, overlay: () => BrowserWindow | null, settings: () => BrowserWindow | null, openSettings: () => Promise<void>) {
  const trusted = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
    [overlay(), settings()].some(window => window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame)
  ipcMain.handle(channels.getBattery, event => {
    if (!trusted(event)) throw new Error('Unauthorized sender')
    return service.snapshot.battery
  })
  ipcMain.handle(channels.getActivity, event => {
    if (!trusted(event)) throw new Error('Unauthorized sender')
    return service.snapshot
  })
  ipcMain.handle(channels.command, async (event, command: unknown) => {
    if (!trusted(event) || !isDesktopCommand(command)) return { ok: false, error: 'Perintah tidak valid.' }
    try {
      if (command.type === 'open-settings') { await openSettings(); return { ok: true } }
      return await service.command(command)
    } catch { return { ok: false, error: 'Perintah gagal. Coba lagi.' } }
  })
  let ignoring = true
  ipcMain.on(channels.clickThrough, (event, value: unknown) => {
    const window = overlay()
    if (window && trusted(event) && event.sender === window.webContents && typeof value === 'boolean' && value !== ignoring) {
      ignoring = value
      window.setIgnoreMouseEvents(value, { forward: true })
    }
  })
  service.on('change', () => {
    for (const window of [overlay(), settings()]) if (window && !window.isDestroyed()) {
      window.webContents.send(channels.activityChanged, service.snapshot)
      window.webContents.send(channels.batteryChanged, service.snapshot.battery)
    }
  })
}
