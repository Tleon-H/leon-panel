export type AppearancePresetId = 'ocean-glass' | 'mist-paper' | 'midnight-graphite'
export type CardSurfacePresetId = 'default' | AppearancePresetId
export type IconBadgeStyleId = 'default' | 'glass' | 'soft' | 'outline'
export type WallpaperTone = 'dark' | 'light'

export interface AppearancePresetScopes {
  wallpaper: boolean
  cardStyle: boolean
  iconStyle: boolean
}

export interface AppearancePanelConfig {
  backgroundImageSrc?: string
  backgroundBlur?: number
  backgroundMaskNumber?: number
  wallpaperTone?: WallpaperTone
  cardSurface?: CardSurfacePresetId
  cardBackgroundColor?: string
  cardBorderColor?: string
  cardBlur?: number
  cardBorderRadius?: number
  cardAccentColor?: string
  iconStyle?: number
  iconBadgeStyle?: IconBadgeStyleId
  iconTextColor?: string
  iconTextInfoHideDescription?: boolean
  iconTextIconHideTitle?: boolean
  logoText?: string
  logoImageSrc?: string
  clockShowSecond?: boolean
  clockColor?: string
  searchBoxShow?: boolean
  searchBoxSearchIcon?: boolean
  marginTop?: number
  marginBottom?: number
  maxWidth?: number
  maxWidthUnit: string
  marginX?: number
  footerHtml?: string
  systemMonitorShow?: boolean
  systemMonitorShowTitle?: boolean
  systemMonitorPublicVisitModeShow?: boolean
  netModeChangeButtonShow?: boolean
}

export interface AppearancePresetDefinition {
  id: AppearancePresetId
  nameKey: string
  descKey: string
  swatch: {
    canvas: string
    card: string
    border: string
    text: string
    accent: string
  }
  wallpaper: {
    backgroundImageSrc: string
    backgroundBlur: number
    backgroundMaskNumber: number
    wallpaperTone: WallpaperTone
  }
  cardStyle: {
    cardSurface: AppearancePresetId
    cardBackgroundColor: string
    cardBorderColor: string
    cardBlur: number
    cardBorderRadius: number
    cardAccentColor: string
  }
  iconStyle: {
    iconStyle: 0 | 1
    iconBadgeStyle: IconBadgeStyleId
    iconTextColor: string
    iconTextInfoHideDescription: boolean
    iconTextIconHideTitle: boolean
  }
}

export interface CardSurfaceTokens {
  surface: CardSurfacePresetId
  backgroundColor: string
  borderColor: string
  blur: number
  borderRadius: number
  accentColor: string
  shadow: string
  hoverShadow: string
  hoverBorderColor: string
  defaultTextColor: string
  secondaryTextColor: string
  isLightCard: boolean
}

export interface HomepageThemeResolution {
  isLightCanvas: boolean
  isLightCard: boolean
  canvasFallback: string
  cardSurface: CardSurfacePresetId
  iconBadgeStyle: IconBadgeStyleId
  card: CardSurfaceTokens
  searchBackground: string
  searchTextColor: string
  controlBackground: string
  controlTextColor: string
  cssVars: Record<string, string>
}

export interface ResolvedCardAppearance {
  hasCustomBackground: boolean
  backgroundColor: string
  borderColor: string
  borderRadius: string
  backdropFilter: string
  textColor: string
  secondaryTextColor: string
  isLightSurface: boolean
  useTextShadow: boolean
}

export const LEGACY_DEFAULT_CARD_BG = '#2a2a2a6b'

export const DEFAULT_APPEARANCE_SCOPES: AppearancePresetScopes = {
  wallpaper: true,
  cardStyle: true,
  iconStyle: true,
}

export const APPEARANCE_PRESET_IDS: readonly AppearancePresetId[] = [
  'ocean-glass',
  'mist-paper',
  'midnight-graphite',
]

