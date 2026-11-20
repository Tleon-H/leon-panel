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
  applyWallpaperSource,
  contrastRatio,
  createPanelCloudController,
  inferWallpaperToneFromSrc,
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
import type { AppearancePanelConfig, PanelCloudResponse } from './appearance.ts'

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
  assert.equal(normalized.wallpaperTone, undefined)
  assert.equal(resolveHomepageThemeVars(normalized).isLightCanvas, false)
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
  assert.equal(base.wallpaperTone, undefined)

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
  assert.match(store, /createPanelCloudController</)
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

test('legacy custom text color without explicit wallpaperTone is preserved through normalizePanelAppearance and activePanelConfig while preset configurations remain protected', () => {
  const legacyCustomDarkText: AppearancePanelConfig = {
    ...legacyConfig(),
    backgroundImageSrc: '/uploads/my-light-photo.jpg',
    iconTextColor: '#000000',
  }
  // Even after normalizePanelAppearance (which is what activePanelConfig and AppIcon run),
  // wallpaperTone must remain undefined so legacy custom dark text (#000000) is preserved
  const normalizedLegacy = normalizePanelAppearance(legacyCustomDarkText)
  assert.equal(normalizedLegacy.wallpaperTone, undefined)
  assert.equal(resolveSmallTitleColor(normalizedLegacy), '#000000')
  assert.equal(resolveCardAppearance(normalizedLegacy, { backgroundColor: LEGACY_DEFAULT_CARD_BG }).textColor, '#000000')

  const legacyCustomBrandText: AppearancePanelConfig = normalizePanelAppearance({
    ...legacyConfig(),
    iconTextColor: '#334155',
  })
  assert.equal(resolveSmallTitleColor(legacyCustomBrandText), '#334155')
  assert.equal(resolveCardAppearance(legacyCustomBrandText, { backgroundColor: LEGACY_DEFAULT_CARD_BG }).textColor, '#334155')

  // Once user explicitly chooses a wallpaperTone or applies a preset, WCAG protection activates
  const explicitDarkTone: AppearancePanelConfig = normalizePanelAppearance({
    ...legacyCustomDarkText,
    wallpaperTone: 'dark',
  })
  assert.equal(explicitDarkTone.wallpaperTone, 'dark')
  assert.equal(resolveSmallTitleColor(explicitDarkTone), '#f8fafc')
  assert.equal(resolveCardAppearance(explicitDarkTone, { backgroundColor: LEGACY_DEFAULT_CARD_BG }).textColor, '#f8fafc')

  const explicitLightTone: AppearancePanelConfig = normalizePanelAppearance({
    ...legacyCustomDarkText,
    wallpaperTone: 'light',
  })
  assert.equal(resolveSmallTitleColor(explicitLightTone), '#000000')
})

