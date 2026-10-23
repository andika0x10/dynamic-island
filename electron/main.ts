import { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray } from 'electron'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { channels } from '../shared/desktop.ts'
import { queryBattery, unavailable } from './battery.ts'

const directory = dirname(fileURLToPath(import.meta.url))
const devURL = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined
let window: BrowserWindow | null = null
let tray: Tray | null = null
let snapshot = unavailable()
let querying = false
let refreshAgain = false
let timer: ReturnType<typeof setInterval> | undefined
let ignoringMouse = true

function positionWindow() {
  if (!window) return
  const area = screen.getPrimaryDisplay().workArea
  const width = Math.min(420, area.width)
  const height = Math.min(220, Math.max(1, area.height - 12))
  window.setBounds({ x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.min(12, area.height - height), width, height })
}

async function refreshBattery() {
  if (querying) { refreshAgain = true; return }
  querying = true
  try {
    snapshot = await queryBattery(powerMonitor.isOnBatteryPower())
    if (window && !window.isDestroyed()) window.webContents.send(channels.batteryChanged, snapshot)
  } finally {
    querying = false
    if (refreshAgain) { refreshAgain = false; void refreshBattery() }
  }
}

function trusted(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  return !!window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame
}

function showOverlay() {
  window?.showInactive()
  ignoringMouse = true
  window?.setIgnoreMouseEvents(true, { forward: true })
}

async function createWindow() {
  window = new BrowserWindow({
    width: 420, height: 220, frame: false, transparent: true, backgroundColor: '#00000000',
    alwaysOnTop: true, skipTaskbar: true, resizable: false, maximizable: false, minimizable: false,
    hasShadow: false, show: false, autoHideMenuBar: true,
    webPreferences: { preload: join(directory, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  positionWindow()
  window.setIgnoreMouseEvents(true, { forward: true })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.webContents.session.setPermissionCheckHandler(() => false)
  window.once('ready-to-show', showOverlay)
  window.on('closed', () => { window = null })
  if (devURL) {
    if (devURL !== 'http://127.0.0.1:5173') throw new Error('Unexpected dev server URL')
    await window.loadURL(devURL)
  } else await window.loadFile(join(directory, '../dist/index.html'))
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', showOverlay)
  app.whenReady().then(async () => {
    ipcMain.handle(channels.getBattery, event => {
      if (!trusted(event)) throw new Error('Unauthorized sender')
      return snapshot
    })
    ipcMain.on(channels.clickThrough, (event, ignore: unknown) => {
      if (trusted(event) && typeof ignore === 'boolean' && ignore !== ignoringMouse) {
        ignoringMouse = ignore
        window?.setIgnoreMouseEvents(ignore, { forward: true })
      }
    })
    await createWindow()
    // An embedded bitmap keeps the tray independent of external asset paths and ASAR.
    const pixels = Buffer.alloc(16 * 16 * 4)
    for (let y = 3; y < 13; y++) for (let x = 1; x < 15; x++) {
      const offset = (y * 16 + x) * 4
      pixels[offset] = 90; pixels[offset + 1] = 225; pixels[offset + 2] = 150; pixels[offset + 3] = 255
    }
    tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }))
    tray.setToolTip('Dynamic Island')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Tampilkan', click: showOverlay },
      { label: 'Sembunyikan', click: () => window?.hide() },
      { type: 'separator' },
      { label: 'Keluar', click: () => app.quit() },
    ]))
    tray.on('double-click', showOverlay)
    screen.on('display-added', positionWindow)
    screen.on('display-removed', positionWindow)
    screen.on('display-metrics-changed', positionWindow)
    powerMonitor.on('on-ac', refreshBattery)
    powerMonitor.on('on-battery', refreshBattery)
    powerMonitor.on('resume', refreshBattery)
    timer = setInterval(refreshBattery, 30_000)
    void refreshBattery()
  }).catch(error => { console.error(error); app.exit(1) })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => { if (timer) clearInterval(timer); tray?.destroy() })
}
