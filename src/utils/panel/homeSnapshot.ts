// 首页分组和卡片的本地快照。同一浏览器刷新后，要等 authInfo 确认身份才读取。
// 身份只来自这次 authInfo：登录和公开访客分开，访客再用服务端返回的公开账号 ID。
// 不从本地保存的 userInfo 或 token 推断。快照不放 token、口令、账号资料和界面编辑态。

export const HOME_SNAPSHOT_VERSION = 1
export const HOME_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000
export const HOME_SNAPSHOT_STORAGE_KEY = 'leon.home.snapshot'
export const HOME_SNAPSHOT_EPOCH_KEY = 'leon.home.snapshot.epoch'
export const HOME_SNAPSHOT_MAX_BYTES = 200 * 1024

export type HomeSnapshotKind = 'login' | 'public'
export type HomeListOwnership = 'empty' | 'match' | 'foreign'

export interface HomeSnapshotIdentity {
  kind: HomeSnapshotKind
  accountId: number
}

export interface HomeCardSnapshot {
  id?: number
  title: string
  url: string
  lanUrl: string
  description: string
  openMethod: number
  sort: number
  itemIconGroupId?: number
  userId: number
  icon: HomeCardIconSnapshot | null
}

export interface HomeCardIconSnapshot {
  itemType: number
  src: string
  text: string
  backgroundColor: string
}

export interface HomeGroupSnapshot {
  id?: number
  title: string
  description: string
  icon: string
  sort: number
  iconStyle: number | null
  userId: number
  items: HomeCardSnapshot[]
}

export interface HomeSnapshotStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface SnapshotEntry {
  savedAt: number
  groups: HomeGroupSnapshot[]
}

interface SnapshotDocument {
  version: number
  epoch: number
  entries: Record<string, SnapshotEntry>
}

const TEXT_LIMIT = 1000

export function homeSnapshotSource(identity: HomeSnapshotIdentity): string {
  return `${identity.kind}:${identity.accountId}`
}

export function identityFromAuthInfo(data: unknown): HomeSnapshotIdentity | null {
  if (!data || typeof data !== 'object')
    return null
  const record = data as { visitMode?: unknown; user?: unknown }
  const kind: HomeSnapshotKind | null = record.visitMode === 0 ? 'login' : record.visitMode === 1 ? 'public' : null
  if (!kind || !record.user || typeof record.user !== 'object')
    return null
  const accountId = positiveId((record.user as { id?: unknown }).id)
  if (accountId === null)
    return null
  return { kind, accountId }
}

export function homeListOwnership(items: unknown, accountId: number): HomeListOwnership {
  if (!Array.isArray(items))
    return 'foreign'
  if (items.length === 0)
    return 'empty'
  for (const group of items) {
    if (!group || typeof group !== 'object' || Array.isArray(group))
      return 'foreign'
    if ((group as { userId?: unknown }).userId !== accountId)
      return 'foreign'
    const cards = (group as { items?: unknown }).items
    if (!Array.isArray(cards))
      return 'foreign'
    for (const card of cards) {
      if (!card || typeof card !== 'object' || Array.isArray(card))
        return 'foreign'
      if ((card as { userId?: unknown }).userId !== accountId)
        return 'foreign'
    }
  }
  return 'match'
}

export function cacheableHomeGroups(items: unknown, accountId: number): HomeGroupSnapshot[] | null {
  const ownership = homeListOwnership(items, accountId)
  if (ownership === 'foreign')
    return null
  if (ownership === 'empty')
    return []
  const groups: HomeGroupSnapshot[] = []
  for (const group of items as unknown[]) {
    const snapshot = snapshotGroup(group, accountId)
    if (!snapshot)
      return null
    groups.push(snapshot)
  }
  return groups
}

export function browserHomeStorage(): HomeSnapshotStorage {
  return window.localStorage
}

export function readHomeSnapshotEpoch(storage: HomeSnapshotStorage): number | null {
  try {
    const raw = storage.getItem(HOME_SNAPSHOT_EPOCH_KEY)
    if (!raw)
      return 0
    const parsed = JSON.parse(raw) as { version?: unknown; epoch?: unknown }
    if (parsed.version !== HOME_SNAPSHOT_VERSION || !isNonNegativeInteger(parsed.epoch))
      return 0
    return parsed.epoch
  }
  catch {
    return null
  }
}

