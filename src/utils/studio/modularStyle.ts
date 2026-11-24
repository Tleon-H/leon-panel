export type FontPresetId =
  | 'modern-sans'
  | 'geometric-tech'
  | 'editorial-serif'
  | 'studio-mono'
  | 'rounded-ui'
  | 'compact-condensed'

export type IconShapeId =
  | 'squircle'
  | 'circle'
  | 'sharp'
  | 'pill'

export type IconToneFilterId =
  | 'original'
  | 'soft-mono'
  | 'high-contrast'
  | 'luminous'

export type CursorPresetId =
  | 'system'
  | 'minimal-arrow'
  | 'frost-pointer'
  | 'neon-cyber'
  | 'bauhaus-pop'
  | 'crosshair-tech'

export type CardHoverEffectId =
  | 'lift'
  | 'spotlight'
  | 'tilt-3d'
  | 'shimmer'
  | 'border-glow'
  | 'magnetic'
  | 'bauhaus-pop'
  | 'none'

export interface StudioModularStyleConfig {
  fontPreset: FontPresetId
  iconShape: IconShapeId
  iconToneFilter: IconToneFilterId
  cursorPreset: CursorPresetId
  cardHoverEffect: CardHoverEffectId
}

export interface FontPresetDefinition {
  id: FontPresetId
  nameKey: string
  sample: string
  fontFamily: string
  displayFamily: string
  letterSpacing: string
}

export interface ModularOptionDefinition<T extends string> {
  id: T
  nameKey: string
  descKey: string
}

export interface CursorOptionDefinition extends ModularOptionDefinition<CursorPresetId> {
  previewSvgUri: string
}

export const FONT_PRESET_IDS: readonly FontPresetId[] = [
  'modern-sans',
  'geometric-tech',
  'editorial-serif',
  'studio-mono',
  'rounded-ui',
  'compact-condensed',
]

export const ICON_SHAPE_IDS: readonly IconShapeId[] = [
  'squircle',
  'circle',
  'sharp',
  'pill',
]

export const ICON_TONE_FILTER_IDS: readonly IconToneFilterId[] = [
  'original',
  'soft-mono',
  'high-contrast',
  'luminous',
]

export const CURSOR_PRESET_IDS: readonly CursorPresetId[] = [
  'system',
  'minimal-arrow',
  'frost-pointer',
  'neon-cyber',
  'bauhaus-pop',
  'crosshair-tech',
]

const LEGACY_CURSOR_MIGRATION: Record<string, CursorPresetId> = {
  'precision-dot': 'minimal-arrow',
  'spotlight-aura': 'frost-pointer',
  'neon-ring': 'neon-cyber',
}

export const CARD_HOVER_EFFECT_IDS: readonly CardHoverEffectId[] = [
  'spotlight',
  'tilt-3d',
  'shimmer',
  'border-glow',
  'magnetic',
  'lift',
  'bauhaus-pop',
  'none',
]

export const FONT_PRESETS: Record<FontPresetId, FontPresetDefinition> = {
  'modern-sans': {
    id: 'modern-sans',
    nameKey: 'apps.leonStudio.modular.fonts.modernSans',
    sample: 'Leon 12:30 导航',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif',
    displayFamily: '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif',
    letterSpacing: '-0.01em',
  },
  'geometric-tech': {
    id: 'geometric-tech',
    nameKey: 'apps.leonStudio.modular.fonts.geometricTech',
    sample: 'LEON // 01 几何',
    fontFamily: '"Space Grotesk", "Avenir Next", "HarmonyOS Sans SC", "PingFang SC", "Segoe UI", sans-serif',
    displayFamily: '"Space Grotesk", "Avenir Next", "PingFang SC", sans-serif',
    letterSpacing: '0.01em',
  },
  'editorial-serif': {
    id: 'editorial-serif',
    nameKey: 'apps.leonStudio.modular.fonts.editorialSerif',
    sample: 'Editorial 衬线雅致',
    fontFamily: '"Iowan Old Style", "Georgia", "Songti SC", "STSong", "Noto Serif SC", serif',
    displayFamily: '"Georgia", "Songti SC", "Noto Serif SC", serif',
    letterSpacing: '0em',
  },
  'studio-mono': {
    id: 'studio-mono',
    nameKey: 'apps.leonStudio.modular.fonts.studioMono',
    sample: 'SSH://NODE_01 终端',
    fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, "PingFang SC", monospace',
    displayFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    letterSpacing: '-0.02em',
  },
  'rounded-ui': {
    id: 'rounded-ui',
    nameKey: 'apps.leonStudio.modular.fonts.roundedUi',
    sample: 'Friendly 圆润柔和',
    fontFamily: '"SF Pro Rounded", "Nunito", "Quicksand", "Hiragino Maru Gothic ProN", "PingFang SC", "Microsoft YaHei", sans-serif',
    displayFamily: '"SF Pro Rounded", "Nunito", "PingFang SC", sans-serif',
    letterSpacing: '0em',
  },
  'compact-condensed': {
    id: 'compact-condensed',
    nameKey: 'apps.leonStudio.modular.fonts.compactCondensed',
    sample: 'DENSE 24/7 仪表盘',
    fontFamily: '"DIN Alternate", "Helvetica Neue", "Arial Narrow", "PingFang SC", "Microsoft YaHei", sans-serif',
    displayFamily: '"DIN Alternate", "Helvetica Neue", "PingFang SC", sans-serif',
    letterSpacing: '0.02em',
  },
}

