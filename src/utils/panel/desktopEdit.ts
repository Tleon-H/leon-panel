import type { DesktopLayoutGroupPayload, DesktopLayoutSavePayload } from '@/api/panel/itemIconGroup'
import type { DesktopWidgetItem, LeonStudioConfig } from '@/utils/studio/studioConfig'

export interface DesktopEditableItem {
  id?: number
  itemIconGroupId?: number
  sort?: number
  title?: string
  url?: string
  lanUrl?: string
  description?: string
  openMethod?: number
  icon?: Panel.ItemIcon | null
}

export interface DesktopEditableGroup<TItem extends DesktopEditableItem = DesktopEditableItem> {
  id?: number
  title?: string
  icon?: string
  iconStyle?: number | null
  sort?: number
  items?: TItem[]
}

export interface DesktopLayoutSnapshot<
  TGroup extends DesktopEditableGroup<TItem>,
  TItem extends DesktopEditableItem = DesktopEditableItem,
> {
  groups: TGroup[]
  widgets: DesktopWidgetItem[]
  groupIds: number[]
  groupMetaMap: Record<number, string>
  itemGroupMap: Record<number, number>
  itemMetaMap: Record<number, string>
  groupItemIds: Record<number, number[]>
  widgetSignature: string
}

export interface DesktopLayoutDiff<TItem extends DesktopEditableItem = DesktopEditableItem> {
  groupsReordered: boolean
  groupMetaChanged: boolean
  deletedGroupIds: number[]
  deletedItemIds: number[]
  groupSortItems: Array<{ id: number; sort: number }>
  dirtyItemGroups: Array<{
    itemIconGroupId: number
    sortItems: Array<{ id: number; sort: number }>
  }>
  movedItems: Array<{
    item: TItem
    fromGroupId: number
    toGroupId: number
  }>
  widgetsChanged: boolean
  hasChanges: boolean
  changeCount: number
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function serializeGroupMeta(group: DesktopEditableGroup): string {
  return JSON.stringify({
    title: group.title ?? '',
    icon: group.icon ?? '',
    iconStyle: group.iconStyle ?? null,
  })
}

function serializeItemMeta(item: DesktopEditableItem): string {
  return JSON.stringify({
    title: item.title ?? '',
    url: item.url ?? '',
    lanUrl: item.lanUrl ?? '',
    description: item.description ?? '',
    openMethod: item.openMethod ?? 2,
    icon: item.icon ?? null,
  })
}

export function serializeWidgetLayout(widgets: readonly DesktopWidgetItem[]): string {
  return JSON.stringify(widgets.map(w => ({
    id: w.id,
    colSpan: w.colSpan,
    enabled: w.enabled,
  })))
}

export function createDesktopLayoutSnapshot<
  TGroup extends DesktopEditableGroup<TItem>,
  TItem extends DesktopEditableItem = DesktopEditableItem,
>(
  groups: readonly TGroup[],
  widgets: readonly DesktopWidgetItem[],
): DesktopLayoutSnapshot<TGroup, TItem> {
  const clonedGroups = cloneJson(groups) as TGroup[]
  const clonedWidgets = cloneJson(widgets) as DesktopWidgetItem[]
  const groupIds: number[] = []
  const groupMetaMap: Record<number, string> = {}
  const itemGroupMap: Record<number, number> = {}
  const itemMetaMap: Record<number, string> = {}
  const groupItemIds: Record<number, number[]> = {}

  for (const group of clonedGroups) {
    if (typeof group.id !== 'number')
      continue
    groupIds.push(group.id)
    groupMetaMap[group.id] = serializeGroupMeta(group)
    const ids: number[] = []
    for (const item of group.items || []) {
      if (typeof item.id !== 'number')
        continue
      ids.push(item.id)
      itemGroupMap[item.id] = group.id
      itemMetaMap[item.id] = serializeItemMeta(item)
    }
    groupItemIds[group.id] = ids
  }

  return {
    groups: clonedGroups,
    widgets: clonedWidgets,
    groupIds,
    groupMetaMap,
    itemGroupMap,
    itemMetaMap,
    groupItemIds,
    widgetSignature: serializeWidgetLayout(clonedWidgets),
  }
}

export function syncGroupOwnership<
  TGroup extends DesktopEditableGroup<TItem>,
  TItem extends DesktopEditableItem = DesktopEditableItem,
>(groups: readonly TGroup[]): void {
  for (const group of groups) {
    if (typeof group.id !== 'number' || !Array.isArray(group.items))
      continue
    for (const item of group.items)
      item.itemIconGroupId = group.id
  }
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false
  }
  return true
}

export function diffDesktopLayoutChanges<
  TGroup extends DesktopEditableGroup<TItem>,
  TItem extends DesktopEditableItem = DesktopEditableItem,
