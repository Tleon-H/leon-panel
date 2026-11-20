import { defineStore } from 'pinia'
import { defaultState, defaultStatePanelConfig, getLocalState, removeLocalState, setLocalState } from './helper'
import { router } from '@/router'
import type { PanelStateNetworkModeEnum } from '@/enums'
import { get as getUserConfig, set as setUserConfig } from '@/api/panel/userConfig'
import { useAuthStore } from '@/store/modules/auth'
import { normalizeMaxWidth } from '@/utils/panel/maxWidth'
import {
  DEFAULT_APPEARANCE_SCOPES,
  applyAppearancePreset as buildPresetPanelConfig,
  normalizePanelAppearance,
  normalizeScopes,
  serializePanelConfig,
} from '@/utils/panel/appearance'

let cloudSyncGeneration = 0
let cloudSaveGeneration = 0
let cloudSaveQueue: Promise<void> = Promise.resolve()

function currentAuthOwnerId(): number | null {
  const authStore = useAuthStore()
  if (!authStore.token)
    return null
  const id = authStore.userInfo?.id
  return (typeof id === 'number' && Number.isInteger(id) && id > 0) ? id : null
}

export const usePanelState = defineStore('panel', {
  state: (): Panel.State => getLocalState() || defaultState(),

  getters: {
    isPreviewingAppearance(state): boolean {
      return Boolean(state.previewPresetId)
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

    markPanelConfigSynced(config?: Panel.panelConfig) {
      this.lastSyncedPanelJson = serializePanelConfig(config ?? this.panelConfig)
    },

    startAppearancePreview(presetId: Panel.AppearancePresetId, scopes?: Partial<Panel.AppearancePresetScopes>) {
      this.previewPresetId = presetId
      this.previewScopes = normalizeScopes(scopes ?? this.previewScopes)
    },

    updateAppearancePreviewScopes(scopes: Partial<Panel.AppearancePresetScopes>) {
      this.previewScopes = normalizeScopes({
        ...this.previewScopes,
        ...scopes,
      })
    },

    cancelAppearancePreview() {
      this.previewPresetId = null
    },

    applyAppearancePreset(presetId: Panel.AppearancePresetId, scopes?: Partial<Panel.AppearancePresetScopes>) {
      const next = buildPresetPanelConfig(this.panelConfig, presetId, scopes ?? this.previewScopes)
      this.panelConfig = next
      this.previewPresetId = null
      this.ownerUserId = currentAuthOwnerId()
      this.markPanelConfigSynced(next)
      this.recordState()
    },

    async savePanelConfigToCloud(): Promise<{ ok: boolean; stale?: boolean; msg?: string }> {
      const authStore = useAuthStore()
      const expectedToken = authStore.token || ''
      const generation = ++cloudSaveGeneration
      // Also bump cloudSyncGeneration so an older in-flight GET cannot overwrite this newer write.
      cloudSyncGeneration++

      const snapshot = normalizePanelAppearance({ ...this.panelConfig })
      this.markPanelConfigSynced(snapshot)
      this.recordState()

      // Serialize writes so rapid consecutive applies cannot arrive out-of-order on the server,
      // and skip superseded writes if a newer save or account switch has already occurred.
      let result: { ok: boolean; stale?: boolean; msg?: string } = { ok: false, stale: true }
      const run = cloudSaveQueue.then(async () => {
        if (generation !== cloudSaveGeneration || (authStore.token || '') !== expectedToken) {
          result = { ok: false, stale: true }
          return
        }
        try {
          const res = await setUserConfig({ panel: snapshot })
          if (generation !== cloudSaveGeneration || (authStore.token || '') !== expectedToken) {
            result = { ok: false, stale: true }
            return
          }
          if (res.code === 0)
            result = { ok: true }
          else
            result = { ok: false, msg: res.msg }
        }
        catch {
          if (generation !== cloudSaveGeneration || (authStore.token || '') !== expectedToken)
            result = { ok: false, stale: true }
          else
            result = { ok: false }
        }
      })
      cloudSaveQueue = run.catch(() => undefined)
      await run
      return result
    },

    // 获取云端（搭建的服务器）的面板配置
    updatePanelConfigByCloud() {
      const authStore = useAuthStore()
      const generation = ++cloudSyncGeneration
      const expectedToken = authStore.token || ''

      return getUserConfig<Panel.userConfig>().then((res) => {
        if (generation !== cloudSyncGeneration || (authStore.token || '') !== expectedToken)
          return
        if (res.code === 0) {
          const panel = normalizePanelAppearance({ ...defaultStatePanelConfig(), ...res.data.panel })
          panel.maxWidth = normalizeMaxWidth(panel.maxWidth)
          this.panelConfig = panel
          this.markPanelConfigSynced(panel)
        }
        else {
          this.resetPanelConfig() // 重置恢复默认
        }
        this.ownerUserId = currentAuthOwnerId()
        this.recordState()
      }).catch(() => undefined)
    },

    resetPanelConfig() {
      const next = defaultStatePanelConfig()
      this.panelConfig = next
      this.previewPresetId = null
      this.markPanelConfigSynced(next)
    },

    async reloadRoute(id?: number) {
      await router.push({ name: 'AppletDialog', params: { aiAppletId: id } })
    },

    recordState() {
      this.ownerUserId = currentAuthOwnerId()
      setLocalState(this.$state)
    },

    removeState() {
      cloudSyncGeneration++
      cloudSaveGeneration++
      const next = defaultStatePanelConfig()
      this.panelConfig = next
      this.ownerUserId = null
      this.previewPresetId = null
      this.previewScopes = { ...DEFAULT_APPEARANCE_SCOPES }
      this.markPanelConfigSynced(next)
      removeLocalState()
    },
  },
})
