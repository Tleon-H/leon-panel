import type { GlobalThemeOverrides } from 'naive-ui'
import {
  type AppearancePanelConfig,
  type CardSurfacePresetId,
  contrastRatio,
  isFlatGeometricSurface,
  parseCssColor,
} from './appearance'

export interface NaiveUiSyncVars {
  '--leon-ui-primary': string
  '--leon-ui-primary-hover': string
  '--leon-ui-primary-fg': string
  '--leon-ui-radius': string
  '--leon-ui-modal-radius': string
  '--leon-ui-border': string
  '--leon-ui-surface': string
  '--leon-ui-canvas': string
}

const DEFAULT_LIGHT_PRIMARY = '#ff4f00'
const DEFAULT_DARK_PRIMARY = '#ff5e1a'

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => clampByte(v).toString(16).padStart(2, '0')).join('')}`
}

function mixHex(hex: string, target: { r: number; g: number; b: number }, amount: number): string {
  const parsed = parseCssColor(hex)
  if (!parsed)
    return hex
  return toHex(
    parsed.r + (target.r - parsed.r) * amount,
    parsed.g + (target.g - parsed.g) * amount,
    parsed.b + (target.b - parsed.b) * amount,
  )
}

function resolvePrimaryAccent(config: Partial<AppearancePanelConfig> | null | undefined, isDark: boolean): string {
  const surface: CardSurfacePresetId = config?.cardSurface ?? 'default'
  const raw = config?.cardAccentColor?.trim()

  // Legacy default accent (#7dd3fc) is very pale on light Naive UI surfaces;
  // map default surface cleanly to Bauhaus Signal Orange / Swiss Cobalt so Naive UI
  // never shows jarring default green (#18a058) or low-contrast pastel buttons.
  if (!raw || (surface === 'default' && raw.toLowerCase() === '#7dd3fc'))
    return isDark ? DEFAULT_DARK_PRIMARY : DEFAULT_LIGHT_PRIMARY

  const parsed = parseCssColor(raw)
  if (!parsed || parsed.a < 0.5)
    return isDark ? DEFAULT_DARK_PRIMARY : DEFAULT_LIGHT_PRIMARY

  const solid = toHex(parsed.r, parsed.g, parsed.b)
  const bgRef = isDark ? '#121215' : '#ffffff'
  if (contrastRatio(solid, bgRef) < 2.6)
    return isDark ? mixHex(solid, { r: 255, g: 255, b: 255 }, 0.35) : mixHex(solid, { r: 9, g: 9, b: 11 }, 0.35)

  return solid
}

export function buildNaiveThemeBundle(
  config: Partial<AppearancePanelConfig> | null | undefined,
  isDark: boolean,
): { overrides: GlobalThemeOverrides; cssVars: NaiveUiSyncVars } {
  const surface: CardSurfacePresetId = config?.cardSurface ?? 'default'
  const primary = resolvePrimaryAccent(config, isDark)
  const primaryHover = isDark
    ? mixHex(primary, { r: 255, g: 255, b: 255 }, 0.14)
    : mixHex(primary, { r: 9, g: 9, b: 11 }, 0.12)
  const primaryPressed = mixHex(primary, { r: 9, g: 9, b: 11 }, 0.24)
  const primaryFg = contrastRatio('#ffffff', primary) >= contrastRatio('#09090b', primary) ? '#ffffff' : '#09090b'

  const isBauhaus = surface === 'bauhaus-grid'
  const isFlat = isFlatGeometricSurface(surface)
  const radius = isBauhaus ? '0px' : isFlat ? '4px' : '6px'
  const modalRadius = isBauhaus ? '0px' : isFlat ? '4px' : '8px'

  const canvas = isDark
    ? '#09090b'
    : isBauhaus
      ? '#f4f1ea'
      : '#f5f5f3'
  const cardBg = isDark ? '#121215' : '#ffffff'
  const popoverBg = isDark ? '#16161a' : '#ffffff'
  const borderColor = isDark
    ? '#27272a'
    : isBauhaus
      ? '#18181b'
      : '#d4d4d8'
  const dividerColor = isDark ? '#27272a' : '#e4e4e7'
  const textBase = isDark ? '#fafafa' : '#09090b'
  const textMuted = isDark ? '#a1a1aa' : '#52525b'

  const overrides: GlobalThemeOverrides = {
    common: {
      primaryColor: primary,
      primaryColorHover: primaryHover,
      primaryColorPressed: primaryPressed,
      primaryColorSuppl: primaryHover,
      infoColor: '#2563eb',
      infoColorHover: '#1d4ed8',
      infoColorPressed: '#1e40af',
      successColor: '#16a34a',
      warningColor: '#ea580c',
      errorColor: '#dc2626',
      borderRadius: radius,
      borderRadiusSmall: radius,
      bodyColor: canvas,
      cardColor: cardBg,
      modalColor: cardBg,
      popoverColor: popoverBg,
      tableColor: cardBg,
      inputColor: isDark ? '#18181b' : '#ffffff',
      borderColor,
      dividerColor,
      textColorBase: textBase,
      textColor1: textBase,
      textColor2: textBase,
      textColor3: textMuted,
    },
    Button: {
      borderRadiusTiny: radius,
      borderRadiusSmall: radius,
      borderRadiusMedium: radius,
      borderRadiusLarge: radius,
      textColorPrimary: primaryFg,
      textColorHoverPrimary: primaryFg,
      textColorPressedPrimary: primaryFg,
      textColorFocusPrimary: primaryFg,
      fontWeight: '600',
    },
    Card: {
      borderRadius: modalRadius,
      borderColor,
      color: cardBg,
      colorModal: cardBg,
    },
    Input: {
      borderRadius: radius,
      border: `1px solid ${borderColor}`,
      borderHover: `1px solid ${primary}`,
      borderFocus: `1px solid ${primary}`,
      boxShadowFocus: `0 0 0 2px ${primary}28`,
    },
    Switch: {
      railBorderRadiusMedium: radius,
      railBorderRadiusSmall: radius,
      railBorderRadiusLarge: radius,
      buttonBorderRadius: radius,
      railColorActive: primary,
    },
    Checkbox: {
      borderRadius: isBauhaus ? '0px' : '2px',
      colorChecked: primary,
      borderChecked: `1px solid ${primary}`,
      borderFocus: `1px solid ${primary}`,
      checkMarkColor: primaryFg,
    },
    Tag: {
      borderRadius: radius,
    },
  }

  return {
    overrides,
    cssVars: {
      '--leon-ui-primary': primary,
      '--leon-ui-primary-hover': primaryHover,
      '--leon-ui-primary-fg': primaryFg,
      '--leon-ui-radius': radius,
      '--leon-ui-modal-radius': modalRadius,
      '--leon-ui-border': borderColor,
      '--leon-ui-surface': cardBg,
      '--leon-ui-canvas': canvas,
    },
  }
}