export function readHomeSnapshot(storage: HomeSnapshotStorage, identity: HomeSnapshotIdentity, now: number): HomeGroupSnapshot[] | null {
  try {
    const raw = storage.getItem(HOME_SNAPSHOT_STORAGE_KEY)
    if (!raw)
      return null
    const document = parseDocument(raw)
    const epoch = readHomeSnapshotEpoch(storage)
    if (!document || epoch === null || document.epoch !== epoch)
      return null
    const entry = document.entries[homeSnapshotSource(identity)]
    if (!entry || !isFresh(entry.savedAt, now))
      return null
    return cacheableHomeGroups(entry.groups, identity.accountId)
  }
  catch {
    return null
  }
}

export function writeHomeSnapshot(storage: HomeSnapshotStorage, identity: HomeSnapshotIdentity, items: unknown, epochAtStart: number | null, now: number, maxBytes = HOME_SNAPSHOT_MAX_BYTES): boolean {
  const groups = cacheableHomeGroups(items, identity.accountId)
  if (!groups || epochAtStart === null)
    return false
  try {
    if (readHomeSnapshotEpoch(storage) !== epochAtStart)
      return false
    const document = loadWritableDocument(storage, epochAtStart)
    const source = homeSnapshotSource(identity)
    document.entries[source] = { savedAt: now, groups }
    document.epoch = epochAtStart
    pruneDocument(document, now)
    if (!fitDocument(document, source, maxBytes))
      return false
    return commitDocument(storage, document, epochAtStart)
  }
  catch {
    return false
  }
}

export function dropHomeSnapshot(storage: HomeSnapshotStorage, identity: HomeSnapshotIdentity, epochAtStart: number | null): boolean {
  if (epochAtStart === null)
    return false
  try {
    if (readHomeSnapshotEpoch(storage) !== epochAtStart)
      return false
    const raw = storage.getItem(HOME_SNAPSHOT_STORAGE_KEY)
    if (!raw)
      return false
    const document = parseDocument(raw)
    if (!document || document.epoch !== epochAtStart)
      return false
    const source = homeSnapshotSource(identity)
    if (!document.entries[source])
      return false
    delete document.entries[source]
    return commitDocument(storage, document, epochAtStart)
  }
  catch {
    return false
  }
}

export interface HomeSnapshotClearResult {
  ok: boolean
  removed: boolean
}

export function clearHomeSnapshots(storage: HomeSnapshotStorage): HomeSnapshotClearResult {
  try {
    const current = readHomeSnapshotEpoch(storage)
    const epoch = current === null ? 1 : current + 1
    storage.setItem(HOME_SNAPSHOT_EPOCH_KEY, JSON.stringify({ version: HOME_SNAPSHOT_VERSION, epoch }))
    const removed = storage.getItem(HOME_SNAPSHOT_STORAGE_KEY) !== null
    storage.removeItem(HOME_SNAPSHOT_STORAGE_KEY)
    return { ok: true, removed }
  }
  catch {
    return { ok: false, removed: false }
  }
}

function snapshotGroup(value: unknown, accountId: number): HomeGroupSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const group = value as Record<string, unknown>
  if (group.userId !== accountId)
    return null
  const cards = group.items
  if (!Array.isArray(cards))
    return null
  const items: HomeCardSnapshot[] = []
  for (const card of cards) {
    const snapshot = snapshotCard(card, accountId)
    if (!snapshot)
      return null
    items.push(snapshot)
  }
  return {
    id: optionalId(group.id),
    title: boundedText(group.title),
    description: boundedText(group.description),
    icon: boundedText(group.icon),
    sort: finite(group.sort),
    iconStyle: group.iconStyle === 0 || group.iconStyle === 1 ? group.iconStyle : null,
    userId: accountId,
    items,
  }
}

