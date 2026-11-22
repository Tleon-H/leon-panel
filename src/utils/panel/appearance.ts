export type AppearancePresetId =
  | 'bauhaus-grid'
  | 'swiss-paper'
  | 'mono-ink'
  | 'blueprint-slate'
  | 'nordic-stone'
  | 'ocean-glass'
  | 'mist-paper'
  | 'midnight-graphite'
export type CardSurfacePresetId = 'default' | AppearancePresetId
export type IconBadgeStyleId = 'default' | 'bauhaus' | 'glass' | 'soft' | 'outline'
export type PanelLayoutMode = 'standard' | 'compact' | 'dock'
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
  layoutMode?: PanelLayoutMode
  iconStyle?: number
  iconBadgeStyle?: IconBadgeStyleId
  iconMonochrome?: boolean
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
    iconMonochrome?: boolean
  }
}

export interface CardSurfaceTokens {
  surface: CardSurfacePresetId
  backgroundColor: string
  borderColor: string
  borderWidth: string
  blur: number
  borderRadius: number
  accentColor: string
  shadow: string
  hoverShadow: string
  hoverBorderColor: string
  defaultTextColor: string
  secondaryTextColor: string
  isLightCard: boolean
  isFlatGeometric?: boolean
}

export interface HomepageThemeResolution {
  isLightCanvas: boolean
  isLightCard: boolean
  canvasFallback: string
  cardSurface: CardSurfacePresetId
  iconBadgeStyle: IconBadgeStyleId
  iconBadgeBackground: string
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
  'bauhaus-grid',
  'swiss-paper',
  'mono-ink',
  'blueprint-slate',
  'nordic-stone',
  'ocean-glass',
  'mist-paper',
  'midnight-graphite',
]

