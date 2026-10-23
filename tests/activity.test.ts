import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialActivity } from '../shared/contracts/activity.ts'
import { selectActivities } from '../src/island/activity/select.ts'

test('manual detail stays pinned while a transient arrives', () => {
  assert.deepEqual(selectActivities(initialActivity, 'battery', { kind: 'volume', until: 500 }, 100), { primary: 'battery', secondary: null, expanded: true })
})
test('music and timer coexist, transient expires back to music', () => {
  const snapshot = { ...initialActivity, media: { ...initialActivity.media, availability: 'available' as const }, timer: { status: 'running' as const, duration: 60, remaining: 60, deadline: 60000 } }
  assert.deepEqual(selectActivities(snapshot, null, null, 0), { primary: 'media', secondary: 'timer', expanded: false })
  assert.equal(selectActivities(snapshot, null, { kind: 'volume', until: 100 }, 99).primary, 'volume')
  assert.equal(selectActivities(snapshot, null, { kind: 'volume', until: 100 }, 100).primary, 'media')
  assert.equal(selectActivities({ ...snapshot, timer: { ...snapshot.timer, status: 'finished' } }, null, { kind: 'volume', until: 500 }, 0).primary, 'timer')
})
