<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { NBackTop, NButton, NButtonGroup, NCheckbox, NDropdown, NModal, NSkeleton, NSpin, useDialog, useMessage } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AppIcon, AppStarter, EditItem } from './components'
import { Clock, DesktopWidgets, SearchBox, SystemMonitor } from '@/components/deskModule'
import { ItemIcon, SvgIcon } from '@/components/common'
import { deletes, getListByGroupId, saveSort } from '@/api/panel/itemIcon'
import { getList as getGroupList } from '@/api/panel/itemIconGroup'
import { acceptLoadedIcons, filterIconGroups, moveMatchIndex } from '@/utils/search/filterIcons'

import { setTitle, updateLocalUserInfo } from '@/utils/cmn'
import { useAuthStore, usePanelState, useStudioStore } from '@/store'
import { PanelPanelConfigStyleEnum, PanelStateNetworkModeEnum } from '@/enums'
import { VisitMode } from '@/enums/auth'
import { router } from '@/router'
import { t } from '@/locales'
import { contentMaxWidth } from '@/utils/panel/maxWidth'
import { resolveGroupIconStyle } from '@/utils/panel/groupIconStyle'
import { APPEARANCE_PRESETS, APPEARANCE_PRESET_IDS, DEFAULT_APPEARANCE_SCOPES, hasSelectedScope, resolveHomepageThemeVars } from '@/utils/panel/appearance'
import type { AppearancePresetId, AppearancePresetScopes } from '@/utils/panel/appearance'
import { contextMenuEntries, contextNewTabFeatures, resolveContextMenuChoice } from '@/utils/panel/contextMenu'
import type { ContextMenuEntry } from '@/utils/panel/contextMenu'
import { beginHomeListLoad, createHomeListState, disposeHomeList, homeListFeedback, homeListIdentity, homeListRequestCurrent, noteHomeListIdentity } from '@/utils/panel/homeListLoad'
import type { HomeListState } from '@/utils/panel/homeListLoad'
import { attachHomeRequest, createHomeViewCache, receiveHomeViewAuth, receiveHomeViewList, resetHomeViewAuth } from '@/utils/panel/homeCache'
import type { HomeCacheStep, HomeViewCache } from '@/utils/panel/homeCache'
import { browserHomeStorage, dropHomeSnapshot, readHomeSnapshot, readHomeSnapshotEpoch, writeHomeSnapshot } from '@/utils/panel/homeSnapshot'
import type { HomeSnapshotIdentity } from '@/utils/panel/homeSnapshot'
import { requestFailureDetails } from '@/utils/request/failure'
import { buildSafeModeExitUrl } from '@/utils/studio/customCode'
import brandLogoSvg from '@/assets/logo.svg'

interface ItemCard extends Panel.ItemInfo {
  userId?: number
}

interface ItemGroup extends Panel.ItemIconGroup {
  sortStatus?: boolean
  hoverStatus: boolean
  userId?: number
  items?: ItemCard[]
}

const ms = useMessage()
const dialog = useDialog()
const panelState = usePanelState()
const authStore = useAuthStore()
const studioStore = useStudioStore()

const scrollContainerRef = ref<HTMLElement | undefined>(undefined)

const editItemInfoShow = ref<boolean>(false)
const editItemInfoData = ref<Panel.ItemInfo | null>(null)
const windowShow = ref<boolean>(false)
const windowSrc = ref<string>('')
const windowTitle = ref<string>('')

const windowIframeRef = ref(null)
const windowIframeIsLoad = ref<boolean>(false)

const dropdownMenuX = ref(0)
const dropdownMenuY = ref(0)
const dropdownShow = ref(false)
const currentRightSelectItem = ref<Panel.ItemInfo | null>(null)
const currentAddItenIconGroupId = ref<number | undefined>()

const settingModalShow = ref(false)
const settingInitialApp = ref<string | undefined>(undefined)

const items = ref<ItemGroup[]>([])
let listState: HomeListState<ItemGroup> = createHomeListState(homeListIdentity(authStore.token))
let view: HomeViewCache<ItemGroup> = createHomeViewCache(listState)
const homeLoading = ref(false)
const homeRetryVisible = ref(false)
const homeShowNoData = ref(false)
const homeShowSearchEmpty = ref(false)

const activePanelConfig = computed(() => panelState.activePanelConfig)
const homepageTheme = computed(() => resolveHomepageThemeVars(activePanelConfig.value))
const previewPresetList = computed(() => APPEARANCE_PRESET_IDS.map(id => APPEARANCE_PRESETS[id]))
const activePreviewPreset = computed(() => (panelState.previewPresetId ? APPEARANCE_PRESETS[panelState.previewPresetId] : null))
const activePreviewScopes = computed<AppearancePresetScopes>(() => panelState.previewScopes ?? DEFAULT_APPEARANCE_SCOPES)
const appStarterVisible = computed({
  get: () => settingModalShow.value && !panelState.isPreviewingAppearance,
  set: (visible: boolean) => {
    settingModalShow.value = visible
    if (!visible)
      settingInitialApp.value = undefined
  },
})

const dockItems = computed<Array<{ groupIndex: number; item: ItemCard }>>(() => {
  if (activePanelConfig.value.layoutMode !== 'dock')
    return []
  const list: Array<{ groupIndex: number; item: ItemCard }> = []
  for (let gIdx = 0; gIdx < items.value.length; gIdx++) {
    for (const card of items.value[gIdx].items || []) {
      list.push({ groupIndex: gIdx, item: card })
      if (list.length >= 8)
        return list
    }
  }
  return list
})

function openStudioInSettings() {
  settingInitialApp.value = 'LeonStudio'
  settingModalShow.value = true
}

function exitSafeMode() {
  window.location.href = buildSafeModeExitUrl(window.location)
}