>(
  snapshot: DesktopLayoutSnapshot<TGroup, TItem> | null,
  currentGroups: readonly TGroup[],
  currentWidgets: readonly DesktopWidgetItem[],
): DesktopLayoutDiff<TItem> {
  if (!snapshot) {
    return {
      groupsReordered: false,
      groupMetaChanged: false,
      deletedGroupIds: [],
      deletedItemIds: [],
      groupSortItems: [],
      dirtyItemGroups: [],
      movedItems: [],
      widgetsChanged: false,
      hasChanges: false,
      changeCount: 0,
    }
  }

  const currentGroupIds: number[] = []
  const survivingGroupSet = new Set<number>()
  const survivingItemSet = new Set<number>()
  const groupSortItems: Array<{ id: number; sort: number }> = []
  const dirtyItemGroups: Array<{
    itemIconGroupId: number
    sortItems: Array<{ id: number; sort: number }>
  }> = []
  const movedItems: Array<{ item: TItem; fromGroupId: number; toGroupId: number }> = []
  let groupMetaChangeCount = 0
  let itemMetaChangeCount = 0

  for (let gIdx = 0; gIdx < currentGroups.length; gIdx++) {
    const group = currentGroups[gIdx]
    if (typeof group.id !== 'number')
      continue
    currentGroupIds.push(group.id)
    if (group.id > 0) {
      survivingGroupSet.add(group.id)
      groupSortItems.push({ id: group.id, sort: gIdx + 1 })
      if (snapshot.groupMetaMap[group.id] !== serializeGroupMeta(group))
        groupMetaChangeCount += 1
    }
    else {
      // Newly created draft group
      groupMetaChangeCount += 1
    }

    const currentItemIds: number[] = []
    const sortItems: Array<{ id: number; sort: number }> = []
    const groupItems = group.items || []

    for (let i = 0; i < groupItems.length; i++) {
      const item = groupItems[i]
      if (typeof item.id !== 'number')
        continue
      currentItemIds.push(item.id)
      if (item.id > 0) {
        survivingItemSet.add(item.id)
        sortItems.push({ id: item.id, sort: i + 1 })
        const originalGroupId = snapshot.itemGroupMap[item.id]
        if (typeof originalGroupId === 'number' && originalGroupId !== group.id) {
          movedItems.push({
            item,
            fromGroupId: originalGroupId,
            toGroupId: group.id,
          })
        }
        if (snapshot.itemMetaMap[item.id] !== serializeItemMeta(item))
          itemMetaChangeCount += 1
      }
      else {
        // Newly created draft item
        itemMetaChangeCount += 1
      }
    }

    if (group.id > 0) {
      const originalItemIds = snapshot.groupItemIds[group.id] || []
      if (!arraysEqual(originalItemIds, currentItemIds)) {
        dirtyItemGroups.push({
          itemIconGroupId: group.id,
          sortItems,
        })
      }
    }
  }

  const deletedGroupIds = snapshot.groupIds.filter(id => id > 0 && !survivingGroupSet.has(id))
  const deletedItemIds = Object.keys(snapshot.itemGroupMap)
    .map(Number)
    .filter(id => id > 0 && !survivingItemSet.has(id))

  const groupsReordered = !arraysEqual(snapshot.groupIds, currentGroupIds)
  const groupMetaChanged = groupMetaChangeCount > 0 || deletedGroupIds.length > 0
  const widgetsChanged = serializeWidgetLayout(currentWidgets) !== snapshot.widgetSignature
  const changeCount
    = (groupsReordered ? 1 : 0)
    + groupMetaChangeCount
    + deletedGroupIds.length
    + dirtyItemGroups.length
    + itemMetaChangeCount
    + deletedItemIds.length
    + (widgetsChanged ? 1 : 0)

  return {
    groupsReordered,
    groupMetaChanged,
    deletedGroupIds,
    deletedItemIds,
    groupSortItems,
    dirtyItemGroups,
    movedItems,
    widgetsChanged,
    hasChanges: changeCount > 0,
    changeCount,
  }
}

export function buildDesktopLayoutSavePayload<
  TGroup extends DesktopEditableGroup<TItem>,
  TItem extends DesktopEditableItem = DesktopEditableItem,
>(
  snapshot: DesktopLayoutSnapshot<TGroup, TItem> | null,
  currentGroups: readonly TGroup[],
  studioConfig: LeonStudioConfig,
): DesktopLayoutSavePayload {
  const diff = diffDesktopLayoutChanges(snapshot, currentGroups, studioConfig.widgets)
  const groups: DesktopLayoutGroupPayload[] = currentGroups.map((group, gIdx) => {
    const rawGroupId = typeof group.id === 'number' ? group.id : 0
    const persistedGroupId = rawGroupId > 0 ? rawGroupId : 0
    const items = (group.items || []).map((item, iIdx) => {
      const rawItemId = typeof item.id === 'number' ? item.id : 0
      const persistedItemId = rawItemId > 0 ? rawItemId : 0
      return {
        id: persistedItemId,
        tempId: persistedItemId === 0 ? `tmp-item-${rawItemId || iIdx}` : undefined,
        icon: item.icon ?? null,
        title: (item.title || '').trim(),
        url: item.url || '',
        lanUrl: item.lanUrl || '',
        description: item.description || '',
        openMethod: item.openMethod || 2,
        sort: iIdx + 1,
      }
    })

    return {
      id: persistedGroupId,
      tempId: persistedGroupId === 0 ? `tmp-group-${rawGroupId || gIdx}` : undefined,
      title: (group.title || '').trim(),
      icon: group.icon || 'lucide:folder-kanban',
      iconStyle: group.iconStyle === undefined ? null : group.iconStyle,
      sort: gIdx + 1,
      items,
    }
  })

  return {
    groups,
    deletedGroupIds: diff.deletedGroupIds,
    deletedItemIds: diff.deletedItemIds,
    studioConfig: diff.widgetsChanged ? cloneJson(studioConfig) as unknown as Record<string, unknown> : null,
  }
}

export function moveArrayItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length)
    return [...list]
  const next = [...list]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}
