import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  APPEARANCE_PRESETS,
  APPEARANCE_PRESET_IDS,
  LEGACY_DEFAULT_CARD_BG,
  applyAppearancePreset,
  applyCardSurfaceDefaults,
  contrastRatio,
  isLegacyDefaultCardBackground,
  isPanelStateOwnedByAccount,
  normalizePanelAppearance,
  resolveCardAppearance,
  resolveHomepageThemeVars,
  resolveIconForegroundColor,
  resolveSmallTitleColor,
  serializePanelConfig,
  shouldAutoSavePanelConfig,
} from './appearance.ts'
import type { AppearancePanelConfig } from './appearance.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function legacyConfig(): AppearancePanelConfig {
  return {
    backgroundImageSrc: '/uploads/custom-user-bg.webp',
    backgroundBlur: 4,
    backgroundMaskNumber: 0.2,
    iconStyle: 1,
    iconTextColor: '#ffffff',
    iconTextInfoHideDescription: false,
    iconTextIconHideTitle: false,
    logoText: 'My Lab',
    maxWidth: 1200,
    maxWidthUnit: 'px',
    marginX: 5,
    marginTop: 10,
    marginBottom: 10,
    netModeChangeButtonShow: true,
  }
}

test('legacy panel config without preset fields normalizes safely without altering existing settings', () => {
  const normalized = normalizePanelAppearance(legacyConfig())
  assert.equal(normalized.backgroundImageSrc, '/uploads/custom-user-bg.webp')
  assert.equal(normalized.backgroundBlur, 4)
  assert.equal(normalized.backgroundMaskNumber, 0.2)
  assert.equal(normalized.iconStyle, 1)
  assert.equal(normalized.iconTextColor, '#ffffff')
  assert.equal(normalized.cardSurface, 'default')
  assert.equal(normalized.wallpaperTone, 'dark')
  assert.equal(normalized.iconBadgeStyle, 'default')
  assert.equal(normalized.cardBackgroundColor, LEGACY_DEFAULT_CARD_BG)
  assert.equal(normalized.cardBlur, 0)
  assert.equal(normalized.cardBorderRadius, 16)
})

test('selective preset application only modifies checked scopes and preserves custom wallpaper and untouched settings', () => {
  const base = normalizePanelAppearance(legacyConfig())

  // Wallpaper only
  const wallpaperOnly = applyAppearancePreset(base, 'mist-paper', {
    wallpaper: true,
    cardStyle: false,
    iconStyle: false,
  })
  assert.equal(wallpaperOnly.backgroundImageSrc, '/assets/wallpapers/mist-paper.svg')
  assert.equal(wallpaperOnly.wallpaperTone, 'light')
  assert.equal(wallpaperOnly.backgroundMaskNumber, 0)
  assert.equal(wallpaperOnly.cardSurface, 'default')
  assert.equal(wallpaperOnly.iconStyle, 1)
  assert.equal(wallpaperOnly.iconTextColor, '#ffffff')
  // Original object must remain untouched (preview / cancel safety)
  assert.equal(base.backgroundImageSrc, '/uploads/custom-user-bg.webp')
  assert.equal(base.wallpaperTone, 'dark')

  // Card style only: keeps custom wallpaper and icon style
  const cardOnly = applyAppearancePreset(base, 'ocean-glass', {
    wallpaper: false,
    cardStyle: true,
    iconStyle: false,
  })
  assert.equal(cardOnly.backgroundImageSrc, '/uploads/custom-user-bg.webp')
  assert.equal(cardOnly.backgroundBlur, 4)
  assert.equal(cardOnly.cardSurface, 'ocean-glass')
  assert.equal(cardOnly.cardBlur, 14)
  assert.equal(cardOnly.cardAccentColor, '#38bdf8')
  assert.equal(cardOnly.iconStyle, 1)
  assert.equal(cardOnly.iconBadgeStyle, 'default')

  // Icon style only: keeps custom wallpaper and card surface
  const iconOnly = applyAppearancePreset(base, 'midnight-graphite', {
    wallpaper: false,
    cardStyle: false,
    iconStyle: true,
  })
  assert.equal(iconOnly.backgroundImageSrc, '/uploads/custom-user-bg.webp')
  assert.equal(iconOnly.cardSurface, 'default')
  assert.equal(iconOnly.iconStyle, 0)
  assert.equal(iconOnly.iconBadgeStyle, 'outline')
  assert.equal(iconOnly.iconTextColor, '#f1f5f9')

  // None selected: strict no-op
  const noop = applyAppearancePreset(base, 'mist-paper', {
    wallpaper: false,
    cardStyle: false,
    iconStyle: false,
  })
  assert.deepEqual(noop, base)
})