function groupIconStyle(group: ItemGroup) {
  if (panelState.isPreviewingAppearance)
    return resolveGroupIconStyle(group.iconStyle, activePanelConfig.value.iconStyle)
  return resolveGroupIconStyle(group.iconStyle, panelState.panelConfig.iconStyle)
}

function previewScopeSummary(scopes: AppearancePresetScopes): string {
  const labels: string[] = []
  if (scopes.wallpaper)
    labels.push(t('apps.baseSettings.presets.scopeWallpaper'))
  if (scopes.cardStyle)
    labels.push(t('apps.baseSettings.presets.scopeCardStyle'))
  if (scopes.iconStyle)
    labels.push(t('apps.baseSettings.presets.scopeIconStyle'))
  return labels.join('、')
}

function handlePreviewSwitch(presetId: AppearancePresetId) {
  panelState.startAppearancePreview(presetId, { ...activePreviewScopes.value })
}

function handlePreviewScopeChange(scopeKey: keyof AppearancePresetScopes, checked: boolean) {
  panelState.updateAppearancePreviewScopes({ [scopeKey]: checked })
}

function handlePreviewCancel() {
  panelState.cancelAppearancePreview()
  settingModalShow.value = false
}

function handlePreviewBackToSettings() {
  panelState.cancelAppearancePreview()
  settingModalShow.value = true
}

function handlePreviewApply() {
  const presetId = panelState.previewPresetId
  if (!presetId || !panelState.isCloudConfigReady)
    return
  const scopes = { ...activePreviewScopes.value }
  if (!hasSelectedScope(scopes)) {
    ms.warning(t('apps.baseSettings.presets.selectAtLeastOne'))
    return
  }
  const preset = APPEARANCE_PRESETS[presetId]
  if (!panelState.applyAppearancePreset(presetId, scopes))
    return
  settingModalShow.value = false
  panelState.savePanelConfigToCloud().then((result) => {
    if (result.stale || result.blocked)
      return
    if (result.ok) {
      ms.success(t('apps.baseSettings.presets.applied', {
        name: t(preset.nameKey),
        scopes: previewScopeSummary(scopes),
      }))
    }
    else if (result.msg) {
      ms.error(t('apps.baseSettings.configFailed', { message: result.msg }))
    }
    else {
      ms.error(t('common.networkError'))
    }
  })
}

function handlePreviewKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && panelState.isPreviewingAppearance) {
    event.preventDefault()
    handlePreviewCancel()
  }
}

const filterItems = ref<ItemGroup[]>([])
const searchKeyword = ref('')
const searchMatches = ref<Panel.ItemInfo[]>([])
const searchActive = ref(false)
const activeMatchIndex = ref(-1)

function openPage(openMethod: number, url: string, title?: string) {
  switch (openMethod) {
    case 1:
      window.location.href = url
      break
    case 2:
      window.open(url)
      break
    case 3:
      windowShow.value = true
      windowSrc.value = url
      windowTitle.value = title || url
      windowIframeIsLoad.value = true
      break

    default:
      break
  }
}

function openChosenAddress(method: 1 | 2 | 3, href: string, title?: string) {
  if (method === 1) {
    window.location.href = href
    return
  }
  if (method === 2) {
    const opened = window.open(href, '_blank', contextNewTabFeatures)
    if (opened)
      opened.opener = null
    return
  }
  windowShow.value = true
  windowSrc.value = href
  windowTitle.value = title || href
  windowIframeIsLoad.value = true
}

function handleItemClick(itemGroupIndex: number, item: Panel.ItemInfo) {
  if (items.value[itemGroupIndex] && items.value[itemGroupIndex].sortStatus) {
    handleEditItem(item)
    return
  }

  let jumpUrl = ''

  if (item)
    jumpUrl = (panelState.networkMode === PanelStateNetworkModeEnum.lan ? item.lanUrl : item.url) as string
  if (item.lanUrl === '')
    jumpUrl = item.url

  openPage(item.openMethod, jumpUrl, item.title)
}

function handWindowIframeIdLoad(payload: Event) {
  windowIframeIsLoad.value = false
}

function publishHomeList() {
  const feedback = homeListFeedback({
    loading: listState.loading,
    failure: listState.failure,
    loaded: listState.loaded,
    itemCount: items.value.length,
    searchActive: searchActive.value,
    matchCount: searchMatches.value.length,
  })
  homeLoading.value = feedback.busy
  homeRetryVisible.value = feedback.showRetry
  homeShowNoData.value = feedback.showNoData
  homeShowSearchEmpty.value = feedback.showSearchEmpty
}

function commitHomeList(next: HomeListState<ItemGroup>) {
  if (next === listState)
    return
  const presented = next.items.map(group => ({
    ...group,
    hoverStatus: group.hoverStatus ?? false,
  }))
  const stored = { ...next, items: presented }
  items.value = presented
  listState = stored
  view = { ...view, list: stored }
  applySearchFilter()
}

function homeEpoch(): number | null {
  try {
    return readHomeSnapshotEpoch(browserHomeStorage())
  }
  catch {
    return null
  }
}

function readCachedGroups(identity: HomeSnapshotIdentity): ItemGroup[] | null {
  try {
    const groups = readHomeSnapshot(browserHomeStorage(), identity, Date.now())
    if (!groups)
      return null
    return groups.map(group => ({ ...group, hoverStatus: false }))
  }
  catch {
    return null
  }
}

function persistHomeCache(result: HomeCacheStep<ItemGroup>) {
  if (!result.write && !result.clear)
    return
  try {
    const storage = browserHomeStorage()
    if (result.clear)
      dropHomeSnapshot(storage, result.clear.identity, result.clear.epoch)
    if (result.write)
      writeHomeSnapshot(storage, result.write.identity, result.write.groups, result.write.epoch, Date.now())
  }
  catch {
    // 浏览器存储不可用时只保留这次页面里的结果。
  }
}

