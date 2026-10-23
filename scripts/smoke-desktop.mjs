import assert from 'node:assert/strict'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright'
import { setTimeout as delay } from 'node:timers/promises'

const env = { ...process.env, ISLAND_PROFILE_DIR: await mkdtemp(join(tmpdir(), 'dynamic-island-native-smoke-')) }
delete env.ELECTRON_RUN_AS_NODE
delete env.VITE_DEV_SERVER_URL
delete env.ISLAND_DISABLE_NATIVE
const packaged = process.argv.includes('--packaged')
const application = await electron.launch({ ...(packaged ? { executablePath: resolve('release/win-unpacked/Dynamic Island.exe'), args: [] } : { args: ['.'] }), env })
try {
  const page = await application.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  async function waitSnapshot(predicate, timeout = 25000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const value = await page.evaluate(() => window.desktop?.getActivity())
      if (value && predicate(value)) return value
      await delay(100)
    }
    throw new Error('Timed out waiting for desktop snapshot')
  }
  const snapshot = await waitSnapshot(value => value.bridge === 'ready' && value.audio.availability === 'available')
  assert.equal(snapshot.audio.availability, 'available')
  assert.equal(snapshot.notificationAccess, 'requires-package')
  assert.equal((await page.evaluate(volume => window.desktop.command({ type: 'volume', volume }), snapshot.audio.volume)).ok, true)
  await page.waitForFunction(() => document.querySelector('[data-island]'))
  await page.keyboard.press('Escape')
  const trigger = page.locator('[aria-controls="island-content"]')
  if (await trigger.getAttribute('aria-expanded') === 'false') await trigger.click()
  await page.waitForFunction(() => Math.abs(document.querySelector('[data-island]').getBoundingClientRect().width - 400) < 1)
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: `test-results/${packaged ? 'packaged' : 'native'}-live.png`, omitBackground: true })
  await page.evaluate(() => window.desktop.command({ type: 'preferences', value: { sound: false } }))
  assert.equal((await page.evaluate(() => window.desktop.command({ type: 'timer-start', seconds: 2 }))).ok, true)
  await waitSnapshot(value => value.timer.status === 'finished', 5000)
  await page.evaluate(() => window.desktop.command({ type: 'timer-cancel' }))
  assert.deepEqual(errors, [])
  console.log('Live desktop smoke passed:', JSON.stringify({ packaged, bridge: snapshot.bridge, audio: snapshot.audio.availability, media: snapshot.media.availability, notifications: snapshot.notificationAccess }))
} finally { await application.close() }
