import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptIconEvent, createRemoteIconController, fallbackLabel, isRemoteIconType, phaseAfterTargetChange, reduceRemoteIconPhase } from './remoteIcon.ts'

test('text icons are not remote and image or iconify icons are', () => {
  assert.equal(isRemoteIconType(1), false)
  assert.equal(isRemoteIconType(2), true)
  assert.equal(isRemoteIconType(3), true)
})

test('a failed remote icon stays on fallback and does not accept a later success', () => {
  const failed = reduceRemoteIconPhase('loading', 'error')
  assert.equal(failed, 'fallback')
  assert.equal(reduceRemoteIconPhase(failed, 'success'), 'fallback')
  assert.equal(reduceRemoteIconPhase(failed, 'error'), 'fallback')
})

test('a successful load can be shown', () => {
  assert.equal(reduceRemoteIconPhase('loading', 'success'), 'ready')
})

test('changing the image address leaves fallback and a stale error cannot mark the new address failed', () => {
  let src = 'https://example.com/missing.png'
  const icon = createRemoteIconController(() => ({ itemType: 2, src }))
  const first = icon.sync()
  assert.equal(first.phase, 'loading')
  assert.equal(icon.onImageEvent('error', first.requestId), 'fallback')

  src = 'https://example.com/next.png'
  const second = icon.sync()
  assert.equal(second.phase, 'loading')
  assert.notEqual(second.requestId, first.requestId)
  assert.equal(icon.onImageEvent('error', first.requestId), 'loading')
  assert.equal(icon.onImageEvent('success', second.requestId), 'ready')
  assert.equal(phaseAfterTargetChange(2, '', '图'), 'fallback')
  assert.equal(acceptIconEvent('loading', 'success', 1, 2), 'loading')
})

test('fallback prefers item title for image and online icons and ignores URL-like custom text', () => {
  assert.equal(fallbackLabel(2, 'https://example.com/icon.png', 'GitHub'), 'G')
  assert.equal(fallbackLabel(2, 'http://nas.local/logo.svg', ''), '?')
  assert.equal(fallbackLabel(2, 'data:image/png;base64,AAA', ''), '?')
  assert.equal(fallbackLabel(2, '图', '示例文档'), '示')
  assert.equal(fallbackLabel(2, '图', ''), '图')
  assert.equal(fallbackLabel(2, '', '示例文档'), '示')
  assert.equal(fallbackLabel(3, 'mdi:not-real', '手册'), '手')
  assert.equal(fallbackLabel(3, 'https://example.com/icon.svg', ''), '?')
  assert.equal(fallbackLabel(3, 'mdi:not-real', ''), 'm')
  assert.equal(fallbackLabel(3, '', ''), '?')
  assert.equal(fallbackLabel(1, '图', '示例文档'), '图')
})
