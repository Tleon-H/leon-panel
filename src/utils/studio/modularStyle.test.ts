import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  CARD_HOVER_EFFECT_OPTIONS,
  CURSOR_PRESET_OPTIONS,
  FONT_PRESETS,
  FONT_PRESET_IDS,
  ICON_SHAPE_OPTIONS,
  ICON_TONE_OPTIONS,
  applyModularStyleToDocument,
  computeCardPointerVars,
  defaultModularStyleConfig,
  needsPointerTracking,
  normalizeModularStyleConfig,
} from './modularStyle.ts'
import { normalizeStudioConfig } from './studioConfig.ts'

function resolveDotPath(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>))
      return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

function createMockDocument() {
  const styles = new Map<string, string>()
  const attrs = new Map<string, string>()
  return {
    styles,
    attrs,
    doc: {
      documentElement: {
        style: {
          setProperty(name: string, value: string) {
            styles.set(name, value)
          },
        },
        setAttribute(name: string, value: string) {
          attrs.set(name, value)
        },
      },
    } as unknown as Document,
  }
}

test('defaultModularStyleConfig and normalizeModularStyleConfig handle null, legacy, and invalid values safely', () => {
  const defaults = defaultModularStyleConfig()
  assert.deepEqual(normalizeModularStyleConfig(null), defaults)
  assert.deepEqual(normalizeModularStyleConfig({}), defaults)
  assert.deepEqual(normalizeModularStyleConfig({
    fontPreset: 'not-a-font',
    iconShape: 123,
    iconToneFilter: 'rainbow',
    cursorPreset: 'laser',
    cardHoverEffect: 'explode',
  }), defaults)

  const valid = normalizeModularStyleConfig({
    fontPreset: 'studio-mono',
    iconShape: 'circle',
    iconToneFilter: 'luminous',
    cursorPreset: 'precision-dot',
    cardHoverEffect: 'tilt-3d',
  })
  assert.deepEqual(valid, {
    fontPreset: 'studio-mono',
    iconShape: 'circle',
    iconToneFilter: 'luminous',
    cursorPreset: 'precision-dot',
    cardHoverEffect: 'tilt-3d',
  })

  // Legacy StudioConfig without modular field normalizes cleanly
  const studio = normalizeStudioConfig({ effects: { gridOverlay: true }, widgets: [] })
  assert.deepEqual(studio.modular, defaults)
})

test('computeCardPointerVars maps center, corners, clamps out-of-bounds coordinates, and guards zero dimensions', () => {
  const rect = { left: 100, top: 200, width: 200, height: 100 }
  const center = computeCardPointerVars(200, 250, rect)
  assert.equal(center['--leon-mx'], '100px')
  assert.equal(center['--leon-my'], '50px')
  assert.equal(center['--leon-rx'], '0deg')
  assert.equal(center['--leon-ry'], '0deg')
  assert.equal(center['--leon-tx'], '0px')
  assert.equal(center['--leon-ty'], '0px')

  const topLeft = computeCardPointerVars(50, 100, rect)
  assert.equal(topLeft['--leon-mx'], '0px')
  assert.equal(topLeft['--leon-my'], '0px')
  assert.equal(topLeft['--leon-rx'], '5.5deg')
  assert.equal(topLeft['--leon-ry'], '-6.5deg')
  assert.equal(topLeft['--leon-tx'], '-4px')
  assert.equal(topLeft['--leon-ty'], '-3.5px')

  const zeroRect = computeCardPointerVars(0, 0, { left: 0, top: 0, width: 0, height: 0 })
  assert.equal(zeroRect['--leon-mx'], '0px')
  assert.equal(zeroRect['--leon-my'], '0px')
})

test('needsPointerTracking identifies coordinate-driven effects accurately', () => {
  assert.equal(needsPointerTracking('spotlight'), true)
  assert.equal(needsPointerTracking('tilt-3d'), true)
  assert.equal(needsPointerTracking('border-glow'), true)
  assert.equal(needsPointerTracking('magnetic'), true)
  assert.equal(needsPointerTracking('shimmer'), false)
  assert.equal(needsPointerTracking('lift'), false)
  assert.equal(needsPointerTracking('bauhaus-pop'), false)
  assert.equal(needsPointerTracking('none'), false)
})