test('individual adjustments work cleanly after applying a preset', () => {
  const applied = applyAppearancePreset(legacyConfig(), 'midnight-graphite', {
    wallpaper: true,
    cardStyle: true,
    iconStyle: true,
  })

  const tuned = normalizePanelAppearance({
    ...applied,
    backgroundBlur: 8,
    cardBorderRadius: 20,
    cardAccentColor: '#38bdf8',
    iconTextColor: '#e2e8f0',
  })
  assert.equal(tuned.backgroundImageSrc, '/assets/wallpapers/midnight-graphite.svg')
  assert.equal(tuned.backgroundBlur, 8)
  assert.equal(tuned.cardSurface, 'midnight-graphite')
  assert.equal(tuned.cardBorderRadius, 20)
  assert.equal(tuned.cardAccentColor, '#38bdf8')
  assert.equal(tuned.iconTextColor, '#e2e8f0')

  const switchedSurface = applyCardSurfaceDefaults(tuned, 'ocean-glass')
  assert.equal(switchedSurface.cardSurface, 'ocean-glass')
  assert.equal(switchedSurface.backgroundImageSrc, '/assets/wallpapers/midnight-graphite.svg')
})

test('default card background adopts preset surface while custom per-card colors are preserved', () => {
  assert.equal(isLegacyDefaultCardBackground(undefined), true)
  assert.equal(isLegacyDefaultCardBackground(''), true)
  assert.equal(isLegacyDefaultCardBackground('#2a2a2a6b'), true)
  assert.equal(isLegacyDefaultCardBackground('#2A2A2A6B'), true)
  assert.equal(isLegacyDefaultCardBackground('#18A058'), false)

  const mistPaper = applyAppearancePreset(legacyConfig(), 'mist-paper')
  const defaultCard = resolveCardAppearance(mistPaper, { backgroundColor: '#2a2a2a6b' })
  assert.equal(defaultCard.hasCustomBackground, false)
  assert.equal(defaultCard.backgroundColor, APPEARANCE_PRESETS['mist-paper'].cardStyle.cardBackgroundColor)
  assert.equal(defaultCard.isLightSurface, true)
  assert.equal(defaultCard.textColor, '#1e293b')
  assert.equal(defaultCard.useTextShadow, false)

  const customCard = resolveCardAppearance(mistPaper, { backgroundColor: '#18A058' })
  assert.equal(customCard.hasCustomBackground, true)
  assert.equal(customCard.backgroundColor, '#18A058')
  assert.ok(contrastRatio(customCard.textColor, '#18A058') >= 3.2)
})

