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

export type DesktopWidgetType = 'memo' | 'iframe' | 'clock' | 'todo' | 'countdown'

export interface DesktopTodoItem {
  id: string
  text: string
  done: boolean
}

export interface DesktopCountdownEntry {
  id: string
  label: string
  targetDate: string // YYYY-MM-DD
}

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
  todoItems?: DesktopTodoItem[]
  countdownEntries?: DesktopCountdownEntry[]
}

export interface WidgetCatalogEntry {
  type: DesktopWidgetType
  icon: string
  accent: string
  nameKey: string
  tagKey: string
  isNew?: boolean
}

export const WIDGET_CATALOG: readonly WidgetCatalogEntry[] = [
  {
    type: 'todo',
    icon: 'lucide:check',
    accent: '#10b981',
    nameKey: 'apps.leonStudio.widgetTodoName',
    tagKey: 'apps.leonStudio.widgetTodoTag',
    isNew: true,
  },
  {
    type: 'countdown',
    icon: 'lucide:calendar',
    accent: '#f59e0b',
    nameKey: 'apps.leonStudio.widgetCountdownName',
    tagKey: 'apps.leonStudio.widgetCountdownTag',
    isNew: true,
  },
  {
    type: 'clock',
    icon: 'lucide:gauge',
    accent: '#0ea5e9',
    nameKey: 'apps.leonStudio.addClockWidget',
    tagKey: 'apps.leonStudio.widgetClockTag',
  },
  {
    type: 'memo',
    icon: 'lucide:notebook-pen',
    accent: '#8b5cf6',
    nameKey: 'apps.leonStudio.addMemoWidget',
    tagKey: 'apps.leonStudio.widgetMemoTag',
  },
  {
    type: 'iframe',
    icon: 'lucide:code-2',
    accent: '#64748b',
    nameKey: 'apps.leonStudio.addIframeWidget',
    tagKey: 'apps.leonStudio.widgetIframeTag',
  },
]

export interface LeonStudioConfig {
  effects: StudioEffectsConfig
  modular: StudioModularStyleConfig
  widgets: DesktopWidgetItem[]
}

export const STUDIO_CONFIG_MODULE_NAME = 'leonStudioConfig'
export const MAX_DESKTOP_WIDGETS = 12
export const MAX_TODO_ITEMS = 30
export const MAX_COUNTDOWN_ENTRIES = 8

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function formatIsoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeIsoDate(raw: unknown): string {
  if (typeof raw !== 'string')
    return ''
  const trimmed = raw.trim()
  if (!ISO_DATE_RE.test(trimmed))
    return ''
  const [y, m, d] = trimmed.split('-').map(Number)
  const check = new Date(y, m - 1, d)
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d)
    return ''
  return trimmed
}

export function computeCountdownDays(targetDate: string, now = new Date()): number | null {
  const valid = normalizeIsoDate(targetDate)
  if (!valid)
    return null
  const [y, m, d] = valid.split('-').map(Number)
  const targetUtc = Date.UTC(y, m - 1, d)
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((targetUtc - todayUtc) / 86400000)
}

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
  return value === 'memo'
    || value === 'iframe'
    || value === 'clock'
    || value === 'todo'
    || value === 'countdown'
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

function normalizeTodoItems(raw: unknown): DesktopTodoItem[] {
  if (!Array.isArray(raw))
    return []
  const list: DesktopTodoItem[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (list.length >= MAX_TODO_ITEMS)
      break
    if (!entry || typeof entry !== 'object')
      continue
    const obj = entry as Record<string, unknown>
    const text = typeof obj.text === 'string' ? obj.text.trim().slice(0, 140) : ''
    if (!text)
      continue
    const id = (typeof obj.id === 'string' && obj.id.trim() !== '')
      ? obj.id.trim().slice(0, 64)
      : `todo-${list.length + 1}`
    if (seen.has(id))
      continue
    seen.add(id)
    list.push({
      id,
      text,
      done: Boolean(obj.done),
    })
  }
  return list
}

function normalizeCountdownEntries(raw: unknown): DesktopCountdownEntry[] {
  if (!Array.isArray(raw))
    return []
  const list: DesktopCountdownEntry[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (list.length >= MAX_COUNTDOWN_ENTRIES)
      break
    if (!entry || typeof entry !== 'object')
      continue
    const obj = entry as Record<string, unknown>
    const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, 60) : ''
    const targetDate = normalizeIsoDate(obj.targetDate)
    if (!label && !targetDate)
      continue
    const id = (typeof obj.id === 'string' && obj.id.trim() !== '')
      ? obj.id.trim().slice(0, 64)
      : `cd-${list.length + 1}`
    if (seen.has(id))
      continue
    seen.add(id)
    list.push({
      id,
      label: label || 'Renewal',
      targetDate,
    })
  }
  return list
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
      else if (item.type === 'todo') {
        base.todoItems = normalizeTodoItems(item.todoItems)
      }
      else if (item.type === 'countdown') {
        base.countdownEntries = normalizeCountdownEntries(item.countdownEntries)
      }
      widgets.push(base)
    }
  }

  return { effects, modular, widgets }
}

export function createDesktopWidget(type: DesktopWidgetType, idSeed = Date.now(), now = new Date()): DesktopWidgetItem {
  const id = `${type}-${idSeed}`
  if (type === 'todo') {
    return {
      id,
      type: 'todo',
      title: 'TODO',
      enabled: true,
      colSpan: 1,
      todoItems: [
        { id: `t-${idSeed}-1`, text: '检查 Docker 镜像更新', done: false },
      ],
    }
  }
  if (type === 'countdown') {
    const defaultDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)
    return {
      id,
      type: 'countdown',
      title: 'RENEWAL',
      enabled: true,
      colSpan: 1,
      countdownEntries: [
        { id: `c-${idSeed}-1`, label: '域名 / VPS 续期', targetDate: formatIsoDateLocal(defaultDate) },
      ],
    }
  }
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