function applyHomeCache(result: HomeCacheStep<ItemGroup>) {
  view = result.state
  commitHomeList(result.state.list)
  persistHomeCache(result)
}

function issuedSnapshotHint(): HomeSnapshotIdentity | null {
  // 只在鉴权失败时提示要删哪一份快照。展示仍然只看这次 authInfo。
  const accountId = authStore.userInfo?.id
  if (typeof accountId !== 'number' || !Number.isInteger(accountId) || accountId <= 0)
    return null
  if (authStore.visitMode === VisitMode.VISIT_MODE_PUBLIC)
    return { kind: 'public', accountId }
  if (authStore.visitMode === VisitMode.VISIT_MODE_LOGIN)
    return { kind: 'login', accountId }
  return null
}

function dropIssuedSnapshot(target: { identity: HomeSnapshotIdentity; epoch: number } | null) {
  if (!target)
    return
  try {
    dropHomeSnapshot(browserHomeStorage(), target.identity, target.epoch)
  }
  catch {
    // 存储不可用时无法删除，页面也不展示这份快照。
  }
}

function confirmHomeAuth() {
  // 空令牌是公开访客，无效令牌会由服务端回退成访客。两种都要等这次 authInfo，不能跳过。
  if (listState.disposed)
    return
  const generation = view.authGeneration + 1
  const issuedHint = issuedSnapshotHint()
  const epochAtStart = homeEpoch()
  view = {
    ...view,
    auth: 'pending',
    identity: null,
    held: null,
    authGeneration: generation,
  }
  const tokenIdentity = homeListIdentity(authStore.token)
  let clearTarget: { identity: HomeSnapshotIdentity; epoch: number } | null = null
  updateLocalUserInfo(() => {
    const current = !listState.disposed && view.authGeneration === generation && homeListIdentity(authStore.token) === tokenIdentity
    clearTarget = current && issuedHint && epochAtStart !== null
      ? { identity: issuedHint, epoch: epochAtStart }
      : null
    return current
  }).then((res) => {
    applyHomeCache(receiveHomeViewAuth(view, {
      generation,
      tokenIdentity,
      response: res,
      clearHint: issuedHint,
      readCache: readCachedGroups,
      epochNow: homeEpoch(),
    }))
    if (res.code === 1000 || res.code === 1001)
      dropIssuedSnapshot(clearTarget)
  }).catch((error: unknown) => {
    applyHomeCache(receiveHomeViewAuth(view, {
      generation,
      tokenIdentity,
      failure: requestFailureDetails(error),
      clearHint: issuedHint,
      readCache: () => null,
      epochNow: homeEpoch(),
    }))
  })
}

function getList() {
  requestHomeList('refresh')
}

function retryHomeList() {
  if (view.auth === 'rejected' || view.auth === 'unavailable')
    confirmHomeAuth()
  requestHomeList('retry')
}

function requestHomeList(mode: 'refresh' | 'retry') {
  if (listState.disposed)
    return
  const identity = homeListIdentity(authStore.token)
  const begun = beginHomeListLoad(listState, identity, mode)
  if (begun.requestId === null && begun.state === listState)
    return
  view = attachHomeRequest(view, begun.state, begun.requestId, begun.requestId === null ? view.epoch : homeEpoch())
  commitHomeList(view.list)
  if (begun.requestId === null)
    return
  const requestId = begun.requestId
  const issuedHint = issuedSnapshotHint()
  const epochAtStart = homeEpoch()
  // 1000/1001 会先清掉令牌，身份监听随即让这次请求变成旧请求。
  // 删除目标要在清令牌之前记下：已确认的身份优先，否则只用发出请求时的账号。
  let clearTarget: { identity: HomeSnapshotIdentity; epoch: number } | null = null
  getGroupList<Common.ListResponse<ItemGroup[]>>(true, () => {
    const current = homeListRequestCurrent(listState, requestId, identity) && homeListIdentity(authStore.token) === identity
    const snapshotIdentity = view.auth === 'confirmed' && view.identity ? view.identity : issuedHint
    clearTarget = current && snapshotIdentity && epochAtStart !== null
      ? { identity: snapshotIdentity, epoch: epochAtStart }
      : null
    return current
  }).then((res) => {
    applyHomeCache(receiveHomeViewList(view, {
      requestId,
      tokenIdentity: identity,
      response: res,
      clearHint: issuedHint,
      epochNow: homeEpoch(),
      readCache: readCachedGroups,
    }))
    if (res.code === 1000 || res.code === 1001)
      dropIssuedSnapshot(clearTarget)
  }).catch((error: unknown) => {
    applyHomeCache(receiveHomeViewList(view, {
      requestId,
      tokenIdentity: identity,
      failure: requestFailureDetails(error),
      clearHint: issuedHint,
      epochNow: homeEpoch(),
    }))
  })
}

function updateItemIconGroupByNet(itemIconGroupId: number, requestId = listState.generation) {
  getListByGroupId<Common.ListResponse<Panel.ItemInfo[]>>(itemIconGroupId).then((res) => {
    if (res.code !== 0)
      return
    const applied = acceptLoadedIcons({
      groups: items.value,
      requestId,
      currentRequestId: listState.generation,
      groupId: itemIconGroupId,
      icons: res.data.list || [],
    })
    if (!applied)
      return
    applySearchFilter()
  }).catch(() => undefined)
}