test('all three presets meet WCAG readability contrast on canvas and card surfaces', () => {
  for (const id of APPEARANCE_PRESET_IDS) {
    const config = applyAppearancePreset(legacyConfig(), id)
    const theme = resolveHomepageThemeVars(config)
    const card = resolveCardAppearance(config, { backgroundColor: LEGACY_DEFAULT_CARD_BG })

    // Header text against canvas fallback
    const headerContrast = contrastRatio(theme.cssVars['--leon-chrome-text'], theme.canvasFallback)
    assert.ok(headerContrast >= 7, `${id} header contrast too low: ${headerContrast}`)

    // Card title against card surface
    const cardTitleContrast = contrastRatio(card.textColor, card.backgroundColor, theme.canvasFallback)
    assert.ok(cardTitleContrast >= 7, `${id} card title contrast too low: ${cardTitleContrast}`)

    // Card secondary description against card surface
    const cardDescContrast = contrastRatio(card.secondaryTextColor, card.backgroundColor, theme.canvasFallback)
    assert.ok(cardDescContrast >= 4.5, `${id} card description contrast too low: ${cardDescContrast}`)

    // Search text against search background
    const searchContrast = contrastRatio(theme.searchTextColor, theme.searchBackground, theme.canvasFallback)
    assert.ok(searchContrast >= 7, `${id} search contrast too low: ${searchContrast}`)

    // Small icon title readability against canvas
    const smallTitle = resolveSmallTitleColor(config)
    const smallContrast = contrastRatio(smallTitle, theme.canvasFallback)
    assert.ok(smallContrast >= 7, `${id} small title contrast too low: ${smallContrast}`)
  }

  // Light wallpaper with legacy white text still auto-protects small icon title readability
  const mistWallpaperOnly = applyAppearancePreset(legacyConfig(), 'mist-paper', {
    wallpaper: true,
    cardStyle: false,
    iconStyle: false,
  })
  const protectedLightTitle = resolveSmallTitleColor(mistWallpaperOnly)
  assert.ok(contrastRatio(protectedLightTitle, '#eef2f5') >= 7)

  // Regression: Dark wallpaper with Mist Paper iconStyle only (dark #1e293b text) must auto-protect
  // small icon titles in the dark direction too (avoiding ~1.21:1 dark-on-dark contrast)
  const darkWithMistIconOnly = applyAppearancePreset(legacyConfig(), 'mist-paper', {
    wallpaper: false,
    cardStyle: false,
    iconStyle: true,
  })
  const darkTheme = resolveHomepageThemeVars(darkWithMistIconOnly)
  const protectedDarkTitle = resolveSmallTitleColor(darkWithMistIconOnly)
  assert.ok(
    contrastRatio(protectedDarkTitle, darkTheme.canvasFallback) >= 4.5,
    `dark canvas with mist iconStyle small title contrast too low: ${contrastRatio(protectedDarkTitle, darkTheme.canvasFallback)}`,
  )

  // Exhaustive matrix: every combination of (wallpaper x cardStyle x iconStyle) across default + 3 presets
  const choices: Array<'default' | 'ocean-glass' | 'mist-paper' | 'midnight-graphite'> = [
    'default',
    ...APPEARANCE_PRESET_IDS,
  ]
  for (const w of choices) {
    for (const c of choices) {
      for (const i of choices) {
        let cfg = normalizePanelAppearance(legacyConfig())
        if (w !== 'default')
          cfg = applyAppearancePreset(cfg, w, { wallpaper: true, cardStyle: false, iconStyle: false })
        if (c !== 'default')
          cfg = applyAppearancePreset(cfg, c, { wallpaper: false, cardStyle: true, iconStyle: false })
        if (i !== 'default')
          cfg = applyAppearancePreset(cfg, i, { wallpaper: false, cardStyle: false, iconStyle: true })

        const theme = resolveHomepageThemeVars(cfg)
        const card = resolveCardAppearance(cfg, { backgroundColor: LEGACY_DEFAULT_CARD_BG })
        const smallTitle = resolveSmallTitleColor(cfg)
        const label = `w=${w},c=${c},i=${i}`

        assert.ok(
          contrastRatio(smallTitle, theme.canvasFallback) >= 4.5,
          `${label} small title contrast too low`,
        )
        assert.ok(
          contrastRatio(card.textColor, card.backgroundColor, theme.canvasFallback) >= 4.5,
          `${label} card title contrast too low`,
        )
        assert.ok(
          contrastRatio(card.secondaryTextColor, card.backgroundColor, theme.canvasFallback) >= 4.5,
          `${label} card desc contrast too low`,
        )
        assert.ok(
          contrastRatio(theme.cssVars['--leon-chrome-text'], theme.canvasFallback) >= 4.5,
          `${label} chrome text contrast too low`,
        )
        assert.ok(
          contrastRatio(theme.searchTextColor, theme.searchBackground, theme.canvasFallback) >= 4.5,
          `${label} search text contrast too low`,
        )
      }
    }
  }
})

