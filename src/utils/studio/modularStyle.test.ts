import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  CARD_HOVER_EFFECT_OPTIONS,
  CURSOR_PRESET_OPTIONS,
  CURSOR_SVG_PREVIEWS,
  FONT_PRESETS,
  FONT_PRESET_IDS,
  ICON_SHAPE_OPTIONS,
  ICON_TONE_OPTIONS,
  applyModularStyleToDocument,
  computeCardPointerVars,
  defaultModularStyleConfig,
  needsPointerTracking,
  normalizeCursorPresetId,
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

test('defaultModularStyleConfig, normalizeModularStyleConfig, and legacy cursor migration handle all inputs safely', () => {
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

  // Legacy v0.3.0 cursor IDs automatically migrate to zero-latency hardware SVG cursors
  assert.equal(normalizeCursorPresetId('precision-dot'), 'minimal-arrow')
  assert.equal(normalizeCursorPresetId('spotlight-aura'), 'frost-pointer')
  assert.equal(normalizeCursorPresetId('neon-ring'), 'neon-cyber')

  const valid = normalizeModularStyleConfig({
    fontPreset: 'studio-mono',
    iconShape: 'circle',
    iconToneFilter: 'luminous',
    cursorPreset: 'neon-cyber',
    cardHoverEffect: 'tilt-3d',
  })
  assert.deepEqual(valid, {
    fontPreset: 'studio-mono',
    iconShape: 'circle',
    iconToneFilter: 'luminous',
    cursorPreset: 'neon-cyber',
    cardHoverEffect: 'tilt-3d',
  })

  // Legacy StudioConfig without modular field normalizes cleanly
  const studio = normalizeStudioConfig({ effects: { gridOverlay: true }, widgets: [] })
  assert.deepEqual(studio.modular, defaults)
})

test('all cursor presets expose inline SVG vector previews and CSS avoids cursor: none lag', () => {
  for (const opt of CURSOR_PRESET_OPTIONS) {
    assert.match(opt.previewSvgUri, /^data:image\/svg\+xml,/)
    assert.equal(opt.previewSvgUri, CURSOR_SVG_PREVIEWS[opt.id])
  }

  const lessPath = fileURLToPath(new URL('../../styles/leon-panel.less', import.meta.url))
  const less = readFileSync(lessPath, 'utf8')
  assert.doesNotMatch(less, /cursor:\s*none/)
  for (const id of ['minimal-arrow', 'frost-pointer', 'neon-cyber', 'bauhaus-pop', 'crosshair-tech'])
    assert.match(less, new RegExp(`\\[data-leon-cursor='${id}'\\]`))
})

test('Style Studio pins the live preview dock above an independent scroll pane and eliminates duplicate tabs with Layout & Desktop', () => {
  const stylePath = fileURLToPath(new URL('../../components/apps/Style/index.vue', import.meta.url))
  const studioPath = fileURLToPath(new URL('../../components/apps/LeonStudio/index.vue', import.meta.url))
  const style = readFileSync(stylePath, 'utf8')
  const studio = readFileSync(studioPath, 'utf8')

  assert.match(style, /class="leon-pinned-dock"/)
  assert.match(style, /class="leon-visual-scroll"/)
  assert.match(style, /data-testid="style-undo-btn"/)
  assert.doesNotMatch(style, /NTabs/)
  assert.match(style, /CARD_HOVER_EFFECT_OPTIONS/)
  assert.match(style, /CURSOR_PRESET_OPTIONS/)

  // LeonStudio focuses strictly on layout, header toggles, visual widget picker, and custom code without duplicating theme/modular pickers
  assert.doesNotMatch(studio, /APPEARANCE_PRESETS/)
  assert.doesNotMatch(studio, /CARD_HOVER_EFFECT_OPTIONS/)
  assert.match(studio, /layout-mode-select/)
  assert.match(studio, /visual-widget-picker/)
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
    cursorPreset: 'frost-pointer',
    cardHoverEffect: 'border-glow',
  }, {}, normal.doc)

  assert.equal(normal.attrs.get('data-leon-font'), 'editorial-serif')
  assert.equal(normal.attrs.get('data-leon-icon-shape'), 'sharp')
  assert.equal(normal.attrs.get('data-leon-icon-tone'), 'soft-mono')
  assert.equal(normal.attrs.get('data-leon-cursor'), 'frost-pointer')
  assert.equal(normal.attrs.get('data-leon-hover-fx'), 'border-glow')
  assert.equal(normal.styles.get('--leon-font-sans'), FONT_PRESETS['editorial-serif'].fontFamily)

  const reduced = createMockDocument()
  applyModularStyleToDocument({
    fontPreset: 'studio-mono',
    iconShape: 'pill',
    iconToneFilter: 'high-contrast',
    cursorPreset: 'minimal-arrow',
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
    'apps.leonStudio.appName',
    'apps.leonStudio.tabLayout',
    'apps.leonStudio.modular.sandboxTitle',
    'apps.leonStudio.modular.sandboxHint',
    'apps.leonStudio.modular.resetModular',
    'apps.leonStudio.modular.navPresets',
    'apps.leonStudio.modular.navWallpaper',
    'apps.leonStudio.modular.navCard',
    'apps.leonStudio.modular.navIcon',
    'apps.leonStudio.modular.navFontCursor',
    'apps.leonStudio.modular.navHoverFx',
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