export const APPEARANCE_PRESETS: Record<AppearancePresetId, AppearancePresetDefinition> = {
  'ocean-glass': {
    id: 'ocean-glass',
    nameKey: 'apps.baseSettings.presets.oceanGlass.name',
    descKey: 'apps.baseSettings.presets.oceanGlass.desc',
    swatch: {
      canvas: 'linear-gradient(135deg, #051326 0%, #0b2c52 55%, #124676 100%)',
      card: 'rgba(15, 42, 74, 0.62)',
      border: 'rgba(147, 197, 253, 0.36)',
      text: '#f8fafc',
      accent: '#38bdf8',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/ocean-glass.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0.1,
      wallpaperTone: 'dark',
    },
    cardStyle: {
      cardSurface: 'ocean-glass',
      cardBackgroundColor: 'rgba(15, 42, 74, 0.56)',
      cardBorderColor: 'rgba(147, 197, 253, 0.28)',
      cardBlur: 14,
      cardBorderRadius: 18,
      cardAccentColor: '#38bdf8',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'glass',
      iconTextColor: '#f8fafc',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
    },
  },
  'mist-paper': {
    id: 'mist-paper',
    nameKey: 'apps.baseSettings.presets.mistPaper.name',
    descKey: 'apps.baseSettings.presets.mistPaper.desc',
    swatch: {
      canvas: 'linear-gradient(135deg, #f6f4ef 0%, #eff2f6 55%, #e5ebf1 100%)',
      card: 'rgba(255, 252, 246, 0.94)',
      border: 'rgba(148, 163, 184, 0.38)',
      text: '#1e293b',
      accent: '#0284c7',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/mist-paper.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0,
      wallpaperTone: 'light',
    },
    cardStyle: {
      cardSurface: 'mist-paper',
      cardBackgroundColor: 'rgba(255, 252, 246, 0.92)',
      cardBorderColor: 'rgba(148, 163, 184, 0.36)',
      cardBlur: 6,
      cardBorderRadius: 14,
      cardAccentColor: '#0284c7',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'soft',
      iconTextColor: '#1e293b',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
    },
  },
  'midnight-graphite': {
    id: 'midnight-graphite',
    nameKey: 'apps.baseSettings.presets.midnightGraphite.name',
    descKey: 'apps.baseSettings.presets.midnightGraphite.desc',
    swatch: {
      canvas: 'linear-gradient(135deg, #080a0f 0%, #101520 60%, #151e2c 100%)',
      card: 'rgba(17, 21, 28, 0.90)',
      border: 'rgba(34, 211, 238, 0.28)',
      text: '#f1f5f9',
      accent: '#22d3ee',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/midnight-graphite.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0.15,
      wallpaperTone: 'dark',
    },
    cardStyle: {
      cardSurface: 'midnight-graphite',
      cardBackgroundColor: 'rgba(17, 21, 28, 0.88)',
      cardBorderColor: 'rgba(56, 189, 248, 0.26)',
      cardBlur: 10,
      cardBorderRadius: 14,
      cardAccentColor: '#22d3ee',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'outline',
      iconTextColor: '#f1f5f9',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
    },
  },
}

