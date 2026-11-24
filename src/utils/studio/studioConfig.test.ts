import assert from 'node:assert/strict'
import test from 'node:test'
import { isBundledLocalIcon } from '../icon/localIcons.ts'
import {
  WIDGET_CATALOG,
  computeCountdownDays,
  createDesktopWidget,
  defaultStudioConfig,
  normalizeIsoDate,
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

test('todo and countdown widgets normalize cleanly, validate dates, compute day deltas, and stay compatible with legacy widgets', () => {
  const fixedNow = new Date(2026, 10, 24) // 2026-11-24
  assert.equal(normalizeIsoDate('2026-12-31'), '2026-12-31')
  assert.equal(normalizeIsoDate('2026-02-31'), '')
  assert.equal(normalizeIsoDate('not-a-date'), '')

  assert.equal(computeCountdownDays('2026-11-24', fixedNow), 0)
  assert.equal(computeCountdownDays('2026-12-04', fixedNow), 10)
  assert.equal(computeCountdownDays('2026-11-20', fixedNow), -4)
  assert.equal(computeCountdownDays('bad', fixedNow), null)

  const todo = createDesktopWidget('todo', 10, fixedNow)
  const countdown = createDesktopWidget('countdown', 20, fixedNow)
  const legacyClock = createDesktopWidget('clock', 30, fixedNow)

  assert.equal(todo.type, 'todo')
  assert.ok((todo.todoItems?.length || 0) >= 1)
  assert.equal(countdown.type, 'countdown')
  assert.equal(countdown.countdownEntries?.[0]?.targetDate, '2026-12-24')

  const normalized = normalizeStudioConfig({
    widgets: [
      legacyClock,
      {
        ...todo,
        todoItems: [
          { id: 'a', text: 'Check backups', done: true },
          { id: 'a', text: 'Duplicate id dropped', done: false },
          { id: 'b', text: '   ', done: false },
          { id: 'c', text: 'Renew TLS cert', done: false },
        ],
      },
      {
        ...countdown,
        countdownEntries: [
          { id: 'd1', label: 'Domain .dev', targetDate: '2026-12-01' },
          { id: 'd2', label: 'Invalid date kept empty', targetDate: '2026-99-99' },
          { id: 'd3', label: '', targetDate: '' },
        ],
      },
    ],
  })

  assert.equal(normalized.widgets.length, 3)
  assert.equal(normalized.widgets[0].type, 'clock')
  assert.deepEqual(normalized.widgets[1].todoItems, [
    { id: 'a', text: 'Check backups', done: true },
    { id: 'c', text: 'Renew TLS cert', done: false },
  ])
  assert.deepEqual(normalized.widgets[2].countdownEntries, [
    { id: 'd1', label: 'Domain .dev', targetDate: '2026-12-01' },
    { id: 'd2', label: 'Invalid date kept empty', targetDate: '' },
  ])

  // Visual widget catalog exposes exactly the 5 supported widgets and every icon is bundled locally
  assert.deepEqual(WIDGET_CATALOG.map(c => c.type), ['todo', 'countdown', 'clock', 'memo', 'iframe'])
  for (const entry of WIDGET_CATALOG)
    assert.equal(isBundledLocalIcon(entry.icon), true, `widget icon ${entry.icon} must be bundled`)
})