test('applyModularStyleToDocument applies CSS vars and attributes and respects safeMode and reduceMotion', () => {
  const normal = createMockDocument()
  applyModularStyleToDocument({
    fontPreset: 'editorial-serif',
    iconShape: 'sharp',
    iconToneFilter: 'soft-mono',
    cursorPreset: 'neon-ring',
    cardHoverEffect: 'border-glow',
  }, {}, normal.doc)

  assert.equal(normal.attrs.get('data-leon-font'), 'editorial-serif')
  assert.equal(normal.attrs.get('data-leon-icon-shape'), 'sharp')
  assert.equal(normal.attrs.get('data-leon-icon-tone'), 'soft-mono')
  assert.equal(normal.attrs.get('data-leon-cursor'), 'neon-ring')
  assert.equal(normal.attrs.get('data-leon-hover-fx'), 'border-glow')
  assert.equal(normal.styles.get('--leon-font-sans'), FONT_PRESETS['editorial-serif'].fontFamily)

  const reduced = createMockDocument()
  applyModularStyleToDocument({
    fontPreset: 'studio-mono',
    iconShape: 'pill',
    iconToneFilter: 'high-contrast',
    cursorPreset: 'precision-dot',
    cardHoverEffect: 'tilt-3d',
  }, { reduceMotion: true }, reduced.doc)
  assert.equal(reduced.attrs.get('data-leon-font'), 'studio-mono')
  assert.equal(reduced.attrs.get('data-leon-cursor'), 'system')
  assert.equal(reduced.attrs.get('data-leon-hover-fx'), 'none')

  const safe = createMockDocument()
  applyModularStyleToDocument({
    fontPreset: 'studio-mono',
    iconShape: 'circle',
    iconToneFilter: 'luminous',
    cursorPreset: 'crosshair-tech',
    cardHoverEffect: 'magnetic',
  }, { safeMode: true }, safe.doc)
  assert.equal(safe.attrs.get('data-leon-font'), 'modern-sans')
  assert.equal(safe.attrs.get('data-leon-icon-shape'), 'squircle')
  assert.equal(safe.attrs.get('data-leon-icon-tone'), 'original')
  assert.equal(safe.attrs.get('data-leon-cursor'), 'system')
})

test('every modular style i18n key exists in both zh-CN.json and en-US.json', () => {
  const zhPath = fileURLToPath(new URL('../../locales/zh-CN.json', import.meta.url))
  const enPath = fileURLToPath(new URL('../../locales/en-US.json', import.meta.url))
  const zh = JSON.parse(readFileSync(zhPath, 'utf8')) as Record<string, unknown>
  const en = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, unknown>

  const keys: string[] = [
    'apps.leonStudio.tabModular',
    'apps.leonStudio.modular.sandboxTitle',
    'apps.leonStudio.modular.sandboxHint',
    'apps.leonStudio.modular.resetModular',
    ...FONT_PRESET_IDS.map(id => FONT_PRESETS[id].nameKey),
    ...ICON_SHAPE_OPTIONS.flatMap(opt => [opt.nameKey, opt.descKey]),
    ...ICON_TONE_OPTIONS.flatMap(opt => [opt.nameKey, opt.descKey]),
    ...CURSOR_PRESET_OPTIONS.flatMap(opt => [opt.nameKey, opt.descKey]),
    ...CARD_HOVER_EFFECT_OPTIONS.flatMap(opt => [opt.nameKey, opt.descKey]),
  ]

  for (const key of keys) {
    const zhVal = resolveDotPath(zh, key)
    const enVal = resolveDotPath(en, key)
    assert.equal(typeof zhVal, 'string', `Missing zh-CN translation for ${key}`)
    assert.ok((zhVal as string).trim().length > 0, `Empty zh-CN translation for ${key}`)
    assert.equal(typeof enVal, 'string', `Missing en-US translation for ${key}`)
    assert.ok((enVal as string).trim().length > 0, `Empty en-US translation for ${key}`)
  }
})
