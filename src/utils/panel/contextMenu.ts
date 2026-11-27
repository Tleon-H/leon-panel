// 首页右键菜单按本次点选的地址和打开方式打开，不看当前内外网模式，也不看卡片保存的打开方式。
// 只有 http 和 https 会打开。没有协议的主机地址按 http 补全。javascript、data 以及其他协议不会打开。

export const contextOpenCurrent = 1
export const contextOpenNewTab = 2
export const contextOpenWindow = 3
export const contextNewTabFeatures = 'noopener,noreferrer'
export const contextAddressLimit = 1000

export type ContextAddressKind = 'url' | 'lan'
export type ContextOpenMethod = 1 | 2 | 3

export interface ContextAddressSource {
  url?: unknown
  lanUrl?: unknown
  openMethod?: unknown
}

export interface ContextMenuEntry {
  key: string
  labelKey: string
  children?: ContextMenuEntry[]
}

export interface ContextOpenChoice {
  kind: ContextAddressKind
  method: ContextOpenMethod
  href: string
}

export function isFilledContextAddress(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().length > 0
}

export function openableContextHref(raw: unknown): string | null {
  if (!isFilledContextAddress(raw) || typeof raw !== 'string')
    return null
  const trimmed = raw.trim()
  if (trimmed.length > contextAddressLimit)
    return null
  if (hasControlCharacter(trimmed) || trimmed.includes('\\') || /\s/.test(trimmed))
    return null

  // 带点的主机加端口会像协议，所以先认完整的 http(s) 和主机写法，再拒绝其余协议。
  if (/^https?:\/\//i.test(trimmed))
    return acceptedHttp(trimmed, true)
  if (trimmed.startsWith('//'))
    return acceptedHttp(`http:${trimmed}`, false)
  if (isSchemelessAddress(trimmed))
    return acceptedHttp(`http://${trimmed}`, false)
  return null
}

export function contextMenuEntries(item: ContextAddressSource, loggedIn: boolean): ContextMenuEntry[] {
  const entries: ContextMenuEntry[] = []
  if (isFilledContextAddress(item.url))
    entries.push(addressGroup('url', 'panelHome.contextDefaultAddress'))
  if (isFilledContextAddress(item.lanUrl))
    entries.push(addressGroup('lan', 'panelHome.contextLanAddress'))
  if (loggedIn) {
    entries.push({ key: 'edit', labelKey: 'common.edit' })
    entries.push({ key: 'delete', labelKey: 'common.delete' })
  }
  return entries
}

export function resolveContextMenuChoice(item: ContextAddressSource, key: string): ContextOpenChoice | 'edit' | 'delete' | null {
  if (key === 'edit' || key === 'delete')
    return key
  const matched = /^open:(url|lan):([123])$/.exec(key)
  if (!matched)
    return null
  const kind = matched[1] as ContextAddressKind
  const method = Number(matched[2]) as ContextOpenMethod
  const href = openableContextHref(kind === 'url' ? item.url : item.lanUrl)
  if (!href)
    return null
  return { kind, method, href }
}

// 卡片左键点击、键盘回车与 Dock 快捷打开共用同一协议白名单：
// 内网模式下有非空内网地址则选 lanUrl，否则回退默认 url；所有目标均须经 openableContextHref 校验。
export function resolvePrimaryItemOpen(item: ContextAddressSource, preferLan: boolean): ContextOpenChoice | null {
  const hasLan = isFilledContextAddress(item.lanUrl)
  const kind: ContextAddressKind = (preferLan && hasLan) ? 'lan' : 'url'
  const href = openableContextHref(kind === 'lan' ? item.lanUrl : item.url)
  if (!href)
    return null
  const method = normalizeOpenMethod(item.openMethod)
  if (!method)
    return null
  return { kind, method, href }
}

function normalizeOpenMethod(raw: unknown): ContextOpenMethod | null {
  if (raw === contextOpenCurrent || raw === contextOpenNewTab || raw === contextOpenWindow)
    return raw
  return null
}

function addressGroup(kind: ContextAddressKind, labelKey: string): ContextMenuEntry {
  return {
    key: `address:${kind}`,
    labelKey,
    children: [
      { key: `open:${kind}:${contextOpenCurrent}`, labelKey: 'panelHome.contextOpenCurrent' },
      { key: `open:${kind}:${contextOpenNewTab}`, labelKey: 'panelHome.contextOpenNewTab' },
      { key: `open:${kind}:${contextOpenWindow}`, labelKey: 'panelHome.contextOpenWindow' },
    ],
  }
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127)
      return true
  }
  return false
}

function acceptedHttp(value: string, preserve: boolean): string | null {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    return null
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '')
    return null
  return preserve ? value : url.href
}

function isSchemelessAddress(value: string): boolean {
  if (value.includes('@'))
    return false
  if (value.startsWith('['))
    return /^\[[0-9a-f:.]+\](?::\d{1,5})?(?:[/?#].*)?$/i.test(value)
  return /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)(?::\d{1,5})?(?:[/?#].*)?$/i.test(value)
}
