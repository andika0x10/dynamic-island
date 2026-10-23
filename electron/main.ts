import { app, BrowserWindow, screen, type Tray } from 'electron'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { ActivityService } from './services/activities.ts'
import { startBatteryService } from './services/battery/service.ts'
import { registerIPC } from './ipc/register.ts'
import { canvas, positionOverlay, secureWindow } from './overlay/window.ts'
import { createTray } from './overlay/tray.ts'

const directory = dirname(fileURLToPath(import.meta.url))
const devURL = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined
let overlay: BrowserWindow | null = null
let settings: BrowserWindow | null = null
let tray: Tray | undefined
let activities: ActivityService | undefined
let stopBattery: (() => void) | undefined

async function load(window: BrowserWindow, hash = '') {
  if (devURL) {
    if (devURL !== 'http://127.0.0.1:5173') throw new Error('Unexpected dev server URL')
    await window.loadURL(`${devURL}/${hash}`)
  } else await window.loadFile(join(directory, '../dist/index.html'), { hash: hash.replace('#', '') })
}
function showOverlay() { overlay?.showInactive() }
async function openSettings() {
  if (settings && !settings.isDestroyed()) { settings.show(); settings.focus(); return }
  settings = new BrowserWindow({ width: 600, height: 740, minWidth: 440, minHeight: 580,
    title: 'Dynamic Island — Pengaturan', backgroundColor: '#161618', autoHideMenuBar: true, show: false,
    webPreferences: { preload: join(directory, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  secureWindow(settings)
  settings.once('ready-to-show', () => settings?.show())
  settings.on('closed', () => { settings = null })
  await load(settings, '#settings')
}
async function createOverlay() {
  overlay = new BrowserWindow({ ...canvas, frame: false, transparent: true, backgroundColor: '#00000000',
    alwaysOnTop: true, skipTaskbar: true, resizable: false, maximizable: false, minimizable: false,
    hasShadow: false, show: false, autoHideMenuBar: true,
    webPreferences: { preload: join(directory, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  positionOverlay(overlay)
  overlay.setIgnoreMouseEvents(true, { forward: true })
  secureWindow(overlay)
  overlay.once('ready-to-show', showOverlay)
  overlay.on('closed', () => { overlay = null })
  await load(overlay)
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', showOverlay)
  app.whenReady().then(async () => {
    const helper = app.isPackaged ? join(process.resourcesPath, 'native', 'WindowsBridge.exe') : join(directory, '../native/WindowsBridge/bin/publish/WindowsBridge.exe')
    const helperPath = !app.isPackaged && process.env.ISLAND_DISABLE_NATIVE === '1' ? '' : helper
    activities = new ActivityService(app.getPath('userData'), helperPath)
    registerIPC(activities, () => overlay, () => settings, openSettings)
    await createOverlay()
    tray = createTray(showOverlay, () => overlay?.hide(), () => { void openSettings() })
    const position = () => { if (overlay) positionOverlay(overlay) }
    screen.on('display-added', position)
    screen.on('display-removed', position)
    screen.on('display-metrics-changed', position)
    activities.start()
    stopBattery = startBatteryService(value => activities?.setBattery(value))
  }).catch(error => { console.error(error); app.exit(1) })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => { stopBattery?.(); activities?.stop(); tray?.destroy() })
}
