import { test } from 'node:test'
import assert from 'node:assert/strict'
import { disconnected, NativeClient, validSnapshot } from '../electron/services/native-helper/client.ts'

test('missing native helper reports unavailable without stopping the app', () => {
  let received = false
  const client = new NativeClient('', value => { assert.equal(value, null); received = true })
  client.start(); client.stop()
  assert.equal(received, true)
})
test('native protocol rejects corrupt snapshots and external artwork', () => {
  assert.equal(validSnapshot(disconnected), true)
  assert.equal(validSnapshot({ ...disconnected, audio: { ...disconnected.audio, volume: NaN } }), false)
  assert.equal(validSnapshot({ ...disconnected, audio: { ...disconnected.audio, volume: 5 } }), false)
  assert.equal(validSnapshot({ ...disconnected, media: { ...disconnected.media, artwork: 'https://example.com/private.jpg' } }), false)
  assert.equal(validSnapshot({ ...disconnected, media: { ...disconnected.media, controls: null! } }), false)
  assert.equal(validSnapshot({ ...disconnected, notification: { id: '1', app: 'Mail', title: 'Pesan', body: 'Isi', receivedAt: NaN } }), false)
})