test('dirty-tracking suppresses duplicate auto-saves after apply, reset, or passive cloud sync', () => {
  const initial = normalizePanelAppearance(legacyConfig())
  const synced = serializePanelConfig(initial)
  assert.equal(shouldAutoSavePanelConfig(initial, synced), false)

  // After applyAppearancePreset + markPanelConfigSynced, async watcher must see no dirty diff
  const applied = applyAppearancePreset(initial, 'ocean-glass', {
    wallpaper: false,
    cardStyle: true,
    iconStyle: false,
  })
  const appliedSynced = serializePanelConfig(applied)
  assert.equal(shouldAutoSavePanelConfig(applied, appliedSynced), false)

  // After a genuine user adjustment, watcher must detect dirty diff and trigger save
  const edited = { ...applied, cardBorderRadius: 22 }
  assert.equal(shouldAutoSavePanelConfig(edited, appliedSynced), true)
})

test('text, Iconify, and fallback avatar icons pick high-contrast foreground for actual icon surface', () => {
  // Mist Paper warm white card / small tile -> dark foreground
  const mist = applyAppearancePreset(legacyConfig(), 'mist-paper')
  const mistTheme = resolveHomepageThemeVars(mist)
  const mistDefaultCard = resolveCardAppearance(mist, { backgroundColor: LEGACY_DEFAULT_CARD_BG })
  const mistFg = resolveIconForegroundColor(mistDefaultCard.backgroundColor, mistTheme.canvasFallback)
  assert.equal(mistFg, '#1e293b')
  assert.ok(contrastRatio(mistFg, mistDefaultCard.backgroundColor, mistTheme.canvasFallback) >= 10)

  // Custom dark per-card color inside Mist Paper keeps light icon foreground
  const mistCustomDark = resolveCardAppearance(mist, { backgroundColor: '#1d4ed8' })
  const customDarkFg = resolveIconForegroundColor(mistCustomDark.backgroundColor, mistTheme.canvasFallback)
  assert.equal(customDarkFg, '#f8fafc')
  assert.ok(contrastRatio(customDarkFg, '#1d4ed8') >= 4.5)

  // Mid-tone custom green (#18A058) picks whichever foreground yields higher WCAG contrast (>= 4.5:1)
  const customGreenFg = resolveIconForegroundColor('#18A058', mistTheme.canvasFallback)
  assert.ok(contrastRatio(customGreenFg, '#18A058') >= 4.5)

  // Custom light per-card color gets dark icon foreground
  assert.equal(resolveIconForegroundColor('#ffffff', '#111827'), '#1e293b')

  // Ocean Glass, Midnight Graphite, and legacy dark default keep light foreground
  for (const id of ['ocean-glass', 'midnight-graphite'] as const) {
    const cfg = applyAppearancePreset(legacyConfig(), id)
    const theme = resolveHomepageThemeVars(cfg)
    const card = resolveCardAppearance(cfg, { backgroundColor: LEGACY_DEFAULT_CARD_BG })
    const fg = resolveIconForegroundColor(card.backgroundColor, theme.canvasFallback)
    assert.equal(fg, '#f8fafc')
    assert.ok(contrastRatio(fg, card.backgroundColor, theme.canvasFallback) >= 7)
  }
  assert.equal(resolveIconForegroundColor(LEGACY_DEFAULT_CARD_BG, '#363636'), '#f8fafc')

  // Wiring check in ItemIcon and AppIcon
  const itemIcon = source('src/components/common/ItemIcon/index.vue')
  const appIcon = source('src/views/home/components/AppIcon/index.vue')
  assert.match(itemIcon, /resolveIconForegroundColor\(/)
  assert.match(itemIcon, /foregroundColor\?: string/)
  assert.match(itemIcon, /:style="avatarStyle"/)
  assert.match(appIcon, /resolveIconForegroundColor\(/)
  assert.match(appIcon, /:foreground-color="iconForegroundColor"/)
})

test('panel storage ownership check isolates styles across accounts and guest mode', () => {
  assert.equal(isPanelStateOwnedByAccount(1, 1), true)
  assert.equal(isPanelStateOwnedByAccount(null, null), true)
  assert.equal(isPanelStateOwnedByAccount(1, 2), false)
  assert.equal(isPanelStateOwnedByAccount(1, null), false)
  assert.equal(isPanelStateOwnedByAccount(null, 2), false)
})

test('preset wallpapers are local distributable assets with no external image links', () => {
  for (const id of APPEARANCE_PRESET_IDS) {
    const src = APPEARANCE_PRESETS[id].wallpaper.backgroundImageSrc
    assert.match(src, /^\/assets\/wallpapers\/[a-z-]+\.svg$/)
    const filePath = join(root, 'public', src)
    assert.equal(existsSync(filePath), true, `missing wallpaper asset ${filePath}`)
    const svg = readFileSync(filePath, 'utf8')
    assert.match(svg, /<svg\b/)
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org\/2000\/svg)/i)
  }
})

