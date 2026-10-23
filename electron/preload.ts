import { contextBridge, ipcRenderer } from 'electron'
import { channels, type BatterySnapshot, type DesktopAPI } from '../shared/desktop.ts'

const api: DesktopAPI = {
  getBattery: () => ipcRenderer.invoke(channels.getBattery),
  onBattery(callback) {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: BatterySnapshot) => callback(snapshot)
    ipcRenderer.on(channels.batteryChanged, listener)
    return () => ipcRenderer.removeListener(channels.batteryChanged, listener)
  },
  setClickThrough: ignore => ipcRenderer.send(channels.clickThrough, ignore),
}
contextBridge.exposeInMainWorld('desktop', api)