const SURFACE_DEFAULTS: Record<CardSurfacePresetId, CardSurfaceTokens> = {
  'default': {
    surface: 'default',
    backgroundColor: LEGACY_DEFAULT_CARD_BG,
    borderColor: 'transparent',
    blur: 0,
    borderRadius: 16,
    accentColor: '#7dd3fc',
    shadow: 'none',
    hoverShadow: '0 0 20px 10px rgba(0, 0, 0, 0.2)',
    hoverBorderColor: 'transparent',
    defaultTextColor: '#ffffff',
    secondaryTextColor: 'rgba(255, 255, 255, 0.86)',
    isLightCard: false,
  },
  'ocean-glass': {
    surface: 'ocean-glass',
    backgroundColor: 'rgba(15, 42, 74, 0.56)',
    borderColor: 'rgba(147, 197, 253, 0.28)',
    blur: 14,
    borderRadius: 18,
    accentColor: '#38bdf8',
    shadow: '0 10px 28px rgba(2, 12, 27, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
    hoverShadow: '0 14px 32px rgba(2, 18, 40, 0.38), 0 0 0 1px rgba(56, 189, 248, 0.45)',
    hoverBorderColor: 'rgba(56, 189, 248, 0.58)',
    defaultTextColor: '#f8fafc',
    secondaryTextColor: 'rgba(226, 232, 240, 0.88)',
    isLightCard: false,
  },
  'mist-paper': {
    surface: 'mist-paper',
    backgroundColor: 'rgba(255, 252, 246, 0.92)',
    borderColor: 'rgba(148, 163, 184, 0.36)',
    blur: 6,
    borderRadius: 14,
    accentColor: '#0284c7',
    shadow: '0 4px 16px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.75)',
    hoverShadow: '0 10px 24px rgba(15, 23, 42, 0.13), 0 0 0 1px rgba(2, 132, 199, 0.28)',
    hoverBorderColor: 'rgba(2, 132, 199, 0.48)',
    defaultTextColor: '#1e293b',
    secondaryTextColor: '#475569',
    isLightCard: true,
  },
  'midnight-graphite': {
    surface: 'midnight-graphite',
    backgroundColor: 'rgba(17, 21, 28, 0.88)',
    borderColor: 'rgba(56, 189, 248, 0.26)',
    blur: 10,
    borderRadius: 14,
    accentColor: '#22d3ee',
    shadow: '0 8px 24px rgba(2, 6, 23, 0.46), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    hoverShadow: '0 12px 28px rgba(2, 6, 23, 0.6), 0 0 0 1px rgba(34, 211, 238, 0.42)',
    hoverBorderColor: 'rgba(34, 211, 238, 0.65)',
    defaultTextColor: '#f1f5f9',
    secondaryTextColor: '#cbd5e1',
    isLightCard: false,
  },
}

export function isAppearancePresetId(value: unknown): value is AppearancePresetId {
  return value === 'ocean-glass' || value === 'mist-paper' || value === 'midnight-graphite'
}

export function isCardSurfacePresetId(value: unknown): value is CardSurfacePresetId {
  return value === 'default' || isAppearancePresetId(value)
}

export function isIconBadgeStyleId(value: unknown): value is IconBadgeStyleId {
  return value === 'default' || value === 'glass' || value === 'soft' || value === 'outline'
}

export function isWallpaperTone(value: unknown): value is WallpaperTone {
  return value === 'dark' || value === 'light'
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = (typeof value === 'string' && value.trim() !== '') ? Number(value) : value
  if (typeof num !== 'number' || !Number.isFinite(num))
    return fallback
  return Math.min(max, Math.max(min, num))
}

export function isLegacyDefaultCardBackground(color?: string | null): boolean {
  if (!color)
    return true
  const normalized = color.trim().toLowerCase()
  return normalized === '' || normalized === LEGACY_DEFAULT_CARD_BG
}

export function normalizeScopes(scopes?: Partial<AppearancePresetScopes> | null): AppearancePresetScopes {
  return {
    wallpaper: scopes?.wallpaper ?? DEFAULT_APPEARANCE_SCOPES.wallpaper,
    cardStyle: scopes?.cardStyle ?? DEFAULT_APPEARANCE_SCOPES.cardStyle,
    iconStyle: scopes?.iconStyle ?? DEFAULT_APPEARANCE_SCOPES.iconStyle,
  }
}

export function hasSelectedScope(scopes: AppearancePresetScopes): boolean {
  return scopes.wallpaper || scopes.cardStyle || scopes.iconStyle
}

export function normalizePanelAppearance<T extends AppearancePanelConfig>(config: T): T {
  const surface: CardSurfacePresetId = isCardSurfacePresetId(config.cardSurface) ? config.cardSurface : 'default'
  const surfaceDefaults = SURFACE_DEFAULTS[surface]
  const inferredTone: WallpaperTone = isWallpaperTone(config.wallpaperTone)
    ? config.wallpaperTone
    : (config.backgroundImageSrc?.includes('/assets/wallpapers/mist-paper.svg') ? 'light' : 'dark')
  const iconBadgeStyle: IconBadgeStyleId = isIconBadgeStyleId(config.iconBadgeStyle) ? config.iconBadgeStyle : 'default'

  const cardBlur = config.cardBlur === undefined
    ? surfaceDefaults.blur
    : clampNumber(config.cardBlur, 0, 24, surfaceDefaults.blur)
  const cardBorderRadius = config.cardBorderRadius === undefined
    ? surfaceDefaults.borderRadius
    : clampNumber(config.cardBorderRadius, 8, 24, surfaceDefaults.borderRadius)

  return {
    ...config,
    wallpaperTone: inferredTone,
    cardSurface: surface,
    cardBackgroundColor: (typeof config.cardBackgroundColor === 'string' && config.cardBackgroundColor.trim() !== '')
      ? config.cardBackgroundColor
      : surfaceDefaults.backgroundColor,
    cardBorderColor: (typeof config.cardBorderColor === 'string' && config.cardBorderColor.trim() !== '')
      ? config.cardBorderColor
      : surfaceDefaults.borderColor,
    cardBlur,
    cardBorderRadius,
    cardAccentColor: (typeof config.cardAccentColor === 'string' && config.cardAccentColor.trim() !== '')
      ? config.cardAccentColor
      : surfaceDefaults.accentColor,
    iconBadgeStyle,
  }
}

