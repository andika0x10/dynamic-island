import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBattery, queryBattery } from '../electron/battery.ts'

function row(level: unknown, status: unknown) {
  return JSON.stringify([{ EstimatedChargeRemaining: level, BatteryStatus: status }])
}
test('charging is distinct from merely connected to AC', () => {
  assert.equal(normalizeBattery(row(51, 6), false).charging, 'charging')
  assert.equal(normalizeBattery(row(51, 2), false).charging, 'unknown')
  assert.equal(normalizeBattery(row(100, 3), false).charging, 'full')
  assert.equal(normalizeBattery(row(100, 2), false).charging, 'unknown')
})
test('battery power overrides stale charging status', () => {
  assert.deepEqual(normalizeBattery(row(51, 6), true), {
    availability: 'available', percentage: 51, source: 'battery', charging: 'discharging',
  })
})
test('unknown charging and invalid level remain unknown', () => {
  assert.equal(normalizeBattery(row(null, 99), false).charging, 'unknown')
  for (const level of [null, '50', -1, 255]) assert.equal(normalizeBattery(row(level, 99), false).percentage, null)
})
test('multiple batteries average valid percentages only', () => {
  const json = JSON.stringify([
    { EstimatedChargeRemaining: 40, BatteryStatus: 3 },
    { EstimatedChargeRemaining: 61, BatteryStatus: 6 },
    { EstimatedChargeRemaining: 255, BatteryStatus: 2 },
  ])
  assert.equal(normalizeBattery(json, false).percentage, 51)
  assert.equal(normalizeBattery(json, false).charging, 'charging')
})
test('no batteries is an explicit absent state', () => {
  assert.equal(normalizeBattery('[]', false).availability, 'absent')
})
test('malformed output becomes unavailable', async () => {
  for (const json of ['broken', '{}', '[null]']) {
    const snapshot = await queryBattery(false, callback => callback(null, json))
    assert.equal(snapshot.availability, 'unavailable')
    assert.equal(snapshot.percentage, null)
  }
})
test('timeout and process errors become unavailable, retaining power source', async () => {
  const snapshot = await queryBattery(true, callback => callback(new Error('timeout'), ''))
  assert.equal(snapshot.availability, 'unavailable')
  assert.equal(snapshot.source, 'battery')
})
test('real Windows CIM query returns a structured snapshot', { skip: process.platform !== 'win32' }, async () => {
  const snapshot = await queryBattery(false)
  assert.notEqual(snapshot.availability, 'unavailable')
})
