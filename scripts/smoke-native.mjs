import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const child = spawn(resolve('native/WindowsBridge/bin/publish/WindowsBridge.exe'), [], { windowsHide: true, stdio: 'pipe' })
const lines = createInterface({ input: child.stdout })
let serial = 0, firstResolve, firstReject
let latest
const pending = new Map()
const first = new Promise((resolve, reject) => { firstResolve = resolve; firstReject = reject })
child.on('error', firstReject)
child.stderr.resume()
lines.on('line', line => {
  try {
    const value = JSON.parse(line)
    if (value.type === 'snapshot') { latest = value; firstResolve(value) }
    if (value.type === 'result') pending.get(value.id)?.(value)
  } catch (error) { firstReject(error) }
})
const deadline = setTimeout(() => { firstReject(new Error('Native helper timed out')); child.kill() }, 20000)
async function command(command) {
  const id = ++serial
  const result = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Native command timed out')) }, 10000)
    pending.set(id, value => { clearTimeout(timeout); pending.delete(id); resolve(value) })
  })
  child.stdin.write(`${JSON.stringify({ ...command, id })}\n`)
  return result
}
try {
  const snapshot = await first
  assert.ok(['available', 'unavailable'].includes(snapshot.media.availability))
  assert.equal(snapshot.audio.availability, 'available', 'Expected a real Windows audio endpoint')
  assert.ok(snapshot.audio.volume >= 0 && snapshot.audio.volume <= 1)
  assert.equal(snapshot.notificationAccess, 'requires-package')
  assert.equal((await command({ type: 'preferences', value: { media: true, volume: true, notifications: false, sound: true } })).ok, true)
  assert.equal(latest.audio.availability, 'available')
  // Round-trip existing settings without altering the user's volume/mute state.
  assert.equal((await command({ type: 'volume', volume: snapshot.audio.volume })).ok, true)
  assert.equal((await command({ type: 'mute', muted: snapshot.audio.muted })).ok, true)
  assert.equal((await command({ type: 'invalid-command' })).ok, false)
  console.log('Native smoke passed:', JSON.stringify({ audio: snapshot.audio.availability, media: snapshot.media.availability, notifications: snapshot.notificationAccess }))
} finally {
  clearTimeout(deadline)
  lines.close()
  child.stdin.end()
  const timeout = setTimeout(() => child.kill(), 3000)
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve))
  clearTimeout(timeout)
}
