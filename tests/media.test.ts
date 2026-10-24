import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyMedia } from '../shared/contracts/activity.ts'
import { mediaPosition, mediaTimeline } from '../src/features/media/timeline.ts'

test('elapsed playback remains available without a reported total duration', () => {
  const media = { ...emptyMedia, position: 30, updatedAt: 10000, playing: true }
  assert.equal(mediaPosition(media, 12000), 32)
  assert.equal(mediaPosition({ ...media, playing: false }, 12000), 30)
  assert.equal(mediaPosition({ ...media, position: NaN, updatedAt: 0 }, 12000), 0)
  assert.equal(mediaPosition({ ...media, position: -5 }, 9000), 0)
})

test('missing media timing is unavailable, rather than a zero-length track', () => {
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.equal(mediaTimeline({ ...emptyMedia, playing: true, duration }, 10000), null)
  }
})

test('valid timing recovers and advances while playing, stays still while paused', () => {
  const media = { ...emptyMedia, duration: 180, position: 30, updatedAt: 10000 }
  assert.deepEqual(mediaTimeline({ ...media, playing: true }, 12000), { position: 32, duration: 180 })
  assert.deepEqual(mediaTimeline(media, 12000), { position: 30, duration: 180 })
})

test('timeline clamps stale positions and ignores missing timestamps', () => {
  const media = { ...emptyMedia, duration: 180, position: 179, playing: true, updatedAt: 10000 }
  assert.equal(mediaTimeline(media, 20000)?.position, 180)
  assert.equal(mediaTimeline({ ...media, updatedAt: 0 }, 20000)?.position, 179)
  assert.equal(mediaTimeline({ ...media, position: -5 }, 9000)?.position, 0)
})
