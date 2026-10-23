import { app, Menu, nativeImage, Tray } from 'electron'

export function createTray(show: () => void, hide: () => void) {
  const pixels = Buffer.alloc(16 * 16 * 4)
  for (let y = 4; y < 12; y++) for (let x = 1; x < 15; x++) {
    if ((x === 1 || x === 14) && (y === 4 || y === 11)) continue
    const offset = (y * 16 + x) * 4
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = pixels[offset + 3] = 255
  }
  const tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }))
  tray.setToolTip('Dynamic Island')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Tampilkan', click: show }, { label: 'Sembunyikan', click: hide },
    { type: 'separator' }, { label: 'Keluar', click: () => app.quit() },
  ]))
  tray.on('double-click', show)
  return tray
}