function snapshotCard(value: unknown, accountId: number): HomeCardSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const card = value as Record<string, unknown>
  if (card.userId !== accountId)
    return null
  return {
    id: optionalId(card.id),
    title: boundedText(card.title),
    url: boundedText(card.url),
    lanUrl: boundedText(card.lanUrl),
    description: boundedText(card.description),
    openMethod: finite(card.openMethod),
    sort: finite(card.sort),
    itemIconGroupId: optionalId(card.itemIconGroupId),
    userId: accountId,
    icon: snapshotIcon(card.icon),
  }
}

function snapshotIcon(value: unknown): HomeCardIconSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const icon = value as Record<string, unknown>
  return {
    itemType: finite(icon.itemType),
    src: boundedText(icon.src),
    text: boundedText(icon.text),
    backgroundColor: boundedText(icon.backgroundColor),
  }
}

function parseDocument(raw: string): SnapshotDocument | null {
  const parsed = JSON.parse(raw) as { version?: unknown; epoch?: unknown; entries?: unknown }
  if (parsed.version !== HOME_SNAPSHOT_VERSION || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries))
    return null
  const entries: Record<string, SnapshotEntry> = {}
  for (const [source, entry] of Object.entries(parsed.entries as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      continue
    const savedAt = (entry as { savedAt?: unknown }).savedAt
    const groups = (entry as { groups?: unknown }).groups
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || !Array.isArray(groups))
      continue
    entries[source] = { savedAt, groups: groups as HomeGroupSnapshot[] }
  }
  return {
    version: HOME_SNAPSHOT_VERSION,
    epoch: isNonNegativeInteger(parsed.epoch) ? parsed.epoch : 0,
    entries,
  }
}

function loadWritableDocument(storage: HomeSnapshotStorage, epoch: number): SnapshotDocument {
  const blank = { version: HOME_SNAPSHOT_VERSION, epoch, entries: {} }
  try {
    const raw = storage.getItem(HOME_SNAPSHOT_STORAGE_KEY)
    if (!raw)
      return blank
    const document = parseDocument(raw)
    if (!document || document.epoch !== epoch)
      return blank
    return document
  }
  catch {
    return blank
  }
}

function commitDocument(storage: HomeSnapshotStorage, document: SnapshotDocument, epochAtStart: number): boolean {
  if (readHomeSnapshotEpoch(storage) !== epochAtStart)
    return false
  storage.setItem(HOME_SNAPSHOT_STORAGE_KEY, JSON.stringify(document))
  if (readHomeSnapshotEpoch(storage) === epochAtStart)
    return true
  const current = storage.getItem(HOME_SNAPSHOT_STORAGE_KEY)
  const written = current ? parseDocument(current) : null
  if (written?.epoch === epochAtStart)
    storage.removeItem(HOME_SNAPSHOT_STORAGE_KEY)
  return false
}

function pruneDocument(document: SnapshotDocument, now: number) {
  for (const [source, entry] of Object.entries(document.entries)) {
    if (!isFresh(entry.savedAt, now))
      delete document.entries[source]
  }
}

function fitDocument(document: SnapshotDocument, keep: string, maxBytes: number): boolean {
  const oldestFirst = Object.entries(document.entries).sort((left, right) => left[1].savedAt - right[1].savedAt)
  for (const [source] of oldestFirst) {
    if (encodedSize(document) <= maxBytes)
      return true
    if (source !== keep)
      delete document.entries[source]
  }
  return encodedSize(document) <= maxBytes
}

function encodedSize(document: SnapshotDocument): number {
  return JSON.stringify(document).length
}

function isFresh(savedAt: number, now: number): boolean {
  if (!Number.isFinite(savedAt) || !Number.isFinite(now))
    return false
  if (savedAt > now + 5 * 60 * 1000)
    return false
  return now - savedAt < HOME_SNAPSHOT_TTL_MS
}

function positiveId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    return null
  return value
}

function optionalId(value: unknown): number | undefined {
  return positiveId(value) ?? undefined
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function boundedText(value: unknown): string {
  if (typeof value !== 'string')
    return ''
  return value.length > TEXT_LIMIT ? value.slice(0, TEXT_LIMIT) : value
}
