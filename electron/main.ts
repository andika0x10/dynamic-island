import { app, BrowserWindow, screen, type Tray } from 'electron'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ActivityService } from './services/activities.ts'
import { startBatteryService } from './services/battery/service.ts'
import { registerIPC } from './ipc/register.ts'
import { canvas, positionOverlay, secureWindow } from './overlay/window.ts'
import { createTray } from './overlay/tray.ts'

const directory = dirname(fileURLToPath(import.meta.url))
if (process.env.ISLAND_PROFILE_DIR) {
  mkdirSync(process.env.ISLAND_PROFILE_DIR, { recursive: true })
  app.setPath('userData', process.env.ISLAND_PROFILE_DIR)
}
const devURL = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined
let overlay: BrowserWindow | null = null
let tray: Tray | undefined
let activities: ActivityService | undefined
let stopBattery: (() => void) | undefined

async function load(window: BrowserWindow) {
  if (devURL) {
    if (devURL !== 'http://127.0.0.1:5173') throw new Error('Unexpected dev server URL')
    await window.loadURL(`${devURL}/`)
  } else await window.loadFile(join(directory, '../dist/index.html'))
}
function showOverlay() { overlay?.showInactive() }
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
    registerIPC(activities, () => overlay)
    await createOverlay()
    tray = createTray(showOverlay, () => overlay?.hide())
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
