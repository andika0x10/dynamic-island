import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyTimer, isDesktopCommand } from '../shared/contracts/activity.ts'
import { advanceTimer, restoreTimer, transitionTimer } from '../electron/services/timer/state.ts'

test('timer uses deadline across sleep, pause and restart', () => {
  const timer = transitionTimer(emptyTimer, 'start', 1000, 60)
  const paused = transitionTimer(timer, 'pause', 11500)
  assert.equal(paused.remaining, 50)
  assert.equal(advanceTimer(paused, 100000).remaining, 50)
  const resumed = transitionTimer(paused, 'resume', 100000)
  assert.equal(advanceTimer(resumed, 200000).status, 'finished')
  assert.equal(restoreTimer(timer, 100000).status, 'finished')
  assert.deepEqual(transitionTimer(timer, 'cancel', 12000), emptyTimer)
})
test('corrupt persisted timer is rejected', () => {
  for (const value of [null, {}, { status: 'running', duration: 50, remaining: 50, deadline: null }, { status: 'paused', duration: 5, remaining: 50 }]) {
    assert.deepEqual(restoreTimer(value, 0), emptyTimer)
  }
})
test('IPC rejects arbitrary commands and unsafe payloads', () => {
  for (const value of [null, [], { type: 'open-settings' }, { type: 'shell' }, { type: 'volume', volume: 2 }, { type: 'seek', position: NaN }, { type: 'timer-start', seconds: .5 }, { type: 'preferences', value: { admin: true } }]) assert.equal(isDesktopCommand(value), false)
  for (const value of [{ type: 'timer-start', seconds: 60 }, { type: 'mute', muted: true }, { type: 'preferences', value: { sound: false } }]) assert.equal(isDesktopCommand(value), true)
})
