import { defineStore } from 'pinia'
import { useModuleConfig } from '@/store/modules/moduleConfig'
import {
  type LeonStudioConfig,
  STUDIO_CONFIG_MODULE_NAME,
  defaultStudioConfig,
  normalizeStudioConfig,
} from '@/utils/studio/studioConfig'
import { applyModularStyleToDocument } from '@/utils/studio/modularStyle'
import {
  CUSTOM_CODE_MODULE_NAME,
  type CustomCodeSnippet,
  type LeonCustomCodeConfig,
  applyCustomCssToDocument,
  defaultCustomCodeConfig,
  executeCustomJsSnippets,
  isSafeModeActive,
  normalizeCustomCodeConfig,
} from '@/utils/studio/customCode'

const executedJsKeys = new Set<string>()

export interface StudioStoreState {
  config: LeonStudioConfig
  customCode: LeonCustomCodeConfig
  safeMode: boolean
  loaded: boolean
  jsErrors: Array<{ id: string; name: string; message: string }>
}

export const useStudioStore = defineStore('leon-studio-store', {
  state: (): StudioStoreState => ({
    config: defaultStudioConfig(),
    customCode: defaultCustomCodeConfig(),
    safeMode: typeof window !== 'undefined' ? isSafeModeActive(window.location) : false,
    loaded: false,
    jsErrors: [],
  }),
  actions: {
    refreshSafeMode() {
      if (typeof window !== 'undefined')
        this.safeMode = isSafeModeActive(window.location)
    },

    applyRuntimeModularStyle() {
      this.refreshSafeMode()
      applyModularStyleToDocument(this.config.modular, {
        safeMode: this.safeMode,
        reduceMotion: this.config.effects.reduceMotion,
      })
    },

    async loadFromCloud() {
      this.refreshSafeMode()
      const moduleConfig = useModuleConfig()

      try {
        const res = await moduleConfig.getValueByNameFromCloud<unknown>(STUDIO_CONFIG_MODULE_NAME)
        this.config = normalizeStudioConfig(res.code === 0 ? res.data : null)
      }
      catch {
        this.config = defaultStudioConfig()
      }

      try {
        const res = await moduleConfig.getValueByNameFromCloud<unknown>(CUSTOM_CODE_MODULE_NAME)
        this.customCode = normalizeCustomCodeConfig(res.code === 0 ? res.data : null)
      }
      catch {
        this.customCode = defaultCustomCodeConfig()
      }

      this.loaded = true
      this.applyRuntimeModularStyle()
      this.applyRuntimeCustomCode()
    },

    applyRuntimeCustomCode() {
      this.refreshSafeMode()
      if (typeof document !== 'undefined')
        applyCustomCssToDocument(this.customCode.snippets, this.safeMode, document)
      const jsRes = executeCustomJsSnippets(this.customCode.snippets, this.safeMode, executedJsKeys)
      if (jsRes.errors.length > 0)
        this.jsErrors = jsRes.errors
    },

    async saveStudioConfig(next?: LeonStudioConfig) {
      if (next)
        this.config = normalizeStudioConfig(next)
      this.applyRuntimeModularStyle()
      const moduleConfig = useModuleConfig()
      return await moduleConfig.saveToCloud(STUDIO_CONFIG_MODULE_NAME, this.config)
    },

    async saveCustomCode(snippets?: CustomCodeSnippet[]) {
      if (snippets)
        this.customCode = normalizeCustomCodeConfig({ snippets })
      const moduleConfig = useModuleConfig()
      const res = await moduleConfig.saveToCloud(CUSTOM_CODE_MODULE_NAME, this.customCode)
      if (res.code === 0)
        this.applyRuntimeCustomCode()
      return res
    },

    resetRuntimeState() {
      this.config = defaultStudioConfig()
      this.customCode = defaultCustomCodeConfig()
      this.loaded = false
      this.jsErrors = []
      this.applyRuntimeModularStyle()
      if (typeof document !== 'undefined')
        applyCustomCssToDocument([], true, document)
    },
  },
})