export function applyAppearancePreset<T extends AppearancePanelConfig>(
  current: T,
  presetId: AppearancePresetId,
  rawScopes?: Partial<AppearancePresetScopes>,
): T {
  const scopes = normalizeScopes(rawScopes)
  const preset = APPEARANCE_PRESETS[presetId]
  const next: T = { ...current }

  if (!hasSelectedScope(scopes))
    return next

  if (scopes.wallpaper) {
    next.backgroundImageSrc = preset.wallpaper.backgroundImageSrc
    next.backgroundBlur = preset.wallpaper.backgroundBlur
    next.backgroundMaskNumber = preset.wallpaper.backgroundMaskNumber
    next.wallpaperTone = preset.wallpaper.wallpaperTone
  }

  if (scopes.cardStyle) {
    next.cardSurface = preset.cardStyle.cardSurface
    next.cardBackgroundColor = preset.cardStyle.cardBackgroundColor
    next.cardBorderColor = preset.cardStyle.cardBorderColor
    next.cardBlur = preset.cardStyle.cardBlur
    next.cardBorderRadius = preset.cardStyle.cardBorderRadius
    next.cardAccentColor = preset.cardStyle.cardAccentColor
  }

  if (scopes.iconStyle) {
    next.iconStyle = preset.iconStyle.iconStyle
    next.iconBadgeStyle = preset.iconStyle.iconBadgeStyle
    next.iconTextColor = preset.iconStyle.iconTextColor
    next.iconTextInfoHideDescription = preset.iconStyle.iconTextInfoHideDescription
    next.iconTextIconHideTitle = preset.iconStyle.iconTextIconHideTitle
  }

  return normalizePanelAppearance(next)
}

export function applyCardSurfaceDefaults<T extends AppearancePanelConfig>(
  current: T,
  surface: CardSurfacePresetId,
): T {
  const tokens = SURFACE_DEFAULTS[surface]
  return normalizePanelAppearance({
    ...current,
    cardSurface: surface,
    cardBackgroundColor: tokens.backgroundColor,
    cardBorderColor: tokens.borderColor,
    cardBlur: tokens.blur,
    cardBorderRadius: tokens.borderRadius,
    cardAccentColor: tokens.accentColor,
  })
}

export interface ParsedRgba {
  r: number
  g: number
  b: number
  a: number
}

export function parseCssColor(color?: string | null): ParsedRgba | null {
  if (!color)
    return null
  const value = color.trim().toLowerCase()
  if (!value || value === 'transparent')
    return { r: 0, g: 0, b: 0, a: 0 }

  if (value === 'white')
    return { r: 255, g: 255, b: 255, a: 1 }
  if (value === 'black')
    return { r: 0, g: 0, b: 0, a: 1 }

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)
  if (hexMatch) {
    const hex = hexMatch[1]
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16)
      const g = parseInt(hex[1] + hex[1], 16)
      const b = parseInt(hex[2] + hex[2], 16)
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1
      return { r, g, b, a }
    }
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    return { r, g, b, a }
  }

  const rgbMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value)
  if (rgbMatch) {
    return {
      r: clampNumber(Number(rgbMatch[1]), 0, 255, 0),
      g: clampNumber(Number(rgbMatch[2]), 0, 255, 0),
      b: clampNumber(Number(rgbMatch[3]), 0, 255, 0),
      a: rgbMatch[4] === undefined ? 1 : clampNumber(Number(rgbMatch[4]), 0, 1, 1),
    }
  }

  return null
}