test('preview isolation, persistence, and account switch wiring stay intact', () => {
  const helper = source('src/store/modules/panel/helper.ts')
  const store = source('src/store/modules/panel/index.ts')
  const home = source('src/views/home/index.vue')
  const login = source('src/views/login/index.vue')
  const style = source('src/components/apps/Style/index.vue')
  const less = source('src/styles/leon-panel.less')

  assert.match(helper, /previewPresetId: _previewPresetId/)
  assert.match(helper, /lastSyncedPanelJson: _lastSyncedPanelJson/)
  assert.match(helper, /isPanelStateOwnedByAccount\(/)
  assert.match(store, /activePanelConfig\(/)
  assert.match(store, /cloudSyncGeneration/)
  assert.match(store, /cloudSaveGeneration/)
  assert.match(store, /cloudSaveQueue/)
  assert.match(store, /savePanelConfigToCloud\(/)
  assert.match(store, /startAppearancePreview\(/)
  assert.match(store, /cancelAppearancePreview\(/)
  assert.match(store, /applyAppearancePreset\(/)
  assert.match(home, /appearance-preview-bar/)
  assert.match(home, /leon-preview-btn-secondary/)
  assert.match(home, /position:\s*relative;\s*overflow:\s*hidden;/)
  assert.match(home, /panelState\.cancelAppearancePreview\(\)/)
  assert.match(home, /panelState\.updatePanelConfigByCloud\(\)/)
  assert.match(home, /panelState\.savePanelConfigToCloud\(\)/)
  assert.match(login, /panelState\.removeState\(\)/)
  assert.match(style, /shouldAutoSavePanelConfig\(/)
  assert.match(style, /panelState\.savePanelConfigToCloud\(\)/)
  assert.match(style, /appearance-presets-card/)
  assert.match(style, /preset-scope-wallpaper/)
  assert.match(style, /preset-scope-cardStyle/)
  assert.match(style, /preset-scope-iconStyle/)
  assert.match(less, /\.leon-preview-btn-ghost/)
  assert.match(less, /\.leon-preview-btn-secondary/)
})
