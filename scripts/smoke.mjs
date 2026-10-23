import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { _electron as electron } from 'playwright'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electronBinary from 'electron'

const executablePath = process.argv.includes('--packaged') ? resolve('release/win-unpacked/Dynamic Island.exe') : undefined
const electronEnv = { ...process.env }
electronEnv.ISLAND_DISABLE_NATIVE = '1'
delete electronEnv.ELECTRON_RUN_AS_NODE
delete electronEnv.VITE_DEV_SERVER_URL
let server
if (process.argv.includes('--dev')) {
  server = await createServer()
  await server.listen()
  electronEnv.VITE_DEV_SERVER_URL = 'http://127.0.0.1:5173'
}
const application = await electron.launch({
  ...(executablePath ? { executablePath, args: [] } : { args: ['.'] }),
  env: electronEnv, timeout: 30_000,
})
const errors = []
try {
  const page = await application.firstWindow()
  page.on('pageerror', error => errors.push(error.message))
  await page.waitForSelector('[data-island]')
  let snapshot
  const deadline = Date.now() + 15_000
  do {
    snapshot = await page.evaluate(() => window.desktop?.getBattery())
    if (snapshot && snapshot.availability !== 'unavailable') break
    await delay(200)
  } while (Date.now() < deadline)
  assert.ok(['available', 'absent'].includes(snapshot.availability), JSON.stringify(snapshot))
  assert.deepEqual(await page.evaluate(() => Object.keys(window.desktop).sort()), ['command', 'getActivity', 'getBattery', 'onActivity', 'onBattery', 'setClickThrough'])
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
  const config = await application.evaluate(({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return { bounds: win.getBounds(), area: screen.getPrimaryDisplay().workArea, top: win.isAlwaysOnTop(), prefs: win.webContents.getLastWebPreferences() }
  })
  assert.equal(config.top, true)
  assert.equal(config.prefs.sandbox, true)
  assert.equal(config.prefs.contextIsolation, true)
  assert.equal(config.prefs.nodeIntegration, false)
  assert.equal(config.bounds.y, config.area.y + 12)
  assert.equal(config.bounds.width, Math.min(460, config.area.width))
  const trigger = page.getByRole('button', { name: 'Buka Baterai', exact: true })
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/compact.png', omitBackground: true })
  await trigger.click()
  await page.waitForFunction(() => Math.abs(document.querySelector('[data-island]').getBoundingClientRect().height - 200) < 1)
  assert.equal(await page.getByRole('button', { name: 'Tutup Baterai', exact: true }).getAttribute('aria-expanded'), 'true')
  await page.screenshot({ path: 'test-results/expanded.png', omitBackground: true })
  const hitTest = await page.evaluate(() => {
    const pill = document.querySelector('[data-island]')
    const rect = pill.getBoundingClientRect()
    return {
      outside: !!document.elementFromPoint(2, 200)?.closest('[data-island]'),
      corner: !!document.elementFromPoint(rect.x + 1, rect.y + 1)?.closest('[data-island]'),
      inside: !!document.elementFromPoint(rect.x + rect.width / 2, 20)?.closest('[data-island]'),
      background: getComputedStyle(document.documentElement).backgroundColor,
    }
  })
  assert.deepEqual(hitTest, { outside: false, corner: false, inside: true, background: 'rgba(0, 0, 0, 0)' })
  await page.keyboard.press('Escape')
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  assert.equal(await page.getByRole('button', { name: 'Tutup Baterai', exact: true }).getAttribute('aria-expanded'), 'true')
  await page.waitForFunction(() => Math.abs(document.querySelector('[data-island]').getBoundingClientRect().width - 400) < 1)
  // A source change must not close a manually opened detail panel.
  const initial = await page.evaluate(() => window.desktop.getActivity())
  const publish = value => application.evaluate(({ BrowserWindow }, snapshot) => {
    BrowserWindow.getAllWindows()[0].webContents.send('activity:changed', snapshot)
  }, value)
  await publish({ ...initial, battery: { ...snapshot, source: snapshot.source === 'ac' ? 'battery' : 'ac' } })
  await delay(4200)
  assert.equal(await page.getByRole('button', { name: 'Tutup Baterai', exact: true }).getAttribute('aria-expanded'), 'true')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[aria-controls="island-content"]').getAttribute('aria-expanded') === 'false')
  await publish(initial)
  await page.waitForFunction(() => document.querySelector('[aria-controls="island-content"]').getAttribute('aria-expanded') === 'true')
  await page.waitForFunction(() => document.querySelector('[aria-controls="island-content"]').getAttribute('aria-expanded') === 'false', null, { timeout: 6500 })
  if (!executablePath) {
    const media = { ...initial.media, availability: 'available', title: 'Midnight City', artist: 'M83', playing: true, duration: 244, position: 68, updatedAt: Date.now(), controls: { play: true, pause: true, next: true, previous: true, seek: true } }
    await publish({ ...initial, media, timer: { status: 'running', duration: 300, remaining: 280, deadline: Date.now() + 280000 } })
    await page.locator('[data-secondary]').waitFor()
    await page.waitForFunction(() => Math.abs(document.querySelector('[data-island]').getBoundingClientRect().width - 190) < 1)
    await delay(250)
    await page.screenshot({ path: 'test-results/two-activities.png', omitBackground: true })
    await page.getByRole('button', { name: 'Buka Musik', exact: true }).click()
    await page.getByRole('heading', { name: 'Midnight City' }).waitFor()
    await delay(250)
    await page.screenshot({ path: 'test-results/media.png', omitBackground: true })
    await page.getByRole('button', { name: 'Timer', exact: true }).click()
    await page.getByRole('button', { name: 'Jeda', exact: true }).waitFor()
    await delay(250)
    await page.screenshot({ path: 'test-results/timer.png', omitBackground: true })
    await page.keyboard.press('Escape')
    await publish(initial)
  }
  assert.equal((await page.evaluate(() => window.desktop.command({ type: 'volume', volume: 5 }))).ok, false)
  assert.equal((await page.evaluate(() => window.desktop.command({ type: 'timer-start', seconds: 60 }))).ok, true)
  assert.equal((await page.evaluate(() => window.desktop.command({ type: 'timer-pause' }))).ok, true)
  assert.equal((await page.evaluate(() => window.desktop.getActivity())).timer.status, 'paused')
  await page.evaluate(() => window.desktop.command({ type: 'timer-cancel' }))
  const settingsWindow = application.waitForEvent('window')
  await page.evaluate(() => window.desktop.command({ type: 'open-settings' }))
  const settings = await settingsWindow
  await settings.getByRole('heading', { name: 'Dynamic Island', exact: true }).waitFor()
  await settings.screenshot({ path: 'test-results/settings.png' })
  await settings.close()
  await application.evaluate(({ screen }) => screen.emit('display-metrics-changed', {}, screen.getPrimaryDisplay(), ['workArea']))
  await application.evaluate(({ powerMonitor }) => powerMonitor.emit('resume'))
  const popup = await page.evaluate(async () => {
    const win = window.open('https://example.com')
    return win === null
  })
  assert.equal(popup, true)
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide())
  const second = spawn(executablePath ?? electronBinary, executablePath ? [] : ['.'], { env: electronEnv, windowsHide: true, stdio: 'ignore' })
  const secondExit = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { second.kill(); reject(new Error('Second instance did not exit')) }, 5000)
    second.once('exit', code => { clearTimeout(timer); resolve(code) })
    second.once('error', error => { clearTimeout(timer); reject(error) })
  })
  assert.equal(secondExit, 0)
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true)
  assert.deepEqual(errors, [])
  console.log('Electron smoke passed:', JSON.stringify({ packaged: !!executablePath, snapshot, hitTest }))
} finally { await application.close(); await server?.close() }
