import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdir } from 'node:fs/promises'
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
      notification: null, notificationAccess: 'unknown', preferences: { media: true, volume: true, notifications: false, sound: true }, bridge: 'ready',
    }
    let listener = () => {}
    window.testSnapshot = value => { Object.assign(snapshot, value); listener({ ...snapshot }) }
    window.desktop = {
      getActivity: async () => snapshot, onActivity: callback => { listener = callback; return () => {} }, setClickThrough() {},
      command: async command => {
        if (command.type === 'notification-access') snapshot.notificationAccess = 'allowed'
        if (command.type === 'preferences') Object.assign(snapshot.preferences, command.value)
        if (command.type === 'notification-dismiss') snapshot.notification = null
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
      for (const element of document.querySelectorAll('#island-content, [aria-label="Isi notifikasi"]')) {
        const style = getComputedStyle(element)
        if (style.scrollbarWidth !== 'none') window.scrollbarFrames.push(element.className)
      }
      requestAnimationFrame(sample)
    }
    sample()
  })
  await page.getByRole('button', { name: 'Buka Musik', exact: true }).click()
  for (const [name, heading] of [['Timer', 'Timer'], ['Volume', 'Volume'], ['Baterai', 'Baterai'], ['Musik', 'Music'], ['Notifikasi', 'Notifikasi belum aktif']]) {
    await page.getByRole('button', { name, exact: true }).click()
    if (name === 'Timer') await page.getByRole('button', { name: 'Mulai timer', exact: true }).waitFor()
    else await page.getByRole('heading', { name: heading, exact: true }).waitFor()
    await assertPanelFits(page, name)
  }
  await page.getByRole('button', { name: 'Izinkan notifikasi', exact: true }).click()
  await page.getByRole('button', { name: 'Nonaktifkan notifikasi', exact: true }).waitFor()
  assert.equal(await page.evaluate(async () => (await window.desktop.getActivity()).preferences.notifications), true)
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.testSnapshot({ notification: { id: 'new', app: 'Messages', title: 'Pesan baru', body: 'Pesan panjang\n'.repeat(100), receivedAt: Date.now() } }))
  await page.getByRole('heading', { name: 'Pesan baru', exact: true }).waitFor()
  await assertPanelFits(page, 'Long notification')
  const body = page.getByLabel('Isi notifikasi', { exact: true })
  assert.equal(await body.evaluate(element => element.scrollHeight > element.clientHeight), true)
  await body.hover()
  await page.mouse.wheel(0, 180)
  await page.waitForFunction(() => document.querySelector('[aria-label="Isi notifikasi"]').scrollTop > 0)
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/notification-panel.png', omitBackground: true })
  await page.getByRole('button', { name: 'Tutup tampilan', exact: true }).click()
  await page.getByRole('button', { name: 'Buka Musik', exact: true }).click()
  await page.getByRole('button', { name: 'Notifikasi', exact: true }).click()
  await page.getByRole('button', { name: 'Nonaktifkan notifikasi', exact: true }).click()
  await page.getByRole('button', { name: 'Aktifkan notifikasi', exact: true }).waitFor()
  await page.evaluate(() => window.testSnapshot({ notificationAccess: 'requires-package' }))
  await page.getByText('Notifikasi Windows memerlukan versi MSIX.', { exact: false }).waitFor()
  await assertPanelFits(page, 'MSIX required')
  assert.equal(await page.getByRole('button', { name: /^(Izinkan|Aktifkan) notifikasi$/ }).count(), 0)
  assert.deepEqual(await page.evaluate(() => window.scrollbarFrames), [])
  assert.deepEqual(errors, [])
  console.log('Panel UI passed: animated panels, notification access, enable/disable, incoming notification, scrolling, dismissal, MSIX status.')
} finally {
  await browser?.close()
  await server.close()
}
