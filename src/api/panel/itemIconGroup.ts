import { post } from '@/utils/request'

export function edit<T>(req: Panel.ItemIconGroup) {
  return post<T>({
    url: '/panel/itemIconGroup/edit',
    data: req,
  })
}

export function getList<T>(includeItems = false, sessionCurrent?: () => boolean) {
  return post<T>({
    url: '/panel/itemIconGroup/getList',
    data: { includeItems },
    sessionCurrent,
  })
}

export function deletes<T>(ids: number[]) {
  return post<T>({
    url: '/panel/itemIconGroup/deletes',
    data: { ids },
  })
}

export function saveSort<T>(sortItems: Common.SortItemRequest[]) {
  return post<T>({
    url: '/panel/itemIconGroup/saveSort',
    data: { sortItems },
  })
}

export interface DesktopLayoutItemPayload {
  id: number
  tempId?: string
  icon: Panel.ItemIcon | null
  title: string
  url: string
  lanUrl?: string
  description?: string
  openMethod: number
  sort: number
}

export interface DesktopLayoutGroupPayload {
  id: number
  tempId?: string
  title: string
  icon?: string
  description?: string
  iconStyle?: number | null
  sort: number
  items: DesktopLayoutItemPayload[]
}

export interface DesktopLayoutSavePayload {
  groups: DesktopLayoutGroupPayload[]
  deletedGroupIds: number[]
  deletedItemIds: number[]
  studioConfig?: Record<string, unknown> | null
}

export function saveDesktopLayout<T>(data: DesktopLayoutSavePayload) {
  return post<T>({
    url: '/panel/itemIconGroup/saveDesktopLayout',
    data,
  })
}
