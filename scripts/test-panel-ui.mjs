import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { assertPanelFits } from './lib/panel-layout.mjs'

const server = await createServer({ server: { port: 0 } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 460, height: 320 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const snapshot = {
      battery: { availability: 'available', percentage: 86, source: 'battery', charging: 'discharging' },
      media: { availability: 'available', title: 'Music', artist: 'Artist', artwork: null, playing: true, position: 68, duration: 244, updatedAt: Date.now(), controls: { play: true, pause: true, previous: true, next: true, seek: true } },
      audio: { availability: 'available', volume: .42, muted: false, device: 'Speakers' },
      timer: { status: 'idle', duration: 0, remaining: 0, deadline: null },
      preferences: { media: true, volume: true, sound: true }, bridge: 'ready',
    }
    let listener = () => {}
    window.testSnapshot = value => { Object.assign(snapshot, value); listener({ ...snapshot }) }
    window.desktop = {
      getActivity: async () => snapshot, onActivity: callback => { listener = callback; return () => {} }, setClickThrough() {},
      command: async command => {
        if (command.type === 'preferences') Object.assign(snapshot.preferences, command.value)
        listener({ ...snapshot, preferences: { ...snapshot.preferences } })
        return { ok: true }
      },
    }
  })
  await page.goto(server.resolvedUrls.local[0])
  // Sample every animation frame, including temporary overflow while the spring resizes.
  await page.evaluate(() => {
    window.scrollbarFrames = []
    const sample = () => {
      for (const element of document.querySelectorAll('#island-content')) {
        const style = getComputedStyle(element)
        if (style.scrollbarWidth !== 'none') window.scrollbarFrames.push(element.className)
      }
      requestAnimationFrame(sample)
    }
    sample()
  })
  await page.getByRole('button', { name: 'Buka Musik', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Notifikasi', exact: true }).count(), 0)
  await page.evaluate(async () => {
    const snapshot = await window.desktop.getActivity()
    window.testSnapshot({ media: { ...snapshot.media, duration: 0, position: 30, updatedAt: Date.now() } })
  })
  await page.getByRole('status').filter({ hasText: /diputar/ }).waitFor()
  assert.equal(await page.getByRole('slider', { name: 'Posisi pemutaran' }).count(), 0)
  assert.equal(await page.getByText('Durasi tidak tersedia', { exact: true }).count(), 0)
  await assertPanelFits(page, 'Music without total duration')
  await page.evaluate(async () => {
    const snapshot = await window.desktop.getActivity()
    window.testSnapshot({ media: { ...snapshot.media, duration: 244 } })
  })
  await page.getByRole('slider', { name: 'Posisi pemutaran' }).waitFor()
  for (const [name, heading] of [['Timer', 'Timer'], ['Volume', 'Volume'], ['Baterai', 'Baterai'], ['Musik', 'Music']]) {
    await page.getByRole('button', { name, exact: true }).click()
    if (name === 'Timer') await page.getByRole('button', { name: 'Mulai timer', exact: true }).waitFor()
    else await page.getByRole('heading', { name: heading, exact: true }).waitFor()
    await assertPanelFits(page, name)
  }
  assert.deepEqual(await page.evaluate(() => window.scrollbarFrames), [])
  assert.deepEqual(errors, [])
  console.log('Panel UI passed: music, timer, volume, battery, animated panels, and hidden scrollbars.')
} finally {
  await browser?.close()
  await server.close()
}