export const ICON_SHAPE_OPTIONS: readonly ModularOptionDefinition<IconShapeId>[] = [
  { id: 'squircle', nameKey: 'apps.leonStudio.modular.iconShapes.squircle', descKey: 'apps.leonStudio.modular.iconShapes.squircleDesc' },
  { id: 'circle', nameKey: 'apps.leonStudio.modular.iconShapes.circle', descKey: 'apps.leonStudio.modular.iconShapes.circleDesc' },
  { id: 'sharp', nameKey: 'apps.leonStudio.modular.iconShapes.sharp', descKey: 'apps.leonStudio.modular.iconShapes.sharpDesc' },
  { id: 'pill', nameKey: 'apps.leonStudio.modular.iconShapes.pill', descKey: 'apps.leonStudio.modular.iconShapes.pillDesc' },
]

export const ICON_TONE_OPTIONS: readonly ModularOptionDefinition<IconToneFilterId>[] = [
  { id: 'original', nameKey: 'apps.leonStudio.modular.iconTones.original', descKey: 'apps.leonStudio.modular.iconTones.originalDesc' },
  { id: 'soft-mono', nameKey: 'apps.leonStudio.modular.iconTones.softMono', descKey: 'apps.leonStudio.modular.iconTones.softMonoDesc' },
  { id: 'high-contrast', nameKey: 'apps.leonStudio.modular.iconTones.highContrast', descKey: 'apps.leonStudio.modular.iconTones.highContrastDesc' },
  { id: 'luminous', nameKey: 'apps.leonStudio.modular.iconTones.luminous', descKey: 'apps.leonStudio.modular.iconTones.luminousDesc' },
]

export const CURSOR_SVG_PREVIEWS: Record<CursorPresetId, string> = {
  'system': 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27%3E%3Cpath d=%27M5 3.2L17.6 13.8H11.6L14.2 19.6L11.6 20.7L9 14.8L5 18.4V3.2Z%27 fill=%27%2364748b%27 stroke=%27%23ffffff%27 stroke-width=%271.4%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E',
  'minimal-arrow': 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27%3E%3Cpath d=%27M3.5 2.5L19 11.4L11.4 13.2L8.4 20.2L3.5 2.5Z%27 fill=%27%230b0d11%27 stroke=%27%23f8fafc%27 stroke-width=%271.6%27 stroke-linejoin=%27round%27/%3E%3Ccircle cx=%276.6%27 cy=%276.6%27 r=%271.2%27 fill=%27%2338bdf8%27/%3E%3C/svg%3E',
  'frost-pointer': 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27%3E%3Cpath d=%27M4 2.8L18.8 11.6L11.6 13.5L8.6 20.4L4 2.8Z%27 fill=%27%23ffffff%27 stroke=%27%230f172a%27 stroke-width=%271.6%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E',
  'neon-cyber': 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27%3E%3Cpath d=%27M3.2 2.4L19.6 10.6L12.2 12.8L9.6 20.4L3.2 2.4Z%27 fill=%27%23090d16%27 stroke=%27%2322d3ee%27 stroke-width=%271.7%27 stroke-linejoin=%27round%27/%3E%3Cpath d=%27M5.5 5.6L11.5 11.5%27 stroke=%27%23818cf8%27 stroke-width=%271.4%27 stroke-linecap=%27round%27/%3E%3C/svg%3E',
  'bauhaus-pop': 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27%3E%3Cpath d=%27M3.5 2.5L19.5 11L11.8 13.4L9 20.5L3.5 2.5Z%27 fill=%27%23ff4f00%27 stroke=%27%2309090b%27 stroke-width=%271.8%27 stroke-linejoin=%27miter%27/%3E%3C/svg%3E',
  'crosshair-tech': 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%275%27 stroke=%27%230ea5e9%27 stroke-width=%271.6%27/%3E%3Cpath d=%27M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5%27 stroke=%27%230ea5e9%27 stroke-width=%271.6%27 stroke-linecap=%27round%27/%3E%3C/svg%3E',
}