test('changing wallpaper source centralized helper updates wallpaperTone appropriately and allows subsequent manual override', () => {
  assert.equal(inferWallpaperToneFromSrc('/assets/wallpapers/mist-paper.svg'), 'light')
  assert.equal(inferWallpaperToneFromSrc('/assets/wallpapers/ocean-glass.svg'), 'dark')
  assert.equal(inferWallpaperToneFromSrc('/assets/wallpapers/midnight-graphite.svg'), 'dark')
  assert.equal(inferWallpaperToneFromSrc('/uploads/custom-night.jpg'), 'dark')
  assert.equal(inferWallpaperToneFromSrc('https://example.com/bg.png'), 'dark')

  // Apply Mist Paper preset (wallpaperTone becomes 'light')
  const mistApplied = applyAppearancePreset(legacyConfig(), 'mist-paper', {
    wallpaper: true,
    cardStyle: false,
    iconStyle: false,
  })
  assert.equal(mistApplied.wallpaperTone, 'light')

  // Switching to a custom uploaded/gallery/URL image resets tone to 'dark' instead of inheriting 'light'
  const afterCustomWallpaper = applyWallpaperSource(mistApplied, '/uploads/my-dark-wallpaper.webp')
  assert.equal(afterCustomWallpaper.backgroundImageSrc, '/uploads/my-dark-wallpaper.webp')
  assert.equal(afterCustomWallpaper.wallpaperTone, 'dark')
  const darkTheme = resolveHomepageThemeVars(afterCustomWallpaper)
  assert.equal(darkTheme.isLightCanvas, false)
  assert.equal(darkTheme.cssVars['--leon-chrome-text'], '#ffffff')

  // Switching to Mist Paper preset SVG sets tone to 'light'
  const afterMistSvg = applyWallpaperSource(afterCustomWallpaper, '/assets/wallpapers/mist-paper.svg')
  assert.equal(afterMistSvg.wallpaperTone, 'light')

  // User can still manually override wallpaperTone after setting a custom wallpaper
  const manualLightOverride: AppearancePanelConfig = {
    ...afterCustomWallpaper,
    wallpaperTone: 'light',
  }
  assert.equal(resolveHomepageThemeVars(manualLightOverride).isLightCanvas, true)
  assert.notEqual(serializePanelConfig(afterCustomWallpaper), serializePanelConfig(manualLightOverride))
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createDefaultTestConfig(): AppearancePanelConfig {
  const cfg = normalizePanelAppearance({
    backgroundImageSrc: '/assets/defaultBackground.webp',
    backgroundBlur: 0,
    backgroundMaskNumber: 0,
    cardSurface: 'default',
    iconStyle: 1,
    iconBadgeStyle: 'default',
    iconTextColor: '#ffffff',
    iconTextInfoHideDescription: false,
    iconTextIconHideTitle: false,
    logoText: 'Leon Panel',
    searchBoxShow: false,
    searchBoxSearchIcon: false,
    maxWidth: 1200,
    maxWidthUnit: 'px',
    marginX: 5,
    marginTop: 10,
    marginBottom: 10,
    netModeChangeButtonShow: true,
  })
  delete cfg.wallpaperTone
  return cfg
}

test('loading gate blocks preset apply, wallpaper changes, and saves while initial GET is pending, and guest mode stays read-only', async () => {
  let token = 'token-user-1'
  let userId: number | null = 1
  const pendingGet = deferred<PanelCloudResponse<AppearancePanelConfig>>()
  const pushedPayloads: AppearancePanelConfig[] = []

  const controller = createPanelCloudController<AppearancePanelConfig>({
    getToken: () => token,
    getUserId: () => userId,
    createDefaultConfig: createDefaultTestConfig,
    fetchCloudConfig: () => pendingGet.promise,
    pushCloudConfig: async (panel) => {
      pushedPayloads.push(panel)
      return { code: 0 }
    },
  })

  // Before load starts ('idle'), editing and saving are blocked
  assert.equal(controller.canEdit(), false)
  assert.equal(controller.applyPreset('mist-paper', { wallpaper: true, cardStyle: false, iconStyle: false }), false)
  const blockedIdleSave = await controller.saveToCloud()
  assert.equal(blockedIdleSave.ok, false)
  assert.equal(blockedIdleSave.blocked, true)
  assert.equal(pushedPayloads.length, 0)

  // Start initial GET ('loading'): all mutations and saves must be rejected
  const loadPromise = controller.loadFromCloud()
  assert.equal(controller.state.cloudConfigState, 'loading')
  assert.equal(controller.canEdit(), false)
  assert.equal(controller.startPreview('ocean-glass'), false)
  assert.equal(controller.applyPreset('mist-paper', { wallpaper: true, cardStyle: false, iconStyle: false }), false)
  assert.equal(controller.setWallpaper('/uploads/early.webp'), false)
  const blockedLoadingSave = await controller.saveToCloud()
  assert.equal(blockedLoadingSave.ok, false)
  assert.equal(blockedLoadingSave.blocked, true)
  assert.equal(pushedPayloads.length, 0)

  // Resolve initial GET with user's rich cloud configuration (default surface + legacy custom #000000 text)
  pendingGet.resolve({
    code: 0,
    data: {
      panel: {
        logoText: 'My Private Cloud',
        searchBoxShow: true,
        cardSurface: 'default',
        cardBlur: 0,
        backgroundImageSrc: '/uploads/original-bg.webp',
        iconTextColor: '#000000',
        maxWidthUnit: 'px',
      },
    },
  })
  const loadRes = await loadPromise
  assert.equal(loadRes.ok, true)
  assert.equal(controller.state.cloudConfigState, 'ready')
  assert.equal(controller.canEdit(), true)
  assert.equal(controller.state.panelConfig.logoText, 'My Private Cloud')
  assert.equal(controller.state.panelConfig.searchBoxShow, true)
  // Legacy config without wallpaperTone keeps undefined through store's activePanelConfig -> AppIcon renders #000000!
  const activeConfig = normalizePanelAppearance(controller.state.panelConfig)
  assert.equal(activeConfig.wallpaperTone, undefined)
  assert.equal(resolveSmallTitleColor(activeConfig), '#000000')
  assert.equal(resolveCardAppearance(activeConfig, { backgroundColor: LEGACY_DEFAULT_CARD_BG }).textColor, '#000000')

  // Applying wallpaper-only preset now preserves all non-wallpaper cloud fields!
  assert.equal(controller.applyPreset('mist-paper', { wallpaper: true, cardStyle: false, iconStyle: false }), true)
  const saveRes = await controller.saveToCloud()
  assert.equal(saveRes.ok, true)
  assert.equal(pushedPayloads.length, 1)
  assert.equal(pushedPayloads[0].backgroundImageSrc, '/assets/wallpapers/mist-paper.svg')
  assert.equal(pushedPayloads[0].wallpaperTone, 'light')
  assert.equal(pushedPayloads[0].logoText, 'My Private Cloud')
  assert.equal(pushedPayloads[0].searchBoxShow, true)
  assert.equal(pushedPayloads[0].cardSurface, 'default')

  // Guest mode (empty token) is strictly read-only even if state was ready
  token = ''
  userId = null
  assert.equal(controller.canEdit(), false)
  assert.equal(controller.applyPreset('ocean-glass'), false)
  assert.equal(controller.setWallpaper('/uploads/guest.webp'), false)
  const guestSave = await controller.saveToCloud()
  assert.equal(guestSave.ok, false)
  assert.equal(guestSave.blocked, true)
  assert.equal(pushedPayloads.length, 1)
})

test('explicit record-not-found unlocks editing with default config, while transient GET errors keep previous config and unlock after retry', async () => {
  const token = 'token-user-2'
  let nextGetResponse: () => Promise<PanelCloudResponse<AppearancePanelConfig>> = async () => ({
    code: -1,
    msg: 'Server error',
  })
  const pushedPayloads: AppearancePanelConfig[] = []

  const controller = createPanelCloudController<AppearancePanelConfig>({
    getToken: () => token,
    getUserId: () => 2,
    createDefaultConfig: createDefaultTestConfig,
    fetchCloudConfig: () => nextGetResponse(),
    pushCloudConfig: async (panel) => {
      pushedPayloads.push(panel)
      return { code: 0 }
    },
  })

  // 1. Explicit no-record response (code -1 from ErrorDataNotFound) marks ready with defaults
  const firstLoad = await controller.loadFromCloud()
  assert.equal(firstLoad.ok, true)
  assert.equal(controller.state.cloudConfigState, 'ready')
  assert.equal(controller.canEdit(), true)

  // User customizes logoText in this valid session
  controller.setPanelConfig({
    ...controller.state.panelConfig,
    logoText: 'Keep Me On Error',
  })

  // 2. Subsequent cloud refresh fails with database error (code 1200) -> enters 'error', keeps existing valid config, blocks saves
  nextGetResponse = async () => ({
    code: 1200,
    msg: 'Server error[Database error]',
  })
  const failedLoad = await controller.loadFromCloud()
  assert.equal(failedLoad.ok, false)
  assert.equal(controller.state.cloudConfigState, 'error')
  assert.equal(controller.canEdit(), false)
  assert.equal(controller.state.panelConfig.logoText, 'Keep Me On Error')
  assert.equal(controller.applyPreset('ocean-glass'), false)
  const blockedSave = await controller.saveToCloud()
  assert.equal(blockedSave.ok, false)
  assert.equal(blockedSave.blocked, true)

  // 3. Network exception also stays in 'error' and blocks writes
  nextGetResponse = async () => {
    throw new Error('network down')
  }
  const networkFailedLoad = await controller.loadFromCloud()
  assert.equal(networkFailedLoad.ok, false)
  assert.equal(controller.state.cloudConfigState, 'error')
  assert.equal(controller.canEdit(), false)
  assert.equal(controller.state.panelConfig.logoText, 'Keep Me On Error')

  // 4. Retry succeeds -> unlocks editing and saving
  nextGetResponse = async () => ({
    code: 0,
    data: {
      panel: {
        logoText: 'Restored From Server',
        maxWidthUnit: 'px',
      },
    },
  })
  const retriedLoad = await controller.loadFromCloud()
  assert.equal(retriedLoad.ok, true)
  assert.equal(controller.state.cloudConfigState, 'ready')
  assert.equal(controller.canEdit(), true)
  assert.equal(controller.state.panelConfig.logoText, 'Restored From Server')
})

test('failed save retains dirty state for retry and only updates lastSyncedPanelJson on success', async () => {
  let shouldFailSave = true
  const pushedPayloads: AppearancePanelConfig[] = []

  const controller = createPanelCloudController<AppearancePanelConfig>({
    getToken: () => 'token-user-3',
    getUserId: () => 3,
    createDefaultConfig: createDefaultTestConfig,
    fetchCloudConfig: async () => ({ code: -1 }),
    pushCloudConfig: async (panel) => {
      pushedPayloads.push(panel)
      if (shouldFailSave)
        return { code: 1200, msg: 'Database error' }
      return { code: 0 }
    },
  })

  await controller.loadFromCloud()
  const initialSynced = controller.state.lastSyncedPanelJson
  assert.equal(shouldAutoSavePanelConfig(controller.state.panelConfig, controller.state.lastSyncedPanelJson), false)

  // Apply preset -> config is now dirty compared to lastSyncedPanelJson
  assert.equal(controller.applyPreset('ocean-glass'), true)
  assert.equal(shouldAutoSavePanelConfig(controller.state.panelConfig, controller.state.lastSyncedPanelJson), true)

  // First save fails -> lastSyncedPanelJson must NOT advance, config remains dirty for retry
  const failedSave = await controller.saveToCloud()
  assert.equal(failedSave.ok, false)
  assert.equal(failedSave.msg, 'Database error')
  assert.equal(controller.state.lastSyncedPanelJson, initialSynced)
  assert.equal(shouldAutoSavePanelConfig(controller.state.panelConfig, controller.state.lastSyncedPanelJson), true)

  // Retry save succeeds -> lastSyncedPanelJson advances and config is no longer dirty
  shouldFailSave = false
  const retrySave = await controller.saveToCloud()
  assert.equal(retrySave.ok, true)
  assert.notEqual(controller.state.lastSyncedPanelJson, initialSynced)
  assert.equal(shouldAutoSavePanelConfig(controller.state.panelConfig, controller.state.lastSyncedPanelJson), false)
  assert.equal(pushedPayloads.length, 2)
})

test('rapid consecutive saves serialize in order, skip superseded writes, and account switch invalidates in-flight GET and SET responses', async () => {
  let token = 'token-account-a'
  let userId: number | null = 10
  const firstSave = deferred<{ code: number; msg?: string }>()
  const secondSave = deferred<{ code: number; msg?: string }>()
  const pushedPayloads: Array<{ token: string; logoText?: string }> = []
  let saveCallCount = 0

  const pendingGetA = deferred<PanelCloudResponse<AppearancePanelConfig>>()
  const pendingGetB = deferred<PanelCloudResponse<AppearancePanelConfig>>()
  let getCallCount = 0

  const controller = createPanelCloudController<AppearancePanelConfig>({
    getToken: () => token,
    getUserId: () => userId,
    createDefaultConfig: createDefaultTestConfig,
    fetchCloudConfig: () => {
      getCallCount++
      return getCallCount === 1 ? pendingGetA.promise : pendingGetB.promise
    },
    pushCloudConfig: (panel) => {
      saveCallCount++
      pushedPayloads.push({ token, logoText: panel.logoText })
      return saveCallCount === 1 ? firstSave.promise : secondSave.promise
    },
  })

  // Hydrate account A
  const loadA = controller.loadFromCloud()
  pendingGetA.resolve({ code: 0, data: { panel: { logoText: 'Account A Initial', maxWidthUnit: 'px' } } })
  await loadA
  assert.equal(controller.canEdit(), true)

  // Rapid consecutive edits A1 then A2 while A1 save is in-flight
  controller.setPanelConfig({ ...controller.state.panelConfig, logoText: 'Edit 1' })
  const save1Promise = controller.saveToCloud()

  controller.setPanelConfig({ ...controller.state.panelConfig, logoText: 'Edit 2 (Final)' })
  const save2Promise = controller.saveToCloud()

  // Resolve first in-flight HTTP request
  firstSave.resolve({ code: 0 })
  const res1 = await save1Promise
  // save1 was superseded by save2 before it finished
  assert.equal(res1.ok, false)
  assert.equal(res1.stale, true)

  // Resolve second save
  secondSave.resolve({ code: 0 })
  const res2 = await save2Promise
  assert.equal(res2.ok, true)
  assert.equal(pushedPayloads[pushedPayloads.length - 1].logoText, 'Edit 2 (Final)')
  assert.equal(shouldAutoSavePanelConfig(controller.state.panelConfig, controller.state.lastSyncedPanelJson), false)

  // Now test account switch while an old GET or SET is in flight
  const staleGetA = deferred<PanelCloudResponse<AppearancePanelConfig>>()
  let capturedGetSessionCurrent: (() => boolean) | undefined
  let getUserIdCalledAtConstruction = false
  const controllerSwitch = createPanelCloudController<AppearancePanelConfig>({
    getToken: () => token,
    getUserId: () => {
      getUserIdCalledAtConstruction = true
      return userId
    },
    createDefaultConfig: createDefaultTestConfig,
    fetchCloudConfig: (sessionCurrent) => {
      capturedGetSessionCurrent = sessionCurrent
      return staleGetA.promise
    },
    pushCloudConfig: async () => ({ code: 0 }),
  })
  // Controller construction must be lazy and never invoke getUserId/Pinia before an action runs
  assert.equal(getUserIdCalledAtConstruction, false)

  const inFlightLoadA = controllerSwitch.loadFromCloud()
  assert.equal(controllerSwitch.state.cloudConfigState, 'loading')
  assert.equal(capturedGetSessionCurrent?.(), true)

  // Switch to Account B immediately
  token = 'token-account-b'
  userId = 20
  controllerSwitch.clearForAccountSwitch()
  assert.equal(controllerSwitch.state.cloudConfigState, 'idle')
  assert.equal(controllerSwitch.canEdit(), false)
  // sessionCurrent callback passed to the request layer must immediately report false so late 1000/1001 will not clear Account B session
  assert.equal(capturedGetSessionCurrent?.(), false)

  // Late response from Account A arrives -> must be ignored as stale and not unlock or overwrite Account B
  staleGetA.resolve({
    code: 0,
    data: { panel: { logoText: 'Leaked From Account A', maxWidthUnit: 'px' } },
  })
  const staleLoadResult = await inFlightLoadA
  assert.equal(staleLoadResult.ok, false)
  assert.equal(staleLoadResult.stale, true)
  assert.equal(controllerSwitch.state.cloudConfigState, 'idle')
  assert.equal(controllerSwitch.state.panelConfig.logoText, 'Leon Panel')
})
