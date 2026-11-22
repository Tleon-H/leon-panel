import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDesktopWidget,
  defaultStudioConfig,
  normalizeStudioConfig,
  sanitizeWidgetUrl,
} from './studioConfig.ts'

test('empty or legacy null studio config normalizes cleanly with zero invasive effects', () => {
  const cfg = normalizeStudioConfig(null)
  assert.deepEqual(cfg, defaultStudioConfig())
  assert.equal(cfg.effects.gridOverlay, false)
  assert.equal(cfg.effects.reduceMotion, false)
  assert.equal(cfg.effects.enhancedClock, false)
  assert.equal(cfg.widgets.length, 0)
})

test('sanitizeWidgetUrl permits http, https, and relative paths while rejecting dangerous protocols', () => {
  assert.equal(sanitizeWidgetUrl('https://status.example.com/embed'), 'https://status.example.com/embed')
  assert.equal(sanitizeWidgetUrl('http://192.168.1.10:3001/status'), 'http://192.168.1.10:3001/status')
  assert.equal(sanitizeWidgetUrl('/custom/widget.html'), '/custom/widget.html')
  assert.equal(sanitizeWidgetUrl('javascript:alert(1)'), '')
  assert.equal(sanitizeWidgetUrl('data:text/html,<script>alert(1)</script>'), '')
  assert.equal(sanitizeWidgetUrl('//evil.example.com/x'), '')
  assert.equal(sanitizeWidgetUrl('   '), '')
})

test('normalizeStudioConfig validates widget types, deduplicates ids, clamps iframe heights, and drops unsafe URLs', () => {
  const memo = createDesktopWidget('memo', 1)
  const iframe = createDesktopWidget('iframe', 2)
  const clock = createDesktopWidget('clock', 3)
  const normalized = normalizeStudioConfig({
    effects: {
      gridOverlay: true,
      hardShadowHover: false,
      reduceMotion: true,
      enhancedClock: true,
      clockGreeting: 'HomeLab Ready',
    },
    widgets: [
      { ...memo, content: 'Backup at 02:00' },
      { ...memo, content: 'Duplicate id should be dropped' },
      { ...iframe, url: 'javascript:alert(1)', height: 9999 },
      { ...clock, colSpan: 2, showSeconds: false },
      { id: 'bad', type: 'script', title: 'Invalid' },
    ],
  })

  assert.equal(normalized.effects.gridOverlay, true)
  assert.equal(normalized.effects.hardShadowHover, false)
  assert.equal(normalized.effects.enhancedClock, true)
  assert.equal(normalized.effects.clockGreeting, 'HomeLab Ready')
  assert.equal(normalized.widgets.length, 3)
  assert.equal(normalized.widgets[0].content, 'Backup at 02:00')
  assert.equal(normalized.widgets[1].url, '')
  assert.equal(normalized.widgets[1].height, 720)
  assert.equal(normalized.widgets[2].colSpan, 2)
  assert.equal(normalized.widgets[2].showSeconds, false)
})