export const CURSOR_PRESET_OPTIONS: readonly CursorOptionDefinition[] = [
  { id: 'system', nameKey: 'apps.leonStudio.modular.cursors.system', descKey: 'apps.leonStudio.modular.cursors.systemDesc', previewSvgUri: CURSOR_SVG_PREVIEWS.system },
  { id: 'minimal-arrow', nameKey: 'apps.leonStudio.modular.cursors.minimalArrow', descKey: 'apps.leonStudio.modular.cursors.minimalArrowDesc', previewSvgUri: CURSOR_SVG_PREVIEWS['minimal-arrow'] },
  { id: 'frost-pointer', nameKey: 'apps.leonStudio.modular.cursors.frostPointer', descKey: 'apps.leonStudio.modular.cursors.frostPointerDesc', previewSvgUri: CURSOR_SVG_PREVIEWS['frost-pointer'] },
  { id: 'neon-cyber', nameKey: 'apps.leonStudio.modular.cursors.neonCyber', descKey: 'apps.leonStudio.modular.cursors.neonCyberDesc', previewSvgUri: CURSOR_SVG_PREVIEWS['neon-cyber'] },
  { id: 'bauhaus-pop', nameKey: 'apps.leonStudio.modular.cursors.bauhausPop', descKey: 'apps.leonStudio.modular.cursors.bauhausPopDesc', previewSvgUri: CURSOR_SVG_PREVIEWS['bauhaus-pop'] },
  { id: 'crosshair-tech', nameKey: 'apps.leonStudio.modular.cursors.crosshairTech', descKey: 'apps.leonStudio.modular.cursors.crosshairTechDesc', previewSvgUri: CURSOR_SVG_PREVIEWS['crosshair-tech'] },
]

export const CARD_HOVER_EFFECT_OPTIONS: readonly ModularOptionDefinition<CardHoverEffectId>[] = [
  { id: 'spotlight', nameKey: 'apps.leonStudio.modular.hoverFx.spotlight', descKey: 'apps.leonStudio.modular.hoverFx.spotlightDesc' },
  { id: 'tilt-3d', nameKey: 'apps.leonStudio.modular.hoverFx.tilt3d', descKey: 'apps.leonStudio.modular.hoverFx.tilt3dDesc' },
  { id: 'shimmer', nameKey: 'apps.leonStudio.modular.hoverFx.shimmer', descKey: 'apps.leonStudio.modular.hoverFx.shimmerDesc' },
  { id: 'border-glow', nameKey: 'apps.leonStudio.modular.hoverFx.borderGlow', descKey: 'apps.leonStudio.modular.hoverFx.borderGlowDesc' },
  { id: 'magnetic', nameKey: 'apps.leonStudio.modular.hoverFx.magnetic', descKey: 'apps.leonStudio.modular.hoverFx.magneticDesc' },
  { id: 'lift', nameKey: 'apps.leonStudio.modular.hoverFx.lift', descKey: 'apps.leonStudio.modular.hoverFx.liftDesc' },
  { id: 'bauhaus-pop', nameKey: 'apps.leonStudio.modular.hoverFx.bauhausPop', descKey: 'apps.leonStudio.modular.hoverFx.bauhausPopDesc' },
  { id: 'none', nameKey: 'apps.leonStudio.modular.hoverFx.none', descKey: 'apps.leonStudio.modular.hoverFx.noneDesc' },
]

export function isFontPresetId(value: unknown): value is FontPresetId {
  return typeof value === 'string' && (FONT_PRESET_IDS as readonly string[]).includes(value)
}

export function isIconShapeId(value: unknown): value is IconShapeId {
  return typeof value === 'string' && (ICON_SHAPE_IDS as readonly string[]).includes(value)
}

export function isIconToneFilterId(value: unknown): value is IconToneFilterId {
  return typeof value === 'string' && (ICON_TONE_FILTER_IDS as readonly string[]).includes(value)
}

export function isCursorPresetId(value: unknown): value is CursorPresetId {
  return typeof value === 'string' && (CURSOR_PRESET_IDS as readonly string[]).includes(value)
}

export function normalizeCursorPresetId(value: unknown): CursorPresetId {
  if (isCursorPresetId(value))
    return value
  if (typeof value === 'string' && value in LEGACY_CURSOR_MIGRATION)
    return LEGACY_CURSOR_MIGRATION[value]
  return 'system'
}

export function isCardHoverEffectId(value: unknown): value is CardHoverEffectId {
  return typeof value === 'string' && (CARD_HOVER_EFFECT_IDS as readonly string[]).includes(value)
}