function handleRightMenuSelect(key: string | number) {
  dropdownShow.value = false
  const item = currentRightSelectItem.value
  if (!item)
    return
  if (key === 'edit') {
    if (authStore.visitMode !== VisitMode.VISIT_MODE_LOGIN)
      return
    // 这里有个奇怪的问题，如果不使用{...}的方式 父组件的值会同步修改 标记一下
    handleEditItem({ ...item } as Panel.ItemInfo)
    return
  }
  if (key === 'delete') {
    if (authStore.visitMode !== VisitMode.VISIT_MODE_LOGIN)
      return
    dialog.warning({
      title: t('common.warning'),
      content: t('common.deleteConfirmByName', { name: item.title }),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: () => {
        deletes([item.id as number]).then(({ code, msg }) => {
          if (code === 0) {
            ms.success(t('common.deleteSuccess'))
            getList()
          }
          else {
            ms.error(`${t('common.deleteFail')}:${msg}`)
          }
        })
      },
    })
    return
  }
  const choice = resolveContextMenuChoice(item, String(key))
  if (!choice || choice === 'edit' || choice === 'delete')
    return
  openChosenAddress(choice.method, choice.href, item.title)
}

function handleContextMenu(e: MouseEvent, itemGroupIndex: number, item: Panel.ItemInfo) {
  if (items.value[itemGroupIndex] && items.value[itemGroupIndex].sortStatus)
    return

  e.preventDefault()
  currentRightSelectItem.value = item
  dropdownShow.value = false
  nextTick().then(() => {
    dropdownShow.value = true
    dropdownMenuX.value = e.clientX
    dropdownMenuY.value = e.clientY
  })
}

function onClickoutside() {
  // message.info('clickoutside')
  dropdownShow.value = false
}

function handleEditSuccess(item: Panel.ItemInfo) {
  getList()
}

function handleChangeNetwork(mode: PanelStateNetworkModeEnum) {
  panelState.setNetworkMode(mode)
  if (mode === PanelStateNetworkModeEnum.lan)
    ms.success(t('panelHome.changeToLanModelSuccess'))

  else
    ms.success(t('panelHome.changeToWanModelSuccess'))
}

// 结束拖拽
// function handleEndDrag(event: any, itemIconGroup: Panel.ItemIconGroup) {
//   // console.log(event)
//   // console.log(items.value)
// }

function handleSaveSort(itemGroup: ItemGroup) {
  const saveItems: Common.SortItemRequest[] = []
  if (itemGroup.items) {
    for (let i = 0; i < itemGroup.items.length; i++) {
      const element = itemGroup.items[i]
      saveItems.push({
        id: element.id as number,
        sort: i + 1,
      })
    }

    saveSort({ itemIconGroupId: itemGroup.id as number, sortItems: saveItems }).then(({ code, msg }) => {
      if (code === 0) {
        ms.success(t('common.saveSuccess'))
        itemGroup.sortStatus = false
      }
      else {
        ms.error(`${t('common.saveFail')}:${msg}`)
      }
    })
  }
}

function toDropdownOptions(entries: ContextMenuEntry[]) {
  return entries.map((entry) => {
    const option: { key: string; label: string; children?: ReturnType<typeof toDropdownOptions> } = {
      key: entry.key,
      label: t(entry.labelKey),
    }
    if (entry.children)
      option.children = toDropdownOptions(entry.children)
    return option
  })
}

function getDropdownMenuOptions() {
  return toDropdownOptions(contextMenuEntries({
    url: currentRightSelectItem.value?.url,
    lanUrl: currentRightSelectItem.value?.lanUrl,
  }, authStore.visitMode === VisitMode.VISIT_MODE_LOGIN))
}

watch(settingModalShow, (visible) => {
  if (visible || items.value.some(group => group.sortStatus))
    return
  getList()
})

watch(() => homeListIdentity(authStore.token), (identity, previous) => {
  if (identity === previous || listState.disposed)
    return
  panelState.cancelAppearancePreview()
  panelState.resetPanelConfig()
  studioStore.resetRuntimeState()
  const noted = noteHomeListIdentity(listState, identity)
  if (!noted.changed)
    return
  view = resetHomeViewAuth(view, noted.state)
  commitHomeList(view.list)
  // 令牌从有到无是退出或当前 1001 清掉会话。只清视图，不再发空令牌 authInfo。
  // 正常的空令牌访客仍由 onMounted 确认；换成另一个非空令牌才在这里确认。
  if (!identity && previous)
    return
  confirmHomeAuth()
  panelState.updatePanelConfigByCloud()
  studioStore.loadFromCloud()
  if (identity)
    getList()
})

onMounted(() => {
  window.addEventListener('keydown', handlePreviewKeydown)
  confirmHomeAuth()
  getList()

  // 更新同步云端配置与 Leon Studio 扩展
  panelState.updatePanelConfigByCloud()
  studioStore.loadFromCloud()

  // 设置标题
  if (panelState.panelConfig.logoText)
    setTitle(panelState.panelConfig.logoText)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handlePreviewKeydown)
  panelState.cancelAppearancePreview()
  listState = disposeHomeList(listState)
  view = { ...view, list: listState, held: null }
})

const activeSearchItem = computed(() => searchMatches.value[activeMatchIndex.value])

function applySearchFilter() {
  const result = filterIconGroups(items.value, searchKeyword.value, !!activePanelConfig.value.searchBoxSearchIcon)
  searchActive.value = result.active
  searchMatches.value = result.matches as Panel.ItemInfo[]
  filterItems.value = result.active ? result.groups as ItemGroup[] : items.value
  activeMatchIndex.value = searchMatches.value.length > 0 ? Math.min(Math.max(activeMatchIndex.value, 0), searchMatches.value.length - 1) : -1
  publishHomeList()
}

// 前端搜索过滤
function itemFrontEndSearch(keyword?: string) {
  searchKeyword.value = keyword ?? ''
  activeMatchIndex.value = 0
  applySearchFilter()
}

function handleMoveMatch(delta: number) {
  activeMatchIndex.value = moveMatchIndex(activeMatchIndex.value, delta, searchMatches.value.length)
}

function openActiveMatch() {
  const item = activeSearchItem.value
  if (!item)
    return
  const groupIndex = items.value.findIndex(group => group.items?.includes(item))
  handleItemClick(groupIndex < 0 ? 0 : groupIndex, item)
}

