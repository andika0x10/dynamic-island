import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyTimer, isDesktopCommand } from '../shared/contracts/activity.ts'
import { timerRemaining } from '../src/features/timer/remaining.ts'

test('timer UI uses deadlines and preserves paused remaining time', () => {
  const timer = { ...emptyTimer, status: 'running' as const, duration: 60, remaining: 60, deadline: 61000 }
  assert.equal(timerRemaining(timer, 11500), 50)
  assert.equal(timerRemaining({ ...timer, status: 'paused', remaining: 50, deadline: null }, 100000), 50)
  assert.equal(timerRemaining(timer, 200000), 0)
  assert.equal(timerRemaining(emptyTimer, 200000), 0)
})

test('IPC rejects arbitrary commands and unsafe payloads', () => {
  for (const value of [null, [], { type: 'open-settings' }, { type: 'shell' }, { type: 'volume', volume: 2 }, { type: 'seek', position: NaN }, { type: 'timer-start', seconds: .5 }, { type: 'preferences', value: { admin: true } }]) assert.equal(isDesktopCommand(value), false)
  for (const value of [{ type: 'timer-start', seconds: 60 }, { type: 'mute', muted: true }, { type: 'preferences', value: { sound: false } }]) assert.equal(isDesktopCommand(value), true)
})