export function defaultModularStyleConfig(): StudioModularStyleConfig {
  return {
    fontPreset: 'modern-sans',
    iconShape: 'squircle',
    iconToneFilter: 'original',
    cursorPreset: 'system',
    cardHoverEffect: 'spotlight',
  }
}

export function normalizeModularStyleConfig(raw: unknown): StudioModularStyleConfig {
  const defaults = defaultModularStyleConfig()
  if (!raw || typeof raw !== 'object')
    return defaults
  const obj = raw as Record<string, unknown>
  return {
    fontPreset: isFontPresetId(obj.fontPreset) ? obj.fontPreset : defaults.fontPreset,
    iconShape: isIconShapeId(obj.iconShape) ? obj.iconShape : defaults.iconShape,
    iconToneFilter: isIconToneFilterId(obj.iconToneFilter) ? obj.iconToneFilter : defaults.iconToneFilter,
    cursorPreset: normalizeCursorPresetId(obj.cursorPreset),
    cardHoverEffect: isCardHoverEffectId(obj.cardHoverEffect) ? obj.cardHoverEffect : defaults.cardHoverEffect,
  }
}

export function needsPointerTracking(effect: CardHoverEffectId): boolean {
  return effect === 'spotlight'
    || effect === 'tilt-3d'
    || effect === 'border-glow'
    || effect === 'magnetic'
}

export interface CardPointerVars {
  '--leon-mx': string
  '--leon-my': string
  '--leon-rx': string
  '--leon-ry': string
  '--leon-tx': string
  '--leon-ty': string
}

export function computeCardPointerVars(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): CardPointerVars {
  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)
  const localX = Math.max(0, Math.min(width, clientX - rect.left))
  const localY = Math.max(0, Math.min(height, clientY - rect.top))
  const normX = (localX / width) * 2 - 1 // -1 .. 1
  const normY = (localY / height) * 2 - 1 // -1 .. 1
  const rotateX = Number((-normY * 5.5).toFixed(2))
  const rotateY = Number((normX * 6.5).toFixed(2))
  const shiftX = Number((normX * 4).toFixed(2))
  const shiftY = Number((normY * 3.5).toFixed(2))

  return {
    '--leon-mx': `${Math.round(localX)}px`,
    '--leon-my': `${Math.round(localY)}px`,
    '--leon-rx': `${rotateX}deg`,
    '--leon-ry': `${rotateY}deg`,
    '--leon-tx': `${shiftX}px`,
    '--leon-ty': `${shiftY}px`,
  }
}

export function applyCardPointerFx(event: PointerEvent, effect: CardHoverEffectId, reduceMotion = false): void {
  if (reduceMotion || !needsPointerTracking(effect))
    return
  const el = event.currentTarget as HTMLElement | null
  if (!el)
    return
  const vars = computeCardPointerVars(event.clientX, event.clientY, el.getBoundingClientRect())
  for (const [key, value] of Object.entries(vars))
    el.style.setProperty(key, value)
}

export function resetCardPointerFx(event: PointerEvent): void {
  const el = event.currentTarget as HTMLElement | null
  if (!el)
    return
  el.style.removeProperty('--leon-rx')
  el.style.removeProperty('--leon-ry')
  el.style.removeProperty('--leon-tx')
  el.style.removeProperty('--leon-ty')
}

export function applyModularStyleToDocument(
  modular: StudioModularStyleConfig,
  options: { safeMode?: boolean; reduceMotion?: boolean } = {},
  doc?: Document,
): void {
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : undefined)
  if (!targetDoc?.documentElement)
    return
  const root = targetDoc.documentElement
  const effective = options.safeMode ? defaultModularStyleConfig() : normalizeModularStyleConfig(modular)
  const font = FONT_PRESETS[effective.fontPreset]
  const effectiveCursor: CursorPresetId = (options.safeMode || options.reduceMotion) ? 'system' : effective.cursorPreset
  const effectiveHoverFx: CardHoverEffectId = options.reduceMotion ? 'none' : effective.cardHoverEffect

  root.style.setProperty('--leon-font-sans', font.fontFamily)
  root.style.setProperty('--leon-font-display', font.displayFamily)
  root.style.setProperty('--leon-font-tracking', font.letterSpacing)

  root.setAttribute('data-leon-font', effective.fontPreset)
  root.setAttribute('data-leon-icon-shape', effective.iconShape)
  root.setAttribute('data-leon-icon-tone', effective.iconToneFilter)
  root.setAttribute('data-leon-cursor', effectiveCursor)
  root.setAttribute('data-leon-hover-fx', effectiveHoverFx)
}
