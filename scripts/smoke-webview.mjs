import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { setTimeout as delay } from 'node:timers/promises'
import { assertPanelFits } from './lib/panel-layout.mjs'

await mkdir('test-results', { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'island-webview-test-'))
const capture = name => execFileSync('pwsh', ['-NoProfile', '-File', 'scripts/capture-overlay.ps1', '-OutputPath', resolve(`test-results/${name}.png`)], { windowsHide: true })
if (!process.env.CI) capture('webview-desktop-before')
const executable = process.argv.includes('--packaged') ? 'release/webview-unpacked/Dynamic Island.exe' : 'native/WindowsHost/bin/Release/net48/Dynamic Island.exe'
const launch = () => spawn(resolve(executable), [], { windowsHide: true, env: { ...process.env, ISLAND_TEST: '1', ISLAND_PROFILE_DIR: profile, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9331' } })
let child = launch()
let browser
async function connect() {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error(`Host exited ${child.exitCode}`)
    try { return await chromium.connectOverCDP('http://127.0.0.1:9331') } catch { await delay(500) }
  }
  throw new Error('WebView2 debugging endpoint did not start')
}
async function waitExit() {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) { assert.equal(child.exitCode, 0); return }
    await delay(100)
  }
  throw new Error('Host did not shut down cleanly')
}
try {
  browser = await connect()
  const page = browser.contexts()[0].pages()[0]
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.waitForURL('https://island.local/index.html')
  await page.waitForFunction(() => !!window.desktop)
  for (let i = 0; i < 60; i++) {
    if ((await page.evaluate(() => window.desktop.getActivity())).notificationAccess !== 'unknown') break
    await delay(500)
  }
  const snapshot = await page.evaluate(() => window.desktop.getActivity())
  assert.equal(snapshot.bridge, 'ready')
  if (!process.env.CI) assert.equal(snapshot.audio.availability, 'available')
  assert.equal(snapshot.notificationAccess, 'requires-package')
  await page.waitForSelector('[data-island]')
  await page.screenshot({ path: 'test-results/webview-compact.png', omitBackground: true })
  if (!process.env.CI) capture('webview-desktop-after')
  if (!process.env.CI) execFileSync('pwsh', ['-NoProfile', '-File', 'scripts/test-overlay-hit.ps1', '-HostProcessId', String(child.pid)], { windowsHide: true, stdio: 'inherit' })
  const send = command => page.evaluate(value => window.desktop.command(value), command)
  const waitSnapshot = async predicate => {
    for (let i = 0; i < 60; i++) {
      const value = await page.evaluate(() => window.desktop.getActivity())
      if (predicate(value)) return value
      await delay(100)
    }
    throw new Error('Desktop snapshot did not reach the expected state')
  }
  for (const command of [{ type: 'bad' }, { type: 'volume', volume: 5 }, { type: 'timer-start', seconds: 0 }, { type: 'preferences', value: { unknown: true } }]) assert.equal((await send(command)).ok, false)
  if (!process.env.CI) {
    assert.equal((await send({ type: 'volume', volume: snapshot.audio.volume })).ok, true)
    assert.equal((await send({ type: 'mute', muted: snapshot.audio.muted })).ok, true)
  }
  assert.equal((await send({ type: 'preferences', value: { sound: false } })).ok, true)
  assert.equal((await send({ type: 'timer-start', seconds: 60 })).ok, true)
  assert.equal((await send({ type: 'timer-pause' })).ok, true)
  assert.equal((await page.evaluate(() => window.desktop.getActivity())).timer.status, 'paused')
  assert.equal((await send({ type: 'timer-resume' })).ok, true)
  const trigger = page.locator('[aria-controls="island-content"]')
  if (await trigger.getAttribute('aria-expanded') === 'false') await trigger.click()
  await page.waitForFunction(() => Math.abs(document.querySelector('[data-island]').getBoundingClientRect().width - 400) < 1)
  for (const name of ['Baterai', 'Volume', 'Timer']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('heading', { name, exact: true }).waitFor()
    await delay(400)
    await assertPanelFits(page, `WebView2 ${name}`)
  }
  await page.screenshot({ path: 'test-results/webview-expanded.png', omitBackground: true })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[aria-controls="island-content"]').getAttribute('aria-expanded') === 'false')
  assert.equal((await send({ type: 'timer-start', seconds: 1 })).ok, true)
  await waitSnapshot(value => value.timer.status === 'finished')
  assert.equal((await send({ type: 'timer-cancel' })).ok, true)
  await send({ type: 'timer-start', seconds: 30 })
  await send({ type: 'timer-pause' })
  await page.evaluate(() => window.close()).catch(() => {})
  await waitExit()
  await browser.close().catch(() => {})
  const saved = JSON.parse(await readFile(join(profile, 'settings.json'), 'utf8'))
  assert.equal(saved.timer.status, 'paused')
  assert.equal(saved.preferences.sound, false)
  child = launch()
  browser = await connect()
  const restored = browser.contexts()[0].pages()[0]
  await restored.waitForURL('https://island.local/index.html')
  await restored.waitForFunction(() => !!window.desktop)
  assert.equal((await restored.evaluate(() => window.desktop.getActivity())).timer.status, 'paused')
  await restored.evaluate(() => window.desktop.command({ type: 'timer-cancel' }))
  await restored.evaluate(() => window.close()).catch(() => {})
  await waitExit()
  assert.deepEqual(errors, [])
  console.log('WebView2 smoke passed:', JSON.stringify({ audio: snapshot.audio.availability, media: snapshot.media.availability, battery: snapshot.battery.availability }))
} catch (error) {
  let diagnostic = String(error.stack ?? error)
  try { diagnostic += '\n' + await readFile(join(profile, 'startup-error.txt'), 'utf8') } catch { }
  await writeFile('test-results/webview-smoke-error.txt', diagnostic)
  if (process.env.CI) console.error(`::error title=WebView2 smoke::${diagnostic.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`)
  throw error
} finally {
  try { await writeFile('test-results/webview-startup-error.txt', await readFile(join(profile, 'startup-error.txt'))) } catch { }
  await browser?.close().catch(() => {})
  if (child.exitCode === null) child.kill()
}
