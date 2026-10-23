import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdir, readFile } from 'node:fs/promises'

// Capture the real renderer with deterministic demo data, without a Windows session.
const server = await createServer({ server: { port: 5173, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 460, height: 320 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    Date.now = () => 1792800000000
    const snapshot = {
      battery: { availability: 'available', percentage: 86, source: 'battery', charging: 'discharging' },
      media: { availability: 'available', title: 'Midnight City', artist: 'M83', artwork: null, playing: true, position: 68, duration: 244, updatedAt: Date.now(), controls: { play: true, pause: true, previous: true, next: true, seek: true } },
      audio: { availability: 'available', volume: .42, muted: false, device: 'Speakers' },
      timer: { status: 'running', duration: 300, remaining: 280, deadline: Date.now() + 280000 },
      notification: null, notificationAccess: 'unknown', preferences: { media: true, volume: true, notifications: false, sound: true }, bridge: 'ready',
    }
    window.desktop = { getActivity: async () => snapshot, getBattery: async () => snapshot.battery, onActivity: () => () => {}, onBattery: () => () => {}, setClickThrough() {}, command: async () => ({ ok: true }) }
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://localhost:5173')
  await page.getByRole('button', { name: 'Buka Musik', exact: true }).waitFor()
  await mkdir('docs/screenshots', { recursive: true })
  async function capture(name) {
    await page.evaluate(() => document.activeElement?.blur())
    await page.mouse.move(459, 319)
    await page.waitForTimeout(400)
    await page.locator('[class*="cluster"]').screenshot({ path: `docs/screenshots/${name}.png`, omitBackground: true, animations: 'disabled' })
  }
  await capture('compact')
  await page.getByRole('button', { name: 'Buka Musik', exact: true }).click()
  await page.getByRole('heading', { name: 'Midnight City' }).waitFor()
  await capture('music')
  await page.getByRole('button', { name: 'Timer', exact: true }).click()
  await page.getByRole('button', { name: 'Jeda', exact: true }).waitFor()
  await capture('timer')
  if (errors.length) throw new Error(errors.join('\n'))
  const pictures = Object.fromEntries(await Promise.all(['compact', 'music', 'timer'].map(async name => [name, `data:image/png;base64,${(await readFile(`docs/screenshots/${name}.png`)).toString('base64')}`])))
  const board = await browser.newPage({ viewport: { width: 1040, height: 530 }, deviceScaleFactor: 2 })
  await board.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box } body { margin: 0; background: #e7edf2; color: #334659; font-family: 'Segoe UI', sans-serif; }
    .compact { position: absolute; top: 46px; left: 400px; width: 240px; height: 40px; object-fit: cover; object-position: top; }
    .hint { position: absolute; top: 99px; width: 100%; text-align: center; font-size: 14px; color: #607284; }
    .panel { position: absolute; top: 170px; width: 400px; height: 320px; object-fit: contain; }
    .music { left: 94px } .timer { right: 94px }
    .label { position: absolute; top: 474px; width: 400px; text-align: center; font-size: 16px; font-weight: 600; }
  </style></head><body>
    <img class="compact" src="${pictures.compact}"><div class="hint">Dua aktivitas. Tetap ringkas.</div>
    <img class="panel music" src="${pictures.music}"><img class="panel timer" src="${pictures.timer}">
    <div class="label music">Musik dalam kendali</div><div class="label timer">Waktu tetap terpantau</div>
  </body></html>`)
  await board.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())))
  await board.screenshot({ path: 'docs/screenshots/overview.png' })
  console.log('Captured compact, music, timer, and README overview at 2× resolution.')
} finally {
  await browser?.close()
  await server.close()
}