function compositeOver(fg: ParsedRgba, bg: ParsedRgba): ParsedRgba {
  const alpha = clampNumber(fg.a, 0, 1, 1)
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
    a: 1,
  }
}

export function relativeLuminance(color: ParsedRgba): number {
  const toLinear = (channel: number) => {
    const s = channel / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b)
}

export function contrastRatio(foregroundColor: string, backgroundColor: string, canvasFallback = '#0b192c'): number {
  const fg = parseCssColor(foregroundColor)
  const bgRaw = parseCssColor(backgroundColor)
  const canvas = parseCssColor(canvasFallback) ?? { r: 11, g: 25, b: 44, a: 1 }
  if (!fg || !bgRaw)
    return 1
  const bg = bgRaw.a < 1 ? compositeOver(bgRaw, canvas) : bgRaw
  const effectiveFg = fg.a < 1 ? compositeOver(fg, bg) : fg
  const l1 = relativeLuminance(effectiveFg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function isLightColor(color?: string | null, canvasFallback = '#111827'): boolean {
  const parsed = parseCssColor(color)
  if (!parsed)
    return false
  const canvas = parseCssColor(canvasFallback) ?? { r: 17, g: 24, b: 39, a: 1 }
  const effective = parsed.a < 1 ? compositeOver(parsed, canvas) : parsed
  // WCAG 2.1 exact perceptual midpoint where dark and light text have equal contrast (~0.1791)
  return relativeLuminance(effective) > 0.179
}

export function pickReadableTextColor(
  backgroundColor: string,
  canvasFallback = '#111827',
  darkCandidate = '#0f172a',
  lightCandidate = '#f8fafc',
): string {
  const darkRatio = contrastRatio(darkCandidate, backgroundColor, canvasFallback)
  const lightRatio = contrastRatio(lightCandidate, backgroundColor, canvasFallback)
  return darkRatio >= lightRatio ? darkCandidate : lightCandidate
}

export function resolveIconForegroundColor(
  iconBackground?: string | null,
  canvasFallback = '#111827',
): string {
  const effectiveBg = (iconBackground && iconBackground.trim() !== '' && iconBackground.trim().toLowerCase() !== 'transparent')
    ? iconBackground
    : canvasFallback
  const candidate = pickReadableTextColor(effectiveBg, canvasFallback, '#1e293b', '#f8fafc')
  if (contrastRatio(candidate, effectiveBg, canvasFallback) >= 4.5)
    return candidate
  return pickReadableTextColor(effectiveBg, canvasFallback, '#0f172a', '#ffffff')
}

export function resolveHomepageThemeVars(rawConfig: AppearancePanelConfig): HomepageThemeResolution {
  const config = normalizePanelAppearance(rawConfig)
  const surface = config.cardSurface ?? 'default'
  const base = SURFACE_DEFAULTS[surface]
  const isLightCanvas = config.wallpaperTone === 'light'
  const canvasFallback = isLightCanvas
    ? '#eef2f5'
    : surface === 'ocean-glass'
      ? '#071b34'
      : surface === 'midnight-graphite'
        ? '#0a0d14'
        : '#363636'

  const backgroundColor = config.cardBackgroundColor || base.backgroundColor
  const borderColor = config.cardBorderColor || base.borderColor
  const blur = config.cardBlur ?? base.blur
  const borderRadius = config.cardBorderRadius ?? base.borderRadius
  const accentColor = config.cardAccentColor || base.accentColor
  const isLightCard = isLightColor(backgroundColor, canvasFallback)

  const card: CardSurfaceTokens = {
    surface,
    backgroundColor,
    borderColor,
    blur,
    borderRadius,
    accentColor,
    shadow: base.shadow,
    hoverShadow: base.hoverShadow,
    hoverBorderColor: base.hoverBorderColor,
    defaultTextColor: isLightCard ? '#1e293b' : '#f8fafc',
    secondaryTextColor: isLightCard ? '#475569' : 'rgba(226, 232, 240, 0.86)',
    isLightCard,
  }

  const chromeTextColor = isLightCanvas ? '#0f172a' : '#ffffff'
  const chromeMutedColor = isLightCanvas ? '#475569' : 'rgba(241, 245, 249, 0.85)'
  const chromeTextShadow = isLightCanvas ? 'none' : '0 2px 16px rgba(0, 0, 0, 0.55)'
  const smallTitleShadow = isLightCanvas ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.88)'

  const searchBackground = isLightCard
    ? 'rgba(255, 252, 246, 0.94)'
    : surface === 'ocean-glass'
      ? 'rgba(15, 42, 74, 0.62)'
      : surface === 'midnight-graphite'
        ? 'rgba(17, 21, 28, 0.90)'
        : isLightCanvas
          ? 'rgba(255, 252, 246, 0.90)'
          : LEGACY_DEFAULT_CARD_BG

  const searchIsLight = isLightColor(searchBackground, canvasFallback)
  const searchTextColor = searchIsLight ? '#0f172a' : '#f8fafc'
  const searchBorderColor = searchIsLight
    ? 'rgba(148, 163, 184, 0.52)'
    : surface === 'midnight-graphite'
      ? 'rgba(56, 189, 248, 0.34)'
      : surface === 'ocean-glass'
        ? 'rgba(147, 197, 253, 0.36)'
        : 'rgba(255, 255, 255, 0.42)'
  const searchPlaceholderColor = searchIsLight ? '#64748b' : 'rgba(241, 245, 249, 0.78)'

  const controlBackground = isLightCanvas
    ? 'rgba(255, 252, 246, 0.92)'
    : surface === 'ocean-glass'
      ? 'rgba(15, 42, 74, 0.72)'
      : surface === 'midnight-graphite'
        ? 'rgba(17, 21, 28, 0.88)'
        : LEGACY_DEFAULT_CARD_BG
  const controlTextColor = isLightCanvas ? '#1e293b' : '#ffffff'
  const controlBorderColor = isLightCanvas
    ? 'rgba(148, 163, 184, 0.46)'
    : surface === 'midnight-graphite'
      ? 'rgba(56, 189, 248, 0.32)'
      : surface === 'ocean-glass'
        ? 'rgba(147, 197, 253, 0.32)'
        : 'rgba(255, 255, 255, 0.16)'

  const iconBadgeStyle = config.iconBadgeStyle ?? 'default'

  const cssVars: Record<string, string> = {
    '--leon-canvas-fallback': canvasFallback,
    '--leon-chrome-text': chromeTextColor,
    '--leon-chrome-muted': chromeMutedColor,
    '--leon-chrome-shadow': chromeTextShadow,
    '--leon-small-title-shadow': smallTitleShadow,
    '--leon-card-bg': card.backgroundColor,
    '--leon-card-border': card.borderColor,
    '--leon-card-hover-border': card.hoverBorderColor,
    '--leon-card-blur': `${card.blur}px`,
    '--leon-card-radius': `${card.borderRadius}px`,
    '--leon-card-shadow': card.shadow,
    '--leon-card-hover-shadow': card.hoverShadow,
    '--leon-card-text': card.defaultTextColor,
    '--leon-card-text-secondary': card.secondaryTextColor,
    '--leon-accent-color': card.accentColor,
    '--leon-search-bg': searchBackground,
    '--leon-search-text': searchTextColor,
    '--leon-search-border': searchBorderColor,
    '--leon-search-placeholder': searchPlaceholderColor,
    '--leon-control-bg': controlBackground,
    '--leon-control-text': controlTextColor,
    '--leon-control-border': controlBorderColor,
  }

  return {
    isLightCanvas,
    isLightCard,
    canvasFallback,
    cardSurface: surface,
    iconBadgeStyle,
    card,
    searchBackground,
    searchTextColor,
    controlBackground,
    controlTextColor,
    cssVars,
  }
}

export function resolveCardAppearance(
  rawConfig: AppearancePanelConfig,
  itemIcon?: { backgroundColor?: string } | null,
): ResolvedCardAppearance {
  const theme = resolveHomepageThemeVars(rawConfig)
  const hasCustomBackground = !isLegacyDefaultCardBackground(itemIcon?.backgroundColor)
  const backgroundColor = hasCustomBackground
    ? (itemIcon?.backgroundColor as string)
    : theme.card.backgroundColor
  const isLightSurface = isLightColor(backgroundColor, theme.canvasFallback)

  const configuredText = rawConfig.iconTextColor?.trim()
  const isDefaultWhite = !configuredText || configuredText.toLowerCase() === '#ffffff' || configuredText.toLowerCase() === '#fff'
  const fallbackPrimary = pickReadableTextColor(backgroundColor, theme.canvasFallback, '#1e293b', '#f8fafc')
  const safePrimary = contrastRatio(fallbackPrimary, backgroundColor, theme.canvasFallback) >= 4.5
    ? fallbackPrimary
    : pickReadableTextColor(backgroundColor, theme.canvasFallback, '#0f172a', '#ffffff')

  let textColor: string
  if (isDefaultWhite) {
    textColor = safePrimary
  }
  else {
    // Preserve explicit custom text color unless contrast against the actual card surface drops below WCAG AA (4.5:1)
    const ratio = contrastRatio(configuredText, backgroundColor, theme.canvasFallback)
    textColor = ratio < 4.5 ? safePrimary : configuredText
  }

  const textIsDark = !isLightColor(textColor, backgroundColor)
  let secondaryTextColor = textIsDark ? '#475569' : '#e2e8f0'
  if (contrastRatio(secondaryTextColor, backgroundColor, theme.canvasFallback) < 4.5)
    secondaryTextColor = textIsDark ? '#1e293b' : '#f8fafc'
  if (contrastRatio(secondaryTextColor, backgroundColor, theme.canvasFallback) < 4.5)
    secondaryTextColor = safePrimary

  return {
    hasCustomBackground,
    backgroundColor,
    borderColor: hasCustomBackground ? 'rgba(255, 255, 255, 0.16)' : theme.card.borderColor,
    borderRadius: `${theme.card.borderRadius}px`,
    backdropFilter: (!hasCustomBackground && theme.card.blur > 0) ? `blur(${theme.card.blur}px)` : 'none',
    textColor,
    secondaryTextColor,
    isLightSurface,
    useTextShadow: !textIsDark && !isLightSurface,
  }
}

export function resolveSmallTitleColor(rawConfig: AppearancePanelConfig): string {
  const theme = resolveHomepageThemeVars(rawConfig)
  const fallback = theme.isLightCanvas ? '#1e293b' : '#f8fafc'
  const configured = rawConfig.iconTextColor?.trim()
  const isDefaultWhite = !configured || configured.toLowerCase() === '#ffffff' || configured.toLowerCase() === '#fff'

  if (isDefaultWhite)
    return fallback

  // Bidirectional contrast check against the actual wallpaper tone/canvas:
  // protects dark text on dark wallpaper AND light text on light wallpaper.
  const ratio = contrastRatio(configured, theme.canvasFallback)
  if (ratio < 4.5)
    return fallback

  return configured
}

export function serializePanelConfig(config: AppearancePanelConfig): string {
  const normalized = normalizePanelAppearance(config)
  const sortedKeys = Object.keys(normalized).sort()
  const canonical: Record<string, unknown> = {}
  for (const key of sortedKeys)
    canonical[key] = (normalized as unknown as Record<string, unknown>)[key]
  return JSON.stringify(canonical)
}

export function shouldAutoSavePanelConfig(
  currentConfig: AppearancePanelConfig,
  lastSyncedJson: string | null,
): boolean {
  if (!lastSyncedJson)
    return true
  return serializePanelConfig(currentConfig) !== lastSyncedJson
}

export function isPanelStateOwnedByAccount(
  storedOwnerUserId: unknown,
  activeUserId: unknown,
): boolean {
  const storedId = (typeof storedOwnerUserId === 'number' && Number.isInteger(storedOwnerUserId) && storedOwnerUserId > 0)
    ? storedOwnerUserId
    : null
  const currentId = (typeof activeUserId === 'number' && Number.isInteger(activeUserId) && activeUserId > 0)
    ? activeUserId
    : null

  if (storedId === null)
    return currentId === null
  return storedId === currentId
}
