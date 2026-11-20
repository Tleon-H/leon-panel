import { defineStore } from 'pinia'
import { defaultState, defaultStatePanelConfig, getLocalState, removeLocalState, setLocalState } from './helper'
import { router } from '@/router'
import type { PanelStateNetworkModeEnum } from '@/enums'
import { post } from '@/utils/request'
import { useAuthStore } from '@/store/modules/auth'
import { normalizeMaxWidth } from '@/utils/panel/maxWidth'
import {
  applyAppearancePreset as buildPresetPanelConfig,
  createPanelCloudController,
  normalizePanelAppearance,
} from '@/utils/panel/appearance'
import type { PanelSaveResult } from '@/utils/panel/appearance'

function currentAuthOwnerId(): number | null {
  const authStore = useAuthStore()
  if (!authStore.token)
    return null
  const id = authStore.userInfo?.id
  return (typeof id === 'number' && Number.isInteger(id) && id > 0) ? id : null
}

let activeStoreInstance: ReturnType<typeof usePanelState> | null = null

const cloudController = createPanelCloudController<Panel.panelConfig>({
  getState: () => {
    if (!activeStoreInstance)
      activeStoreInstance = usePanelState()
    return activeStoreInstance.$state
  },
  getToken: () => {
    const authStore = useAuthStore()
    return authStore.token || ''
  },
  getUserId: () => currentAuthOwnerId(),
  createDefaultConfig: () => defaultStatePanelConfig(),
  normalizeConfig: (raw, defaults) => {
    const panel = normalizePanelAppearance<Panel.panelConfig>({
      ...defaults,
      ...(raw ?? {}),
    })
    panel.maxWidth = normalizeMaxWidth(panel.maxWidth)
    return panel
  },
  fetchCloudConfig: sessionCurrent => post<Panel.userConfig>({
    url: '/panel/userConfig/get',
    sessionCurrent,
  }),
  pushCloudConfig: (panel, sessionCurrent) => post({
    url: '/panel/userConfig/set',
    data: { panel },
    sessionCurrent,
  }),
  onRecordState: () => {
    if (!activeStoreInstance)
      activeStoreInstance = usePanelState()
    activeStoreInstance.recordState()
  },
})

export const usePanelState = defineStore('panel', {
  state: (): Panel.State => getLocalState() || defaultState(),

  getters: {
    isPreviewingAppearance(state): boolean {
      return Boolean(state.previewPresetId)
    },

    isCloudConfigReady(state): boolean {
      const authStore = useAuthStore()
      return Boolean(authStore.token) && state.cloudConfigState === 'ready'
    },

    activePanelConfig(state): Panel.panelConfig {
      if (state.previewPresetId)
        return buildPresetPanelConfig(state.panelConfig, state.previewPresetId, state.previewScopes)
      return normalizePanelAppearance(state.panelConfig)
    },
  },

  actions: {
    setLeftSiderCollapsed(Collapsed: boolean) {
      this.leftSiderCollapsed = Collapsed
    },

    setRightSiderCollapsed(Collapsed: boolean) {
      this.rightSiderCollapsed = Collapsed
    },

    setNetworkMode(mode: PanelStateNetworkModeEnum) {
      this.networkMode = mode
      this.recordState()
    },

    canMutatePanelConfig(): boolean {
      activeStoreInstance = this
      return cloudController.canEdit()
    },

    markPanelConfigSynced(config?: Panel.panelConfig) {
      activeStoreInstance = this
      cloudController.markSynced(config)
    },

    startAppearancePreview(presetId: Panel.AppearancePresetId, scopes?: Partial<Panel.AppearancePresetScopes>): boolean {
      activeStoreInstance = this
      return cloudController.startPreview(presetId, scopes)
    },

    updateAppearancePreviewScopes(scopes: Partial<Panel.AppearancePresetScopes>): boolean {
      activeStoreInstance = this
      return cloudController.updatePreviewScopes(scopes)
    },

    cancelAppearancePreview() {
      activeStoreInstance = this
      cloudController.cancelPreview()
    },

    applyAppearancePreset(presetId: Panel.AppearancePresetId, scopes?: Partial<Panel.AppearancePresetScopes>): boolean {
      activeStoreInstance = this
      return cloudController.applyPreset(presetId, scopes)
    },

    setWallpaperSource(backgroundImageSrc: string): boolean {
      activeStoreInstance = this
      return cloudController.setWallpaper(backgroundImageSrc)
    },

    setCardSurface(surface: Panel.CardSurfacePresetId): boolean {
      activeStoreInstance = this
      return cloudController.setCardSurface(surface)
    },

    async savePanelConfigToCloud(): Promise<PanelSaveResult> {
      activeStoreInstance = this
      return cloudController.saveToCloud()
    },

    // 获取云端（搭建的服务器）的面板配置
    updatePanelConfigByCloud() {
      activeStoreInstance = this
      return cloudController.loadFromCloud()
    },

    resetPanelConfig() {
      activeStoreInstance = this
      cloudController.resetRuntimeState()
    },

    restoreDefaultPanelConfig(): boolean {
      activeStoreInstance = this
      return cloudController.resetToDefaults()
    },

    async reloadRoute(id?: number) {
      await router.push({ name: 'AppletDialog', params: { aiAppletId: id } })
    },

    recordState() {
      this.ownerUserId = currentAuthOwnerId()
      setLocalState(this.$state)
    },

    removeState() {
      activeStoreInstance = this
      cloudController.clearForAccountSwitch()
      removeLocalState()
    },
  },
})