export const APPEARANCE_PRESETS: Record<AppearancePresetId, AppearancePresetDefinition> = {
  'bauhaus-grid': {
    id: 'bauhaus-grid',
    nameKey: 'apps.baseSettings.presets.bauhausGrid.name',
    descKey: 'apps.baseSettings.presets.bauhausGrid.desc',
    swatch: {
      canvas: '#f4f1ea',
      card: '#ffffff',
      border: '#18181b',
      text: '#09090b',
      accent: '#ff4f00',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/bauhaus-grid.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0,
      wallpaperTone: 'light',
    },
    cardStyle: {
      cardSurface: 'bauhaus-grid',
      cardBackgroundColor: '#ffffff',
      cardBorderColor: '#18181b',
      cardBlur: 0,
      cardBorderRadius: 0,
      cardAccentColor: '#ff4f00',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'bauhaus',
      iconTextColor: '#09090b',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
      iconMonochrome: false,
    },
  },
  'swiss-paper': {
    id: 'swiss-paper',
    nameKey: 'apps.baseSettings.presets.swissPaper.name',
    descKey: 'apps.baseSettings.presets.swissPaper.desc',
    swatch: {
      canvas: '#f5f5f3',
      card: '#ffffff',
      border: '#d4d4d8',
      text: '#09090b',
      accent: '#2563eb',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/swiss-paper.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0,
      wallpaperTone: 'light',
    },
    cardStyle: {
      cardSurface: 'swiss-paper',
      cardBackgroundColor: '#ffffff',
      cardBorderColor: '#d4d4d8',
      cardBlur: 0,
      cardBorderRadius: 4,
      cardAccentColor: '#2563eb',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'bauhaus',
      iconTextColor: '#09090b',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
      iconMonochrome: false,
    },
  },
  'mono-ink': {
    id: 'mono-ink',
    nameKey: 'apps.baseSettings.presets.monoInk.name',
    descKey: 'apps.baseSettings.presets.monoInk.desc',
    swatch: {
      canvas: '#09090b',
      card: '#121215',
      border: '#27272a',
      text: '#fafafa',
      accent: '#ff4f00',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/mono-ink.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0,
      wallpaperTone: 'dark',
    },
    cardStyle: {
      cardSurface: 'mono-ink',
      cardBackgroundColor: '#121215',
      cardBorderColor: '#27272a',
      cardBlur: 0,
      cardBorderRadius: 4,
      cardAccentColor: '#ff4f00',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'bauhaus',
      iconTextColor: '#fafafa',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
      iconMonochrome: false,
    },
  },
  'blueprint-slate': {
    id: 'blueprint-slate',
    nameKey: 'apps.baseSettings.presets.blueprintSlate.name',
    descKey: 'apps.baseSettings.presets.blueprintSlate.desc',
    swatch: {
      canvas: '#0c1220',
      card: '#11192b',
      border: '#23314b',
      text: '#f1f5f9',
      accent: '#00c2a8',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/blueprint-slate.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0,
      wallpaperTone: 'dark',
    },
    cardStyle: {
      cardSurface: 'blueprint-slate',
      cardBackgroundColor: '#11192b',
      cardBorderColor: '#23314b',
      cardBlur: 0,
      cardBorderRadius: 2,
      cardAccentColor: '#00c2a8',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'bauhaus',
      iconTextColor: '#f1f5f9',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
      iconMonochrome: false,
    },
  },
  'nordic-stone': {
    id: 'nordic-stone',
    nameKey: 'apps.baseSettings.presets.nordicStone.name',
    descKey: 'apps.baseSettings.presets.nordicStone.desc',
    swatch: {
      canvas: '#eceef0',
      card: '#ffffff',
      border: '#cbd5e1',
      text: '#111827',
      accent: '#0f766e',
    },
    wallpaper: {
      backgroundImageSrc: '/assets/wallpapers/nordic-stone.svg',
      backgroundBlur: 0,
      backgroundMaskNumber: 0,
      wallpaperTone: 'light',
    },
    cardStyle: {
      cardSurface: 'nordic-stone',
      cardBackgroundColor: '#ffffff',
      cardBorderColor: '#cbd5e1',
      cardBlur: 0,
      cardBorderRadius: 6,
      cardAccentColor: '#0f766e',
    },
    iconStyle: {
      iconStyle: 0,
      iconBadgeStyle: 'bauhaus',
      iconTextColor: '#111827',
      iconTextInfoHideDescription: false,
      iconTextIconHideTitle: false,
      iconMonochrome: false,
    },
  },
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
    borderWidth: '1px',
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
  'bauhaus-grid': {
    surface: 'bauhaus-grid',
    backgroundColor: '#ffffff',
    borderColor: '#18181b',
    borderWidth: '1.5px',
    blur: 0,
    borderRadius: 0,
    accentColor: '#ff4f00',
    shadow: 'none',
    hoverShadow: '4px 4px 0 0 #09090b',
    hoverBorderColor: '#ff4f00',
    defaultTextColor: '#09090b',
    secondaryTextColor: '#52525b',
    isLightCard: true,
    isFlatGeometric: true,
  },
  'swiss-paper': {
    surface: 'swiss-paper',
    backgroundColor: '#ffffff',
    borderColor: '#d4d4d8',
    borderWidth: '1px',
    blur: 0,
    borderRadius: 4,
    accentColor: '#2563eb',
    shadow: 'none',
    hoverShadow: '3px 3px 0 0 #09090b',
    hoverBorderColor: '#09090b',
    defaultTextColor: '#09090b',
    secondaryTextColor: '#52525b',
    isLightCard: true,
    isFlatGeometric: true,
  },
  'mono-ink': {
    surface: 'mono-ink',
    backgroundColor: '#121215',
    borderColor: '#27272a',
    borderWidth: '1px',
    blur: 0,
    borderRadius: 4,
    accentColor: '#ff4f00',
    shadow: 'none',
    hoverShadow: '3px 3px 0 0 #ff4f00',
    hoverBorderColor: '#ff4f00',
    defaultTextColor: '#fafafa',
    secondaryTextColor: '#a1a1aa',
    isLightCard: false,
    isFlatGeometric: true,
  },
  'blueprint-slate': {
    surface: 'blueprint-slate',
    backgroundColor: '#11192b',
    borderColor: '#23314b',
    borderWidth: '1px',
    blur: 0,
    borderRadius: 2,
    accentColor: '#00c2a8',
    shadow: 'none',
    hoverShadow: '3px 3px 0 0 #00c2a8',
    hoverBorderColor: '#00c2a8',
    defaultTextColor: '#f1f5f9',
    secondaryTextColor: '#94a3b8',
    isLightCard: false,
    isFlatGeometric: true,
  },
  'nordic-stone': {
    surface: 'nordic-stone',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: '1px',
    blur: 0,
    borderRadius: 6,
    accentColor: '#0f766e',
    shadow: 'none',
    hoverShadow: '3px 3px 0 0 #0f766e',
    hoverBorderColor: '#0f766e',
    defaultTextColor: '#111827',
    secondaryTextColor: '#4b5563',
    isLightCard: true,
    isFlatGeometric: true,
  },
  'ocean-glass': {
    surface: 'ocean-glass',
    backgroundColor: 'rgba(15, 42, 74, 0.56)',
    borderColor: 'rgba(147, 197, 253, 0.28)',
    borderWidth: '1px',
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
    borderWidth: '1px',
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
    borderWidth: '1px',
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
  return value === 'bauhaus-grid'
    || value === 'swiss-paper'
    || value === 'mono-ink'
    || value === 'blueprint-slate'
    || value === 'nordic-stone'
    || value === 'ocean-glass'
    || value === 'mist-paper'
    || value === 'midnight-graphite'
}

export function isFlatGeometricSurface(surface?: CardSurfacePresetId | null): boolean {
  return surface === 'bauhaus-grid'
    || surface === 'swiss-paper'
    || surface === 'mono-ink'
    || surface === 'blueprint-slate'
    || surface === 'nordic-stone'
}

export function isPanelLayoutMode(value: unknown): value is PanelLayoutMode {
  return value === 'standard' || value === 'compact' || value === 'dock'
}

export function isCardSurfacePresetId(value: unknown): value is CardSurfacePresetId {
  return value === 'default' || isAppearancePresetId(value)
}

export function isIconBadgeStyleId(value: unknown): value is IconBadgeStyleId {
  return value === 'default' || value === 'bauhaus' || value === 'glass' || value === 'soft' || value === 'outline'
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

export function inferWallpaperToneFromSrc(src?: string | null): WallpaperTone {
  if (!src)
    return 'dark'
  const trimmed = src.trim()
  for (const id of APPEARANCE_PRESET_IDS) {
    const preset = APPEARANCE_PRESETS[id]
    if (trimmed === preset.wallpaper.backgroundImageSrc || trimmed.endsWith(preset.wallpaper.backgroundImageSrc))
      return preset.wallpaper.wallpaperTone
  }
  return 'dark'
}

export function applyWallpaperSource<T extends AppearancePanelConfig>(
  current: T,
  backgroundImageSrc: string,
): T {
  return normalizePanelAppearance({
    ...current,
    backgroundImageSrc,
    wallpaperTone: inferWallpaperToneFromSrc(backgroundImageSrc),
  })
}

export function isPresetTextProtectionActive(rawConfig: AppearancePanelConfig): boolean {
  if (isWallpaperTone(rawConfig.wallpaperTone))
    return true
  if (isAppearancePresetId(rawConfig.cardSurface))
    return true
  if (isIconBadgeStyleId(rawConfig.iconBadgeStyle) && rawConfig.iconBadgeStyle !== 'default')
    return true
  const src = rawConfig.backgroundImageSrc?.trim() ?? ''
  for (const id of APPEARANCE_PRESET_IDS) {
    if (src.endsWith(APPEARANCE_PRESETS[id].wallpaper.backgroundImageSrc))
      return true
  }
  return false
}

export function normalizePanelAppearance<T extends AppearancePanelConfig>(config: T): T {
  const surface: CardSurfacePresetId = isCardSurfacePresetId(config.cardSurface) ? config.cardSurface : 'default'
  const surfaceDefaults = SURFACE_DEFAULTS[surface]
  const explicitTone: WallpaperTone | undefined = isWallpaperTone(config.wallpaperTone)
    ? config.wallpaperTone
    : undefined
  const iconBadgeStyle: IconBadgeStyleId = isIconBadgeStyleId(config.iconBadgeStyle) ? config.iconBadgeStyle : 'default'

  const cardBlur = config.cardBlur === undefined
    ? surfaceDefaults.blur
    : clampNumber(config.cardBlur, 0, 24, surfaceDefaults.blur)
  const cardBorderRadius = config.cardBorderRadius === undefined
    ? surfaceDefaults.borderRadius
    : clampNumber(config.cardBorderRadius, 0, 24, surfaceDefaults.borderRadius)

  const normalized: T = {
    ...config,
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
  if (typeof config.iconMonochrome === 'boolean')
    normalized.iconMonochrome = config.iconMonochrome
  if (isPanelLayoutMode(config.layoutMode))
    normalized.layoutMode = config.layoutMode
  if (explicitTone)
    normalized.wallpaperTone = explicitTone
  else
    delete normalized.wallpaperTone
  return normalized
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
    if (preset.iconStyle.iconMonochrome !== undefined)
      next.iconMonochrome = preset.iconStyle.iconMonochrome
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
  const strongCandidate = pickReadableTextColor(effectiveBg, canvasFallback, '#0f172a', '#ffffff')
  if (contrastRatio(strongCandidate, effectiveBg, canvasFallback) >= 4.5)
    return strongCandidate
  return pickReadableTextColor(effectiveBg, canvasFallback, '#000000', '#ffffff')
}

export function resolveHomepageThemeVars(rawConfig: AppearancePanelConfig): HomepageThemeResolution {
  const config = normalizePanelAppearance(rawConfig)
  const surface = config.cardSurface ?? 'default'
  const base = SURFACE_DEFAULTS[surface]
  const effectiveTone = config.wallpaperTone ?? inferWallpaperToneFromSrc(config.backgroundImageSrc)
  const isLightCanvas = effectiveTone === 'light'
  const isFlat = isFlatGeometricSurface(surface)
  const canvasFallback = isLightCanvas
    ? surface === 'bauhaus-grid'
      ? '#f4f1ea'
      : surface === 'swiss-paper'
        ? '#f5f5f3'
        : surface === 'nordic-stone'
          ? '#eceef0'
          : '#eef2f5'
    : surface === 'mono-ink'
      ? '#09090b'
      : surface === 'blueprint-slate'
        ? '#0c1220'
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
    borderWidth: base.borderWidth,
    blur,
    borderRadius,
    accentColor,
    shadow: base.shadow,
    hoverShadow: base.hoverShadow,
    hoverBorderColor: base.hoverBorderColor,
    defaultTextColor: isLightCard ? '#1e293b' : '#f8fafc',
    secondaryTextColor: isLightCard ? '#475569' : 'rgba(226, 232, 240, 0.86)',
    isLightCard,
    isFlatGeometric: isFlat,
  }

  const chromeTextColor = isLightCanvas ? '#0f172a' : '#ffffff'
  const chromeMutedColor = isLightCanvas ? '#475569' : 'rgba(241, 245, 249, 0.85)'
  const chromeTextShadow = (isLightCanvas || isFlat) ? 'none' : '0 2px 16px rgba(0, 0, 0, 0.55)'
  const smallTitleShadow = (isLightCanvas || isFlat) ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.88)'

  const searchBackground = (surface === 'bauhaus-grid' || surface === 'swiss-paper' || surface === 'nordic-stone')
    ? '#ffffff'
    : surface === 'mono-ink'
      ? '#121215'
      : surface === 'blueprint-slate'
        ? '#11192b'
        : isLightCard
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
  const searchBorderColor = surface === 'bauhaus-grid'
    ? '#18181b'
    : surface === 'swiss-paper'
      ? '#d4d4d8'
      : surface === 'nordic-stone'
        ? '#cbd5e1'
        : surface === 'mono-ink'
          ? '#27272a'
          : surface === 'blueprint-slate'
            ? '#23314b'
            : searchIsLight
              ? 'rgba(148, 163, 184, 0.52)'
              : surface === 'midnight-graphite'
                ? 'rgba(56, 189, 248, 0.34)'
                : surface === 'ocean-glass'
                  ? 'rgba(147, 197, 253, 0.36)'
                  : 'rgba(255, 255, 255, 0.42)'
  const searchPlaceholderColor = searchIsLight ? '#64748b' : 'rgba(241, 245, 249, 0.78)'

  const controlBackground = (surface === 'bauhaus-grid' || surface === 'swiss-paper' || surface === 'nordic-stone')
    ? '#ffffff'
    : surface === 'mono-ink'
      ? '#121215'
      : surface === 'blueprint-slate'
        ? '#11192b'
        : isLightCanvas
          ? 'rgba(255, 252, 246, 0.92)'
          : surface === 'ocean-glass'
            ? 'rgba(15, 42, 74, 0.72)'
            : surface === 'midnight-graphite'
              ? 'rgba(17, 21, 28, 0.88)'
              : LEGACY_DEFAULT_CARD_BG
  const controlTextColor = isLightColor(controlBackground, canvasFallback) ? '#09090b' : '#ffffff'
  const controlBorderColor = surface === 'bauhaus-grid'
    ? '#18181b'
    : surface === 'swiss-paper'
      ? '#d4d4d8'
      : surface === 'nordic-stone'
        ? '#cbd5e1'
        : surface === 'mono-ink'
          ? '#27272a'
          : surface === 'blueprint-slate'
            ? '#23314b'
            : isLightCanvas
              ? 'rgba(148, 163, 184, 0.46)'
              : surface === 'midnight-graphite'
                ? 'rgba(56, 189, 248, 0.32)'
                : surface === 'ocean-glass'
                  ? 'rgba(147, 197, 253, 0.32)'
                  : 'rgba(255, 255, 255, 0.16)'

  const iconBadgeStyle = config.iconBadgeStyle ?? 'default'
  const iconBadgeBackground = isLightCard
    ? surface === 'swiss-paper'
      ? '#f4f4f5'
      : surface === 'nordic-stone'
        ? '#eef0f2'
        : '#f4f1ea'
    : surface === 'mono-ink'
      ? '#27272a'
      : '#1e293b'
  const searchBadgeBackground = searchIsLight ? '#f4f4f5' : '#1e293b'

  const cssVars: Record<string, string> = {
    '--leon-canvas-fallback': canvasFallback,
    '--leon-chrome-text': chromeTextColor,
    '--leon-chrome-muted': chromeMutedColor,
    '--leon-chrome-shadow': chromeTextShadow,
    '--leon-small-title-shadow': smallTitleShadow,
    '--leon-card-bg': card.backgroundColor,
    '--leon-card-border': card.borderColor,
    '--leon-card-border-width': card.borderWidth,
    '--leon-card-hover-border': card.hoverBorderColor,
    '--leon-card-blur': `${card.blur}px`,
    '--leon-card-radius': `${card.borderRadius}px`,
    '--leon-card-shadow': card.shadow,
    '--leon-card-hover-shadow': card.hoverShadow,
    '--leon-card-text': card.defaultTextColor,
    '--leon-card-text-secondary': card.secondaryTextColor,
    '--leon-accent-color': card.accentColor,
    '--leon-icon-badge-bg': iconBadgeBackground,
    '--leon-search-bg': searchBackground,
    '--leon-search-text': searchTextColor,
    '--leon-search-border': searchBorderColor,
    '--leon-search-placeholder': searchPlaceholderColor,
    '--leon-search-badge-bg': searchBadgeBackground,
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
    iconBadgeBackground,
    card,
    searchBackground,
    searchTextColor,
    controlBackground,
    controlTextColor,
    cssVars,
  }
}

function formatRgb(color: ParsedRgba): string {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
}

function compositeColorOver(topColor: string, bottomColor: string): string {
  const bottom = parseCssColor(bottomColor)
  const top = parseCssColor(topColor)
  if (!top)
    return bottomColor
  if (!bottom)
    return topColor
  if (top.a >= 1)
    return topColor
  return formatRgb(compositeOver(top, bottom))
}

function resolveBadgeOverlayBackground(
  badgeStyle: IconBadgeStyleId,
  bauhausBackground: string,
  baseBackground: string,
): string {
  switch (badgeStyle) {
    case 'bauhaus':
      return bauhausBackground
    case 'glass':
      return compositeColorOver('rgba(255, 255, 255, 0.14)', baseBackground)
    case 'soft':
      return compositeColorOver('rgba(15, 23, 42, 0.055)', baseBackground)
    case 'outline':
      return compositeColorOver('rgba(30, 41, 59, 0.72)', baseBackground)
    default:
      return baseBackground
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
  else if (!isPresetTextProtectionActive(rawConfig)) {
    textColor = configuredText
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

export function resolveIconBadgeBackgroundColor(
  rawConfig: AppearancePanelConfig,
  itemIcon?: { backgroundColor?: string } | null,
): string {
  const theme = resolveHomepageThemeVars(rawConfig)
  const card = resolveCardAppearance(rawConfig, itemIcon)
  const effectiveCardBg = compositeColorOver(card.backgroundColor, theme.canvasFallback)
  if (card.hasCustomBackground)
    return effectiveCardBg
  return resolveBadgeOverlayBackground(theme.iconBadgeStyle, theme.iconBadgeBackground, effectiveCardBg)
}

export function resolveSmallIconBackgroundColor(
  rawConfig: AppearancePanelConfig,
  itemIcon?: { backgroundColor?: string } | null,
  forceBackground?: string | null,
): string {
  const theme = resolveHomepageThemeVars(rawConfig)
  const card = resolveCardAppearance(rawConfig, itemIcon)
  const tileBase = card.hasCustomBackground
    ? theme.canvasFallback
    : resolveBadgeOverlayBackground(theme.iconBadgeStyle, theme.iconBadgeBackground, theme.canvasFallback)
  const itemLayer = (forceBackground && forceBackground.trim() !== '')
    ? forceBackground
    : (card.hasCustomBackground ? (itemIcon?.backgroundColor || LEGACY_DEFAULT_CARD_BG) : card.backgroundColor)
  return compositeColorOver(itemLayer, tileBase)
}

export function resolveSmallTitleColor(rawConfig: AppearancePanelConfig): string {
  const theme = resolveHomepageThemeVars(rawConfig)
  const fallback = theme.isLightCanvas ? '#1e293b' : '#f8fafc'
  const configured = rawConfig.iconTextColor?.trim()
  const isDefaultWhite = !configured || configured.toLowerCase() === '#ffffff' || configured.toLowerCase() === '#fff'

  if (isDefaultWhite)
    return fallback

  if (!isPresetTextProtectionActive(rawConfig))
    return configured

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
  canonical.__explicitWallpaperTone = isWallpaperTone(config.wallpaperTone) ? config.wallpaperTone : null
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

export type CloudConfigLoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface PanelCloudResponse<TConfig extends AppearancePanelConfig = AppearancePanelConfig> {
  code: number
  msg?: string
  data?: {
    panel?: Partial<TConfig> | null
  } | null
}

export interface PanelSaveResult {
  ok: boolean
  stale?: boolean
  blocked?: boolean
  msg?: string
}

export interface PanelCloudTargetState<TConfig extends AppearancePanelConfig = AppearancePanelConfig> {
  panelConfig: TConfig
  lastSyncedPanelJson?: string
  cloudConfigState?: CloudConfigLoadState
  cloudConfigError?: string
  ownerUserId?: number | null
  previewPresetId?: AppearancePresetId | null
  previewScopes?: AppearancePresetScopes
}

export interface PanelCloudSyncDeps<TConfig extends AppearancePanelConfig = AppearancePanelConfig> {
  getState?: () => PanelCloudTargetState<TConfig>
  getToken: () => string
  getUserId: () => number | null
  createDefaultConfig: () => TConfig
  normalizeConfig?: (raw: Partial<TConfig> | null | undefined, defaults: TConfig) => TConfig
  fetchCloudConfig: (sessionCurrent: () => boolean) => Promise<PanelCloudResponse<TConfig>>
  pushCloudConfig: (panel: TConfig, sessionCurrent: () => boolean) => Promise<{ code: number; msg?: string }>
  onRecordState?: () => void
}

export function isCloudConfigNotFound(res?: { code?: unknown; msg?: unknown } | null): boolean {
  if (!res)
    return false
  return res.code === -1 || res.code === 1202
}

export function createPanelCloudController<TConfig extends AppearancePanelConfig = AppearancePanelConfig>(
  deps: PanelCloudSyncDeps<TConfig>,
  initialConfig?: TConfig,
) {
  let internalState: PanelCloudTargetState<TConfig> | null = null

  function target(): PanelCloudTargetState<TConfig> {
    if (deps.getState)
      return deps.getState()
    if (!internalState) {
      const initial = initialConfig ? { ...initialConfig } : deps.createDefaultConfig()
      internalState = {
        panelConfig: initial,
        lastSyncedPanelJson: serializePanelConfig(initial),
        cloudConfigState: 'idle',
        cloudConfigError: '',
        ownerUserId: deps.getUserId(),
        previewPresetId: null,
        previewScopes: { ...DEFAULT_APPEARANCE_SCOPES },
      }
    }
    return internalState
  }

  let cloudSyncGeneration = 0
  let cloudSaveGeneration = 0
  let cloudSaveQueue: Promise<void> = Promise.resolve()

  function buildNormalized(raw: Partial<TConfig> | null | undefined): TConfig {
    const defaults = deps.createDefaultConfig()
    if (deps.normalizeConfig)
      return deps.normalizeConfig(raw, defaults)
    return normalizePanelAppearance<TConfig>({
      ...defaults,
      ...(raw ?? {}),
    })
  }

  function snapshotPayload(config: TConfig): TConfig {
    return normalizePanelAppearance<TConfig>({ ...config })
  }

  function canEdit(): boolean {
    const token = deps.getToken().trim()
    return token !== '' && target().cloudConfigState === 'ready'
  }

  function markSynced(config?: TConfig) {
    const s = target()
    s.lastSyncedPanelJson = serializePanelConfig(config ?? s.panelConfig)
  }

  async function loadFromCloud(): Promise<{ ok: boolean; stale?: boolean; msg?: string }> {
    const s = target()
    const expectedToken = deps.getToken()
    const generation = ++cloudSyncGeneration
    s.cloudConfigState = 'loading'
    s.cloudConfigError = ''

    const isCurrent = () => generation === cloudSyncGeneration && deps.getToken() === expectedToken

    try {
      const res = await deps.fetchCloudConfig(isCurrent)
      if (!isCurrent())
        return { ok: false, stale: true }

      const currentTarget = target()
      if (res && res.code === 0) {
        const next = buildNormalized(res.data?.panel)
        currentTarget.panelConfig = next
        markSynced(next)
        currentTarget.cloudConfigState = 'ready'
        currentTarget.cloudConfigError = ''
        currentTarget.ownerUserId = deps.getUserId()
        deps.onRecordState?.()
        return { ok: true }
      }

      if (isCloudConfigNotFound(res)) {
        const next = deps.createDefaultConfig()
        currentTarget.panelConfig = next
        currentTarget.previewPresetId = null
        markSynced(next)
        currentTarget.cloudConfigState = 'ready'
        currentTarget.cloudConfigError = ''
        currentTarget.ownerUserId = deps.getUserId()
        deps.onRecordState?.()
        return { ok: true }
      }

      currentTarget.cloudConfigState = 'error'
      currentTarget.cloudConfigError = (typeof res?.msg === 'string' && res.msg.trim() !== '') ? res.msg : ''
      return { ok: false, msg: currentTarget.cloudConfigError }
    }
    catch (err: unknown) {
      if (!isCurrent())
        return { ok: false, stale: true }
      const currentTarget = target()
      currentTarget.cloudConfigState = 'error'
      const msg = (err && typeof err === 'object' && 'msg' in err && typeof (err as { msg?: unknown }).msg === 'string')
        ? ((err as { msg: string }).msg)
        : ''
      currentTarget.cloudConfigError = msg
      return { ok: false, msg }
    }
  }

  async function saveToCloud(): Promise<PanelSaveResult> {
    const s = target()
    const expectedToken = deps.getToken()
    if (!expectedToken.trim() || s.cloudConfigState !== 'ready')
      return { ok: false, blocked: true }

    const generation = ++cloudSaveGeneration
    // Prevent an older in-flight GET from overwriting a valid ready state write.
    cloudSyncGeneration++

    const snapshot = snapshotPayload(s.panelConfig)
    const snapshotJson = serializePanelConfig(snapshot)
    s.ownerUserId = deps.getUserId()
    deps.onRecordState?.()

    let result: PanelSaveResult = { ok: false, stale: true }
    const isCurrent = () => generation === cloudSaveGeneration && deps.getToken() === expectedToken

    const run = cloudSaveQueue.then(async () => {
      if (!isCurrent() || target().cloudConfigState !== 'ready') {
        result = { ok: false, stale: true }
        return
      }
      try {
        const res = await deps.pushCloudConfig(snapshot, isCurrent)
        if (!isCurrent()) {
          result = { ok: false, stale: true }
          return
        }
        if (res && res.code === 0) {
          target().lastSyncedPanelJson = snapshotJson
          result = { ok: true }
        }
        else {
          result = { ok: false, msg: res?.msg }
        }
      }
      catch (err: unknown) {
        if (!isCurrent()) {
          result = { ok: false, stale: true }
        }
        else {
          const msg = (err && typeof err === 'object' && 'msg' in err && typeof (err as { msg?: unknown }).msg === 'string')
            ? ((err as { msg: string }).msg)
            : undefined
          result = { ok: false, msg }
        }
      }
    })

    cloudSaveQueue = run.catch(() => undefined)
    await run
    return result
  }

  function startPreview(presetId: AppearancePresetId, scopes?: Partial<AppearancePresetScopes>): boolean {
    if (!canEdit())
      return false
    const s = target()
    s.previewPresetId = presetId
    s.previewScopes = normalizeScopes(scopes ?? s.previewScopes)
    return true
  }

  function updatePreviewScopes(scopes: Partial<AppearancePresetScopes>): boolean {
    if (!canEdit())
      return false
    const s = target()
    s.previewScopes = normalizeScopes({
      ...s.previewScopes,
      ...scopes,
    })
    return true
  }

  function cancelPreview() {
    target().previewPresetId = null
  }

  function applyPreset(presetId: AppearancePresetId, scopes?: Partial<AppearancePresetScopes>): boolean {
    if (!canEdit())
      return false
    const s = target()
    const effectiveScopes = normalizeScopes(scopes ?? s.previewScopes)
    const next = applyAppearancePreset(s.panelConfig, presetId, effectiveScopes)
    s.panelConfig = next
    s.previewPresetId = null
    s.ownerUserId = deps.getUserId()
    deps.onRecordState?.()
    return true
  }

  function setWallpaper(src: string): boolean {
    if (!canEdit())
      return false
    const s = target()
    s.panelConfig = applyWallpaperSource(s.panelConfig, src)
    s.ownerUserId = deps.getUserId()
    deps.onRecordState?.()
    return true
  }

  function setCardSurface(surface: CardSurfacePresetId): boolean {
    if (!canEdit())
      return false
    const s = target()
    s.panelConfig = applyCardSurfaceDefaults(s.panelConfig, surface)
    s.ownerUserId = deps.getUserId()
    deps.onRecordState?.()
    return true
  }

  function resetToDefaults(): boolean {
    if (!canEdit())
      return false
    const s = target()
    s.panelConfig = deps.createDefaultConfig()
    s.previewPresetId = null
    s.ownerUserId = deps.getUserId()
    deps.onRecordState?.()
    return true
  }

  function resetRuntimeState() {
    cloudSyncGeneration++
    cloudSaveGeneration++
    const s = target()
    const next = deps.createDefaultConfig()
    s.panelConfig = next
    s.previewPresetId = null
    s.cloudConfigState = 'idle'
    s.cloudConfigError = ''
    markSynced(next)
  }

  function clearForAccountSwitch() {
    cloudSyncGeneration++
    cloudSaveGeneration++
    const s = target()
    const next = deps.createDefaultConfig()
    s.panelConfig = next
    s.ownerUserId = null
    s.previewPresetId = null
    s.previewScopes = { ...DEFAULT_APPEARANCE_SCOPES }
    s.cloudConfigState = 'idle'
    s.cloudConfigError = ''
    markSynced(next)
  }

  return {
    get state() {
      const s = target()
      return {
        panelConfig: s.panelConfig,
        lastSyncedPanelJson: s.lastSyncedPanelJson ?? '',
        cloudConfigState: s.cloudConfigState ?? 'idle',
        cloudConfigError: s.cloudConfigError ?? '',
        ownerUserId: s.ownerUserId ?? null,
        previewPresetId: s.previewPresetId ?? null,
        previewScopes: s.previewScopes ?? { ...DEFAULT_APPEARANCE_SCOPES },
      }
    },
    setPanelConfig(next: TConfig) {
      target().panelConfig = next
    },
    canEdit,
    markSynced,
    loadFromCloud,
    saveToCloud,
    startPreview,
    updatePreviewScopes,
    cancelPreview,
    applyPreset,
    setWallpaper,
    setCardSurface,
    resetToDefaults,
    resetRuntimeState,
    clearForAccountSwitch,
  }
}

export interface LeonThemePackAppearance {
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
  layoutMode?: PanelLayoutMode
  iconStyle?: number
  iconBadgeStyle?: IconBadgeStyleId
  iconMonochrome?: boolean
  iconTextColor?: string
  iconTextInfoHideDescription?: boolean
  iconTextIconHideTitle?: boolean
}

export interface LeonThemePackV1 {
  schema: 'leon-panel-theme'
  version: 1
  name: string
  appearance: LeonThemePackAppearance
}

function isSafeWallpaperSrc(src: unknown): src is string {
  if (typeof src !== 'string')
    return false
  const trimmed = src.trim()
  if (!trimmed)
    return false
  if (trimmed.startsWith('/') && !trimmed.startsWith('//'))
    return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

export function exportThemePackJson(config: AppearancePanelConfig, name = 'Leon Panel Theme'): string {
  const normalized = normalizePanelAppearance(config)
  const pack: LeonThemePackV1 = {
    schema: 'leon-panel-theme',
    version: 1,
    name: name.trim() || 'Leon Panel Theme',
    appearance: {
      backgroundImageSrc: normalized.backgroundImageSrc,
      backgroundBlur: normalized.backgroundBlur,
      backgroundMaskNumber: normalized.backgroundMaskNumber,
      wallpaperTone: normalized.wallpaperTone,
      cardSurface: normalized.cardSurface,
      cardBackgroundColor: normalized.cardBackgroundColor,
      cardBorderColor: normalized.cardBorderColor,
      cardBlur: normalized.cardBlur,
      cardBorderRadius: normalized.cardBorderRadius,
      cardAccentColor: normalized.cardAccentColor,
      layoutMode: normalized.layoutMode ?? 'standard',
      iconStyle: normalized.iconStyle,
      iconBadgeStyle: normalized.iconBadgeStyle,
      iconMonochrome: Boolean(normalized.iconMonochrome),
      iconTextColor: normalized.iconTextColor,
      iconTextInfoHideDescription: Boolean(normalized.iconTextInfoHideDescription),
      iconTextIconHideTitle: Boolean(normalized.iconTextIconHideTitle),
    },
  }
  return JSON.stringify(pack, null, 2)
}

export function parseThemePackJson(rawJson: string): { ok: true; pack: LeonThemePackV1 } | { ok: false; error: 'json' | 'schema' } {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  }
  catch {
    return { ok: false, error: 'json' }
  }
  if (!parsed || typeof parsed !== 'object')
    return { ok: false, error: 'schema' }
  const obj = parsed as Record<string, unknown>
  if (obj.schema !== 'leon-panel-theme' || obj.version !== 1 || !obj.appearance || typeof obj.appearance !== 'object')
    return { ok: false, error: 'schema' }

  const raw = obj.appearance as Record<string, unknown>
  const appearance: LeonThemePackAppearance = {}

  if (isSafeWallpaperSrc(raw.backgroundImageSrc))
    appearance.backgroundImageSrc = raw.backgroundImageSrc.trim()
  if (typeof raw.backgroundBlur === 'number' && Number.isFinite(raw.backgroundBlur))
    appearance.backgroundBlur = clampNumber(raw.backgroundBlur, 0, 30, 0)
  if (typeof raw.backgroundMaskNumber === 'number' && Number.isFinite(raw.backgroundMaskNumber))
    appearance.backgroundMaskNumber = clampNumber(raw.backgroundMaskNumber, 0, 1, 0)
  if (isWallpaperTone(raw.wallpaperTone))
    appearance.wallpaperTone = raw.wallpaperTone
  if (isCardSurfacePresetId(raw.cardSurface))
    appearance.cardSurface = raw.cardSurface
  if (typeof raw.cardBackgroundColor === 'string' && parseCssColor(raw.cardBackgroundColor))
    appearance.cardBackgroundColor = raw.cardBackgroundColor.trim()
  if (typeof raw.cardBorderColor === 'string' && parseCssColor(raw.cardBorderColor))
    appearance.cardBorderColor = raw.cardBorderColor.trim()
  if (typeof raw.cardBlur === 'number' && Number.isFinite(raw.cardBlur))
    appearance.cardBlur = clampNumber(raw.cardBlur, 0, 24, 0)
  if (typeof raw.cardBorderRadius === 'number' && Number.isFinite(raw.cardBorderRadius))
    appearance.cardBorderRadius = clampNumber(raw.cardBorderRadius, 0, 24, 0)
  if (typeof raw.cardAccentColor === 'string' && parseCssColor(raw.cardAccentColor))
    appearance.cardAccentColor = raw.cardAccentColor.trim()
  if (isPanelLayoutMode(raw.layoutMode))
    appearance.layoutMode = raw.layoutMode
  if (raw.iconStyle === 0 || raw.iconStyle === 1)
    appearance.iconStyle = raw.iconStyle
  if (isIconBadgeStyleId(raw.iconBadgeStyle))
    appearance.iconBadgeStyle = raw.iconBadgeStyle
  if (typeof raw.iconMonochrome === 'boolean')
    appearance.iconMonochrome = raw.iconMonochrome
  if (typeof raw.iconTextColor === 'string' && parseCssColor(raw.iconTextColor))
    appearance.iconTextColor = raw.iconTextColor.trim()
  if (typeof raw.iconTextInfoHideDescription === 'boolean')
    appearance.iconTextInfoHideDescription = raw.iconTextInfoHideDescription
  if (typeof raw.iconTextIconHideTitle === 'boolean')
    appearance.iconTextIconHideTitle = raw.iconTextIconHideTitle

  return {
    ok: true,
    pack: {
      schema: 'leon-panel-theme',
      version: 1,
      name: (typeof obj.name === 'string' && obj.name.trim() !== '') ? obj.name.trim().slice(0, 80) : 'Imported Theme',
      appearance,
    },
  }
}

export function applyThemePackJson<T extends AppearancePanelConfig>(
  current: T,
  rawJson: string,
): { ok: true; config: T; name: string } | { ok: false; error: 'json' | 'schema' } {
  const result = parseThemePackJson(rawJson)
  if (!result.ok)
    return result
  return {
    ok: true,
    name: result.pack.name,
    config: normalizePanelAppearance({
      ...current,
      ...result.pack.appearance,
    }),
  }
}