function handleSetHoverStatus(groupIndex: number, hoverStatus: boolean) {
  if (items.value[groupIndex])
    items.value[groupIndex].hoverStatus = hoverStatus
}

function handleSetSortStatus(groupIndex: number, sortStatus: boolean) {
  if (items.value[groupIndex])
    items.value[groupIndex].sortStatus = sortStatus

  // 并未保存排序重新更新数据
  if (!sortStatus) {
    // 单独更新组
    if (items.value[groupIndex] && items.value[groupIndex].id)
      updateItemIconGroupByNet(items.value[groupIndex].id as number)
  }
}

function handleEditItem(item: Panel.ItemInfo) {
  editItemInfoData.value = item
  editItemInfoShow.value = true
  currentAddItenIconGroupId.value = undefined
}

function handleAddItem(itemIconGroupId?: number) {
  editItemInfoData.value = null
  editItemInfoShow.value = true
  if (itemIconGroupId)
    currentAddItenIconGroupId.value = itemIconGroupId
}
</script>

<template>
  <div
    class="w-full h-full sun-main"
    :class="[
      homepageTheme.isLightCanvas ? 'leon-tone-light' : 'leon-tone-dark',
      `leon-card-surface-${homepageTheme.cardSurface}`,
      `leon-layout-${activePanelConfig.layoutMode || 'standard'}`,
      {
        'leon-flat-geometric': homepageTheme.card.isFlatGeometric,
        'leon-fx-grid-overlay': studioStore.config.effects.gridOverlay,
        'leon-fx-no-hard-shadow': !studioStore.config.effects.hardShadowHover,
        'leon-fx-reduce-motion': studioStore.config.effects.reduceMotion,
        'leon-preview-active': panelState.isPreviewingAppearance,
      },
    ]"
    :style="homepageTheme.cssVars"
    :data-card-surface="homepageTheme.cardSurface"
    :data-wallpaper-tone="homepageTheme.isLightCanvas ? 'light' : 'dark'"
    :data-layout-mode="activePanelConfig.layoutMode || 'standard'"
    :data-preview-preset="panelState.previewPresetId || ''"
  >
    <!-- /?safe=1 防锁死安全模式提示条 -->
    <div v-if="studioStore.safeMode" class="leon-safe-banner" role="status" data-testid="home-safe-mode-banner">
      <span>{{ $t('apps.leonStudio.safeModeBanner') }}</span>
      <div class="flex items-center gap-2">
        <button
          v-if="authStore.visitMode === VisitMode.VISIT_MODE_LOGIN"
          type="button"
          class="leon-safe-btn"
          @click="openStudioInSettings"
        >
          {{ $t('apps.leonStudio.openStudio') }}
        </button>
        <button type="button" class="leon-safe-btn is-primary" @click="exitSafeMode">
          {{ $t('apps.leonStudio.exitSafeMode') }}
        </button>
      </div>
    </div>

    <div
      v-if="homeLoading"
      class="leon-home-loading"
      role="progressbar"
      aria-busy="true"
      aria-valuemin="0"
      aria-valuemax="100"
      data-testid="home-loading-bar"
      :aria-label="$t('panelHome.loading')"
    />
    <div
      class="cover wallpaper" :style="{
        filter: `blur(${activePanelConfig.backgroundBlur}px)`,
        background: `url(${activePanelConfig.backgroundImageSrc}) no-repeat`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }"
    />
    <div class="mask" :style="{ backgroundColor: `rgba(0,0,0,${activePanelConfig.backgroundMaskNumber})` }" />
    <div ref="scrollContainerRef" class="absolute w-full h-full overflow-auto">
      <div
        class="p-2.5 mx-auto"
        :class="{
          'pb-[140px]': panelState.isPreviewingAppearance || activePanelConfig.layoutMode === 'dock',
        }"
        :style="{
          marginTop: `${activePanelConfig.marginTop}%`,
          marginBottom: `${activePanelConfig.marginBottom}%`,
          maxWidth: contentMaxWidth(activePanelConfig.maxWidth, activePanelConfig.maxWidthUnit),
        }"
      >
        <!-- 头 -->
        <div class="mx-[auto] w-[80%] leon-home-header">
          <div class="flex mx-[auto] items-center justify-center gap-3 leon-chrome-text">
            <div class="logo flex items-center gap-3">
              <img
                v-if="homepageTheme.card.isFlatGeometric"
                :src="brandLogoSvg"
                alt="Leon Panel"
                class="leon-header-emblem"
              >
              <span class="text-2xl md:text-5xl font-extrabold tracking-tight text-shadow">
                {{ activePanelConfig.logoText }}
              </span>
            </div>
            <div class="divider leon-header-divider text-base lg:text-2xl mx-[6px]" aria-hidden="true">
              |
            </div>
            <div class="text-shadow">
              <Clock :hide-second="!activePanelConfig.clockShowSecond" />
            </div>
          </div>
          <div
            v-if="studioStore.config.effects.enhancedClock && studioStore.config.effects.clockGreeting"
            class="leon-header-greeting"
          >
            {{ studioStore.config.effects.clockGreeting }}
          </div>
          <div v-if="activePanelConfig.searchBoxShow" class="flex flex-col mt-[20px] mx-auto sm:w-full lg:w-[80%]">
            <SearchBox
              :background="homepageTheme.searchBackground"
              :text-color="homepageTheme.searchTextColor"
              :local-search-enabled="!!activePanelConfig.searchBoxSearchIcon"
              :match-count="searchMatches.length"
              @item-search="itemFrontEndSearch"
              @move-match="handleMoveMatch"
              @open-local="openActiveMatch"
            />
            <p v-if="homeShowSearchEmpty" class="leon-search-empty" role="status" data-testid="home-search-empty">
              {{ $t('deskModule.searchBox.empty') }}
            </p>
          </div>
        </div>

        <!-- 应用盒子 -->
        <div :style="{ marginLeft: `${activePanelConfig.marginX}px`, marginRight: `${activePanelConfig.marginX}px` }">
          <!-- Leon Studio 桌面小组件 -->
          <DesktopWidgets />

          <!-- 系统监控状态 -->
          <div
            v-if="activePanelConfig.systemMonitorShow
              && ((activePanelConfig.systemMonitorPublicVisitModeShow && authStore.visitMode === VisitMode.VISIT_MODE_PUBLIC)
                || authStore.visitMode === VisitMode.VISIT_MODE_LOGIN)"
            class="flex mx-auto"
          >
            <SystemMonitor
              :allow-edit="authStore.visitMode === VisitMode.VISIT_MODE_LOGIN"
              :show-title="activePanelConfig.systemMonitorShowTitle"
            />
          </div>

          <div
            class="leon-card-region"
            data-testid="home-card-region"
            :aria-busy="homeLoading ? 'true' : 'false'"
          >
            <div v-if="homeRetryVisible" class="leon-home-retry" role="alert" data-testid="home-list-error">
              <p class="leon-home-retry-text">
                {{ $t('panelHome.loadFailed') }}
              </p>
              <button type="button" class="leon-home-retry-button" data-testid="home-list-retry" @click="retryHomeList">
                {{ $t('panelHome.retry') }}
              </button>
            </div>
            <p v-if="homeShowNoData" class="leon-home-empty" role="status" data-testid="home-no-data">
              {{ $t('common.noData') }}
            </p>

            <!-- 组纵向排列 -->
            <div
              v-for="(itemGroup, itemGroupIndex) in filterItems" :key="itemGroupIndex"
              class="item-list leon-section"
              :class="itemGroup.sortStatus ? 'shadow-2xl border shadow-[0_0_30px_10px_rgba(0,0,0,0.3)]  p-[10px] rounded-2xl' : ''"
              @mouseenter="handleSetHoverStatus(itemGroupIndex, true)"
              @mouseleave="handleSetHoverStatus(itemGroupIndex, false)"
            >
              <!-- 分组标题 -->
              <div class="leon-chrome-text text-xl font-extrabold mb-[20px] ml-[4px] flex items-center gap-2">
                <span v-if="homepageTheme.card.isFlatGeometric" class="leon-group-index" aria-hidden="true">
                  {{ String(itemGroupIndex + 1).padStart(2, '0') }}
                </span>
                <span class="group-title text-shadow">
                  {{ itemGroup.title }}
                </span>
                <div
                  v-if="authStore.visitMode === VisitMode.VISIT_MODE_LOGIN"
                  class="group-buttons leon-hover-actions ml-2 flex"
                  :class="itemGroup.hoverStatus ? 'is-open' : ''"
                >
                  <span class="mr-2 cursor-pointer" :title="t('common.add')" @click="handleAddItem(itemGroup.id)">
                    <SvgIcon class="leon-chrome-text font-xl" icon="typcn:plus" />
                  </span>
                  <span class="mr-2 cursor-pointer " :title="t('common.sort')" @click="handleSetSortStatus(itemGroupIndex, !itemGroup.sortStatus)">
                    <SvgIcon class="leon-chrome-text font-xl" icon="ri:drag-drop-line" />
                  </span>
                </div>
              </div>

              <!-- 详情图标 -->
              <div v-if="groupIconStyle(itemGroup) === PanelPanelConfigStyleEnum.info">
                <div v-if="itemGroup.items">
                  <VueDraggable
                    v-model="itemGroup.items" item-key="sort" :animation="300"
                    class="icon-info-box"
                    filter=".not-drag"
                    :disabled="!itemGroup.sortStatus"
                  >
                    <div
                      v-for="item, index in itemGroup.items"
                      :key="index"
                      class="leon-card-item"
                      role="link"
                      tabindex="0"
                      :aria-label="item.title"
                      :title="item.description"
                      :class="item === activeSearchItem ? 'leon-search-hit' : ''"
                      @contextmenu="(e) => handleContextMenu(e, itemGroupIndex, item)"
                      @keydown.enter.prevent="handleItemClick(itemGroupIndex, item)"
                    >
                      <AppIcon
                        :class="itemGroup.sortStatus ? 'cursor-move' : 'cursor-pointer'"
                        :item-info="item"
                        :icon-text-color="activePanelConfig.iconTextColor"
                        :icon-text-info-hide-description="activePanelConfig.iconTextInfoHideDescription || false"
                        :icon-text-icon-hide-title="activePanelConfig.iconTextIconHideTitle || false"
                        :style="0"
                        @click="handleItemClick(itemGroupIndex, item)"
                      />
                    </div>

                    <div v-if="itemGroup.items.length === 0" class="not-drag">
                      <AppIcon
                        :class="itemGroup.sortStatus ? 'cursor-move' : 'cursor-pointer'"
                        :item-info="{ icon: { itemType: 3, text: 'subway:add' }, title: t('common.add'), url: '', openMethod: 0 }"
                        :icon-text-color="activePanelConfig.iconTextColor"
                        :icon-text-info-hide-description="activePanelConfig.iconTextInfoHideDescription || false"
                        :icon-text-icon-hide-title="activePanelConfig.iconTextIconHideTitle || false"
                        :style="0"
                        @click="handleAddItem(itemGroup.id)"
                      />
                    </div>
                  </VueDraggable>
                </div>
              </div>

              <!-- APP图标宫型盒子 -->
              <div v-if="groupIconStyle(itemGroup) === PanelPanelConfigStyleEnum.icon">
                <div v-if="itemGroup.items">
                  <VueDraggable
                    v-model="itemGroup.items" item-key="sort" :animation="300"
                    class="icon-small-box"

                    filter=".not-drag"
                    :disabled="!itemGroup.sortStatus"
                  >
                    <div
                      v-for="item, index in itemGroup.items"
                      :key="index"
                      class="leon-card-item"
                      role="link"
                      tabindex="0"
                      :aria-label="item.title"
                      :title="item.description"
                      :class="item === activeSearchItem ? 'leon-search-hit' : ''"
                      @contextmenu="(e) => handleContextMenu(e, itemGroupIndex, item)"
                      @keydown.enter.prevent="handleItemClick(itemGroupIndex, item)"
                    >
                      <AppIcon
                        :class="itemGroup.sortStatus ? 'cursor-move' : 'cursor-pointer'"
                        :item-info="item"
                        :icon-text-color="activePanelConfig.iconTextColor"
                        :icon-text-info-hide-description="!activePanelConfig.iconTextInfoHideDescription"
                        :icon-text-icon-hide-title="activePanelConfig.iconTextIconHideTitle || false"
                        :style="1"
                        @click="handleItemClick(itemGroupIndex, item)"
                      />
                    </div>

                    <div v-if="itemGroup.items.length === 0" class="not-drag">
                      <AppIcon
                        class="cursor-pointer"
                        :item-info="{ icon: { itemType: 3, text: 'subway:add' }, title: $t('common.add'), url: '', openMethod: 0 }"
                        :icon-text-color="activePanelConfig.iconTextColor"
                        :icon-text-info-hide-description="!activePanelConfig.iconTextInfoHideDescription"
                        :icon-text-icon-hide-title="activePanelConfig.iconTextIconHideTitle || false"
                        :style="1"
                        @click="handleAddItem(itemGroup.id)"
                      />
                    </div>
                  </vuedraggable>
                </div>
              </div>

              <!-- 编辑栏 -->
              <div v-if="itemGroup.sortStatus" class="flex mt-[10px]">
                <div>
                  <NButton :color="homepageTheme.controlBackground" :text-color="homepageTheme.controlTextColor" class="leon-control-btn" @click="handleSaveSort(itemGroup)">
                    <template #icon>
                      <SvgIcon class="font-xl" icon="material-symbols:save" />
                    </template>
                    <div>
                      {{ $t('common.saveSort') }}
                    </div>
                  </NButton>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-5 footer" v-html="activePanelConfig.footerHtml" />
      </div>
    </div>

    <!-- 右键菜单 -->
    <NDropdown
      placement="bottom-start" trigger="manual" :x="dropdownMenuX" :y="dropdownMenuY"
      :options="getDropdownMenuOptions()" :show="dropdownShow" :on-clickoutside="onClickoutside" @select="handleRightMenuSelect"
    />

    <!-- 实时外观预设预览栏 -->
    <div
      v-if="panelState.isPreviewingAppearance && activePreviewPreset"
      class="leon-preview-bar"
      role="region"
      :aria-label="$t('apps.baseSettings.presets.previewBanner', { name: $t(activePreviewPreset.nameKey) })"
      aria-live="polite"
      data-testid="appearance-preview-bar"
    >
      <div class="leon-preview-bar-header">
        <div class="leon-preview-bar-title">
          <strong>{{ $t('apps.baseSettings.presets.previewBanner', { name: $t(activePreviewPreset.nameKey) }) }}</strong>
          <span class="leon-preview-bar-tip">{{ $t('apps.baseSettings.presets.previewBannerTip') }}</span>
        </div>
        <div class="leon-preview-bar-presets">
          <button
            v-for="preset in previewPresetList"
            :key="preset.id"
            type="button"
            class="leon-preview-pill"
            :class="{ 'is-active': panelState.previewPresetId === preset.id }"
            :data-testid="`preview-switch-${preset.id}`"
            @click="handlePreviewSwitch(preset.id)"
          >
            {{ $t(preset.nameKey) }}
          </button>
        </div>
      </div>

      <div class="leon-preview-bar-controls">
        <div class="leon-preview-bar-scopes">
          <NCheckbox
            :checked="activePreviewScopes.wallpaper"
            data-testid="preview-scope-wallpaper"
            @update:checked="(val: boolean) => handlePreviewScopeChange('wallpaper', val)"
          >
            {{ $t('apps.baseSettings.presets.scopeWallpaper') }}
          </NCheckbox>
          <NCheckbox
            :checked="activePreviewScopes.cardStyle"
            data-testid="preview-scope-cardStyle"
            @update:checked="(val: boolean) => handlePreviewScopeChange('cardStyle', val)"
          >
            {{ $t('apps.baseSettings.presets.scopeCardStyle') }}
          </NCheckbox>
          <NCheckbox
            :checked="activePreviewScopes.iconStyle"
            data-testid="preview-scope-iconStyle"
            @update:checked="(val: boolean) => handlePreviewScopeChange('iconStyle', val)"
          >
            {{ $t('apps.baseSettings.presets.scopeIconStyle') }}
          </NCheckbox>
        </div>

        <div class="leon-preview-bar-actions">
          <button type="button" class="leon-preview-btn leon-preview-btn-ghost" data-testid="preview-back-settings" @click="handlePreviewBackToSettings">
            {{ $t('apps.baseSettings.presets.backToSettings') }}
          </button>
          <button type="button" class="leon-preview-btn leon-preview-btn-secondary" data-testid="preview-cancel" @click="handlePreviewCancel">
            {{ $t('apps.baseSettings.presets.exitPreview') }}
          </button>
          <button
            type="button"
            class="leon-preview-btn leon-preview-btn-primary"
            :disabled="!panelState.isCloudConfigReady"
            data-testid="preview-apply"
            @click="handlePreviewApply"
          >
            {{ $t('apps.baseSettings.presets.applySelected') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部悬浮 Dock 栏（Dock 布局模式） -->
    <nav
      v-if="activePanelConfig.layoutMode === 'dock' && dockItems.length > 0 && !panelState.isPreviewingAppearance"
      class="leon-dock-bar"
      aria-label="Quick Dock"
      data-testid="home-dock-bar"
    >
      <span class="leon-dock-label">DOCK</span>
      <button
        v-for="entry in dockItems"
        :key="entry.item.id || entry.item.title"
        type="button"
        class="leon-dock-item"
        :title="entry.item.title"
        @click="handleItemClick(entry.groupIndex, entry.item)"
      >
        <ItemIcon
          :item-icon="entry.item.icon"
          :fallback-text="entry.item.title"
          :size="36"
        />
      </button>
    </nav>

    <!-- 悬浮按钮 -->
    <div v-show="!panelState.isPreviewingAppearance" class="fixed-element leon-floating-dock">
      <NButtonGroup vertical>
        <!-- 网络模式切换按钮组 -->
        <NButton
          v-if="panelState.networkMode === PanelStateNetworkModeEnum.lan && activePanelConfig.netModeChangeButtonShow"
          :color="homepageTheme.controlBackground"
          :text-color="homepageTheme.controlTextColor"
          class="leon-control-btn"
          :title="t('panelHome.changeToWanModel')"
          @click="handleChangeNetwork(PanelStateNetworkModeEnum.wan)"
        >
          <template #icon>
            <SvgIcon class="font-xl" icon="material-symbols:lan-outline-rounded" />
          </template>
        </NButton>

        <NButton
          v-if="panelState.networkMode === PanelStateNetworkModeEnum.wan && activePanelConfig.netModeChangeButtonShow"
          :color="homepageTheme.controlBackground"
          :text-color="homepageTheme.controlTextColor"
          class="leon-control-btn"
          :title="t('panelHome.changeToLanModel')"
          @click="handleChangeNetwork(PanelStateNetworkModeEnum.lan)"
        >
          <template #icon>
            <SvgIcon class="font-xl" icon="mdi:wan" />
          </template>
        </NButton>

        <NButton
          v-if="authStore.visitMode === VisitMode.VISIT_MODE_LOGIN"
          :color="homepageTheme.controlBackground"
          :text-color="homepageTheme.controlTextColor"
          class="leon-control-btn"
          :title="$t('appLauncher.title')"
          data-testid="home-open-settings"
          @click="settingModalShow = !settingModalShow"
        >
          <template #icon>
            <SvgIcon class="font-xl" icon="majesticons-applications" />
          </template>
        </NButton>

        <NButton
          v-if="authStore.visitMode === VisitMode.VISIT_MODE_PUBLIC"
          :color="homepageTheme.controlBackground"
          :text-color="homepageTheme.controlTextColor"
          class="leon-control-btn"
          :title="$t('panelHome.goToLogin')"
          @click="router.push('/login')"
        >
          <template #icon>
            <SvgIcon class="font-xl" icon="material-symbols:account-circle" />
          </template>
        </NButton>
      </NButtonGroup>

      <AppStarter v-model:visible="appStarterVisible" :initial-app="settingInitialApp" />
      <!-- <Setting v-model:visible="settingModalShow" /> -->
    </div>

    <NBackTop
      v-if="!panelState.isPreviewingAppearance"
      :listen-to="() => scrollContainerRef"
      :right="10"
      :bottom="10"
      style="background-color:transparent;border: none;box-shadow: none;"
    >
      <div class="leon-floating-dock">
        <NButton :color="homepageTheme.controlBackground" :text-color="homepageTheme.controlTextColor" class="leon-control-btn">
          <template #icon>
            <SvgIcon class="font-xl" icon="icon-park-outline:to-top" />
          </template>
        </NButton>
      </div>
    </NBackTop>

    <EditItem v-model:visible="editItemInfoShow" :item-info="editItemInfoData" :item-group-id="currentAddItenIconGroupId" @done="handleEditSuccess" />

    <!-- 弹窗 -->
    <NModal
      v-model:show="windowShow" :mask-closable="false" preset="card"
      style="max-width: 1000px;height: 600px;border-radius: 1rem;" :bordered="true" size="small" role="dialog"
      aria-modal="true"
    >
      <template #header>
        <div class="flex items-center">
          <span class="mr-[20px]">
            {{ windowTitle }}
          </span>

          <NSpin v-if="windowIframeIsLoad" size="small" />
        </div>
      </template>
      <div class="w-full h-full rounded-2xl overflow-hidden border dark:border-zinc-700">
        <div v-if="windowIframeIsLoad" class="flex flex-col p-5">
          <NSkeleton height="50px" width="100%" class="rounded-lg" />
          <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
          <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
        </div>
        <iframe
          v-show="!windowIframeIsLoad" id="windowIframeId" ref="windowIframeRef" :src="windowSrc"
          class="w-full h-full" frameborder="0" @load="handWindowIframeIdLoad"
        />
      </div>
    </NModal>
  </div>
</template>

<style>
body,
html {
  overflow: hidden;
  background-color: rgb(54, 54, 54);
}
</style>

<style scoped>
.mask {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.sun-main {
  position: relative;
  overflow: hidden;
  user-select: none;
}

.cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* background: url(@/assets/start_sky.jpg) no-repeat; */

  transform: scale(1.05);
}

.text-shadow {
  text-shadow: 2px 2px 50px rgb(0, 0, 0);
}

.app-icon-text-shadow {
  text-shadow: 2px 2px 5px rgb(0, 0, 0);
}

.fixed-element {
  position: fixed;
  /* 将元素固定在屏幕上 */
  right: 10px;
  /* 距离屏幕顶部的距离 */
  bottom: 50px;
  /* 距离屏幕左侧的距离 */
}

.icon-info-box {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 18px;

}

.icon-small-box {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(75px, 1fr));
  gap: 18px;

}

@media (max-width: 500px) {
  .icon-info-box{
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
