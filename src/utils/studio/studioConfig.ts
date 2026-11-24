import {
  type StudioModularStyleConfig,
  defaultModularStyleConfig,
  normalizeModularStyleConfig,
} from './modularStyle'

export interface StudioEffectsConfig {
  gridOverlay: boolean
  hardShadowHover: boolean
  reduceMotion: boolean
  enhancedClock: boolean
  clockGreeting: string
}

export type DesktopWidgetType = 'memo' | 'iframe' | 'clock'

export interface DesktopWidgetItem {
  id: string
  type: DesktopWidgetType
  title: string
  enabled: boolean
  colSpan: 1 | 2
  content?: string
  url?: string
  height?: number
  showSeconds?: boolean
  use24Hour?: boolean
  subtitle?: string
}

export interface LeonStudioConfig {
  effects: StudioEffectsConfig
  modular: StudioModularStyleConfig
  widgets: DesktopWidgetItem[]
}

export const STUDIO_CONFIG_MODULE_NAME = 'leonStudioConfig'
export const MAX_DESKTOP_WIDGETS = 12

export function defaultStudioConfig(): LeonStudioConfig {
  return {
    effects: {
      gridOverlay: false,
      hardShadowHover: true,
      reduceMotion: false,
      enhancedClock: false,
      clockGreeting: '',
    },
    modular: defaultModularStyleConfig(),
    widgets: [],
  }
}

export function isDesktopWidgetType(value: unknown): value is DesktopWidgetType {
  return value === 'memo' || value === 'iframe' || value === 'clock'
}

export function sanitizeWidgetUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string')
    return ''
  const trimmed = raw.trim()
  if (!trimmed)
    return ''
  if (trimmed.startsWith('/') && !trimmed.startsWith('//'))
    return trimmed
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      return parsed.toString()
  }
  catch {
    return ''
  }
  return ''
}

function clampHeight(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num))
    return 240
  return Math.min(720, Math.max(120, Math.round(num)))
}

export function normalizeStudioConfig(raw: unknown): LeonStudioConfig {
  const defaults = defaultStudioConfig()
  if (!raw || typeof raw !== 'object')
    return defaults
  const obj = raw as Record<string, unknown>
  const rawEffects = (obj.effects && typeof obj.effects === 'object')
    ? obj.effects as Record<string, unknown>
    : {}

  const effects: StudioEffectsConfig = {
    gridOverlay: Boolean(rawEffects.gridOverlay),
    hardShadowHover: typeof rawEffects.hardShadowHover === 'boolean' ? rawEffects.hardShadowHover : defaults.effects.hardShadowHover,
    reduceMotion: Boolean(rawEffects.reduceMotion),
    enhancedClock: Boolean(rawEffects.enhancedClock),
    clockGreeting: typeof rawEffects.clockGreeting === 'string' ? rawEffects.clockGreeting.slice(0, 80) : '',
  }

  const modular = normalizeModularStyleConfig(obj.modular)

  const widgets: DesktopWidgetItem[] = []
  if (Array.isArray(obj.widgets)) {
    const seen = new Set<string>()
    for (const entry of obj.widgets) {
      if (widgets.length >= MAX_DESKTOP_WIDGETS)
        break
      if (!entry || typeof entry !== 'object')
        continue
      const item = entry as Record<string, unknown>
      if (!isDesktopWidgetType(item.type))
        continue
      const rawId = (typeof item.id === 'string' && item.id.trim() !== '')
        ? item.id.trim().slice(0, 64)
        : `widget-${widgets.length + 1}`
      if (seen.has(rawId))
        continue
      seen.add(rawId)
      const colSpan: 1 | 2 = item.colSpan === 2 ? 2 : 1
      const base: DesktopWidgetItem = {
        id: rawId,
        type: item.type,
        title: typeof item.title === 'string' ? item.title.slice(0, 60) : '',
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        colSpan,
      }
      if (item.type === 'memo') {
        base.content = typeof item.content === 'string' ? item.content.slice(0, 4000) : ''
      }
      else if (item.type === 'iframe') {
        base.url = sanitizeWidgetUrl(typeof item.url === 'string' ? item.url : '')
        base.height = clampHeight(item.height)
      }
      else if (item.type === 'clock') {
        base.showSeconds = typeof item.showSeconds === 'boolean' ? item.showSeconds : true
        base.use24Hour = typeof item.use24Hour === 'boolean' ? item.use24Hour : true
        base.subtitle = typeof item.subtitle === 'string' ? item.subtitle.slice(0, 80) : ''
      }
      widgets.push(base)
    }
  }

  return { effects, modular, widgets }
}

export function createDesktopWidget(type: DesktopWidgetType, idSeed = Date.now()): DesktopWidgetItem {
  const id = `${type}-${idSeed}`
  if (type === 'memo') {
    return {
      id,
      type: 'memo',
      title: 'NOTE',
      enabled: true,
      colSpan: 1,
      content: '',
    }
  }
  if (type === 'iframe') {
    return {
      id,
      type: 'iframe',
      title: 'WIDGET',
      enabled: true,
      colSpan: 2,
      url: '',
      height: 240,
    }
  }
  return {
    id,
    type: 'clock',
    title: 'CLOCK',
    enabled: true,
    colSpan: 1,
    showSeconds: true,
    use24Hour: true,
    subtitle: 'HOMELAB READY',
  }
}
