<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NColorPicker,
  NInput,
  NModal,
  NPopconfirm,
  NSlider,
  NSpin,
  NSwitch,
  NUpload,
  useMessage,
} from 'naive-ui'
import OwnGallery from '@/components/apps/OwnGallery/index.vue'
import PublicGallery from '@/components/apps/PublicGallery/index.vue'
import { SvgIcon } from '@/components/common'
import { PanelPanelConfigStyleEnum } from '@/enums/panel'
import { t } from '@/locales'
import { useAuthStore, usePanelState, useStudioStore } from '@/store'
import {
  APPEARANCE_PRESETS,
  APPEARANCE_PRESET_IDS,
  type AppearancePresetId,
  type AppearancePresetScopes,
  type CardSurfacePresetId,
  DEFAULT_APPEARANCE_SCOPES,
  type IconBadgeStyleId,
  applyThemePackJson,
  exportThemePackJson,
  hasSelectedScope,
  inferWallpaperToneFromSrc,
  resolveHomepageThemeVars,
  shouldAutoSavePanelConfig,
} from '@/utils/panel/appearance'
import {
  CARD_HOVER_EFFECT_OPTIONS,
  CURSOR_PRESET_OPTIONS,
  type CardHoverEffectId,
  type CursorPresetId,
  FONT_PRESETS,
  FONT_PRESET_IDS,
  type FontPresetId,
  ICON_SHAPE_OPTIONS,
  ICON_TONE_OPTIONS,
  type IconShapeId,
  type IconToneFilterId,
  type StudioModularStyleConfig,
  applyCardPointerFx,
  defaultModularStyleConfig,
  resetCardPointerFx,
} from '@/utils/studio/modularStyle'

interface StyleUndoSnapshot {
  panelConfig: Panel.panelConfig
  modular: StudioModularStyleConfig
  gridOverlay: boolean
  hardShadowHover: boolean
  reduceMotion: boolean
}

const MAX_UNDO_STEPS = 20

const authStore = useAuthStore()
const panelState = usePanelState()
const studioStore = useStudioStore()
const ms = useMessage()
const switchStarterApp = inject<((target: string) => void) | undefined>('leonSwitchStarterApp', undefined)

const showWallpaperInput = ref(false)
const showPublicWallpapers = ref(false)
const showOwnWallpapers = ref(false)
const showColorFineTune = ref(false)
const previewCollapsed = ref(false)
const activeSection = ref('presets')
const scrollPaneRef = ref<HTMLElement | null>(null)
const undoStack = ref<StyleUndoSnapshot[]>([])

// Theme JSON export / import modal
const themeJsonModalShow = ref(false)
const themeJsonMode = ref<'export' | 'import'>('export')
const themeJsonText = ref('')
const themePackName = ref('Leon Panel Theme')

const selectedScopes = ref<AppearancePresetScopes>({
  ...(panelState.previewScopes ?? DEFAULT_APPEARANCE_SCOPES),
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
let skipNextAutoSave = false
const saveFailedMessage = ref('')
const savingStudio = ref(false)
const mountedToken = authStore.token || ''
const isEditable = computed(() => panelState.isCloudConfigReady)
const canUndo = computed(() => undoStack.value.length > 0)
const displayedWallpaperTone = computed(() => panelState.panelConfig.wallpaperTone ?? inferWallpaperToneFromSrc(panelState.panelConfig.backgroundImageSrc))

const presetList = computed(() => APPEARANCE_PRESET_IDS.map(id => APPEARANCE_PRESETS[id]))
const fontPresetList = computed(() => FONT_PRESET_IDS.map(id => FONT_PRESETS[id]))
const activeHomepageTheme = computed(() => resolveHomepageThemeVars(panelState.activePanelConfig))

const sectionNavItems = [
  { id: 'presets', icon: 'lucide:palette', labelKey: 'apps.leonStudio.modular.navPresets' },
  { id: 'wallpaper', icon: 'lucide:wallpaper', labelKey: 'apps.leonStudio.modular.navWallpaper' },
  { id: 'card', icon: 'lucide:layout-grid', labelKey: 'apps.leonStudio.modular.navCard' },
  { id: 'icon', icon: 'lucide:boxes', labelKey: 'apps.leonStudio.modular.navIcon' },
  { id: 'font-cursor', icon: 'lucide:compass', labelKey: 'apps.leonStudio.modular.navFontCursor' },
  { id: 'hover-fx', icon: 'lucide:sparkles', labelKey: 'apps.leonStudio.modular.navHoverFx' },
]

const sandboxCanvasStyle = computed(() => {
  const cfg = panelState.activePanelConfig
  const bgSrc = cfg.backgroundImageSrc?.trim()
  return {
    ...activeHomepageTheme.value.cssVars,
    backgroundColor: activeHomepageTheme.value.canvasFallback,
    backgroundImage: bgSrc ? `url("${bgSrc}")` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

const sandboxMaskStyle = computed(() => {
  const cfg = panelState.activePanelConfig
  const blur = Math.max(0, Number(cfg.backgroundBlur) || 0)
  const maskRatio = Math.max(0, Math.min(1, Number(cfg.backgroundMaskNumber) || 0))
  return {
    backdropFilter: blur > 0 ? `blur(${Math.min(14, blur)}px)` : 'none',
    backgroundColor: maskRatio > 0 ? `rgba(0, 0, 0, ${maskRatio})` : 'transparent',
  }
})

const sandboxCardStyle = computed(() => {
  const card = activeHomepageTheme.value.card
  return {
    backgroundColor: card.backgroundColor,
    borderColor: card.borderColor,
    borderWidth: card.borderWidth,
    borderStyle: 'solid',
    borderRadius: `${card.borderRadius}px`,
    boxShadow: card.shadow,
    color: card.defaultTextColor,
    backdropFilter: card.blur > 0 ? `blur(${card.blur}px)` : 'none',
  }
})

const sandboxSecondaryTextColor = computed(() => activeHomepageTheme.value.card.secondaryTextColor)

const iconBadgeOptions: Array<{ id: IconBadgeStyleId; labelKey: string }> = [
  { id: 'precision', labelKey: 'apps.baseSettings.iconBadgePrecision' },
  { id: 'default', labelKey: 'apps.baseSettings.iconBadgeDefault' },
  { id: 'bauhaus', labelKey: 'apps.baseSettings.iconBadgeBauhaus' },
  { id: 'glass', labelKey: 'apps.baseSettings.iconBadgeGlass' },
  { id: 'soft', labelKey: 'apps.baseSettings.iconBadgeSoft' },
  { id: 'outline', labelKey: 'apps.baseSettings.iconBadgeOutline' },
]

const quickAccentColors = ['#0ea5e9', '#2563eb', '#ff4f00', '#10b981', '#8b5cf6', '#eab308']

function cloneSnapshot(): StyleUndoSnapshot {
  return {
    panelConfig: JSON.parse(JSON.stringify(panelState.panelConfig)) as Panel.panelConfig,
    modular: { ...studioStore.config.modular },
    gridOverlay: studioStore.config.effects.gridOverlay,
    hardShadowHover: studioStore.config.effects.hardShadowHover,
    reduceMotion: studioStore.config.effects.reduceMotion,
  }
}

function pushUndoSnapshot() {
  undoStack.value.push(cloneSnapshot())
  if (undoStack.value.length > MAX_UNDO_STEPS)
    undoStack.value.shift()
}

function undoLastChange() {
  const prev = undoStack.value.pop()
  if (!prev)
    return
  studioStore.config.modular = { ...prev.modular }
  studioStore.config.effects.gridOverlay = prev.gridOverlay
  studioStore.config.effects.hardShadowHover = prev.hardShadowHover
  studioStore.config.effects.reduceMotion = prev.reduceMotion
  studioStore.applyRuntimeModularStyle()
  persistStudio()

  if (isEditable.value) {
    clearSaveTimer()
    skipNextAutoSave = true
    panelState.panelConfig = prev.panelConfig
    panelState.recordState()
    uploadCloud(true)
  }
  ms.info(t('apps.leonStudio.modular.undoSuccess'))
}

function handleStudioKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
    return
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && canUndo.value) {
    event.preventDefault()
    undoLastChange()
  }
}

onMounted(() => {
  if (authStore.token && panelState.cloudConfigState === 'idle')
    panelState.updatePanelConfigByCloud()
  if (!studioStore.loaded)
    studioStore.loadFromCloud()
  studioStore.applyRuntimeModularStyle()
  window.addEventListener('keydown', handleStudioKeydown)
})

function scrollToSection(sectionId: string) {
  activeSection.value = sectionId
  const container = scrollPaneRef.value
  if (!container)
    return
  const target = container.querySelector<HTMLElement>(`[data-section="${sectionId}"]`)
  if (target)
    container.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: 'smooth' })
}

function handlePaneScroll() {
  const container = scrollPaneRef.value
  if (!container)
    return
  const threshold = container.scrollTop + 48
  let current = sectionNavItems[0].id
  for (const nav of sectionNavItems) {
    const el = container.querySelector<HTMLElement>(`[data-section="${nav.id}"]`)
    if (el && el.offsetTop <= threshold)
      current = nav.id
  }
  activeSection.value = current
}

function handleDemoPointerMove(event: PointerEvent) {
  applyCardPointerFx(event, studioStore.config.modular.cardHoverEffect, studioStore.config.effects.reduceMotion)
}

function handleDemoPointerLeave(event: PointerEvent) {
  resetCardPointerFx(event)
}

function handleFxTilePointerMove(event: PointerEvent, effect: CardHoverEffectId) {
  applyCardPointerFx(event, effect, false)
}

function cursorPreviewStyle(cursor: CursorPresetId, svgUri: string) {
  if (cursor === 'system')
    return undefined
  const hotspot = cursor === 'crosshair-tech' ? '12 12' : '3 2'
  return { cursor: `url("${svgUri}") ${hotspot}, pointer` }
}

function clearSaveTimer() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

watch(
  () => authStore.token,
  () => {
    clearSaveTimer()
    saveFailedMessage.value = ''
  },
)

watch(
  () => panelState.panelConfig,
  (config) => {
    if (!panelState.isCloudConfigReady)
      return
    if (skipNextAutoSave) {
      skipNextAutoSave = false
      return
    }
    if (!shouldAutoSavePanelConfig(config, panelState.lastSyncedPanelJson ?? null))
      return
    panelState.recordState()
    clearSaveTimer()
    saveTimer = setTimeout(() => {
      saveTimer = null
      if (!panelState.isCloudConfigReady || !shouldAutoSavePanelConfig(panelState.panelConfig, panelState.lastSyncedPanelJson ?? null))
        return
      uploadCloud(true)
    }, 450)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleStudioKeydown)
  const hadTimer = saveTimer !== null
  clearSaveTimer()
  if (
    hadTimer
    && panelState.isCloudConfigReady
    && (authStore.token || '') === mountedToken
    && shouldAutoSavePanelConfig(panelState.panelConfig, panelState.lastSyncedPanelJson ?? null)
  )
    uploadCloud(true)
})

function scopeSummary(scopes: AppearancePresetScopes): string {
  const labels: string[] = []
  if (scopes.wallpaper)
    labels.push(t('apps.baseSettings.presets.scopeWallpaper'))
  if (scopes.cardStyle)
    labels.push(t('apps.baseSettings.presets.scopeCardStyle'))
  if (scopes.iconStyle)
    labels.push(t('apps.baseSettings.presets.scopeIconStyle'))
  return labels.join('、')
}

function previewPreset(presetId: AppearancePresetId) {
  if (!panelState.isCloudConfigReady)
    return
  if (!hasSelectedScope(selectedScopes.value)) {
    ms.warning(t('apps.baseSettings.presets.selectAtLeastOne'))
    return
  }
  panelState.startAppearancePreview(presetId, { ...selectedScopes.value })
}

function applyPreset(presetId: AppearancePresetId) {
  if (!panelState.isCloudConfigReady)
    return
  if (!hasSelectedScope(selectedScopes.value)) {
    ms.warning(t('apps.baseSettings.presets.selectAtLeastOne'))
    return
  }
  pushUndoSnapshot()
  clearSaveTimer()
  skipNextAutoSave = true
  const scopesSnapshot = { ...selectedScopes.value }
  if (!panelState.applyAppearancePreset(presetId, scopesSnapshot)) {
    skipNextAutoSave = false
    return
  }
  const preset = APPEARANCE_PRESETS[presetId]
  uploadCloud(true).then((ok) => {
    if (ok) {
      ms.success(t('apps.baseSettings.presets.applied', {
        name: t(preset.nameKey),
        scopes: scopeSummary(scopesSnapshot),
      }))
    }
  })
}

function applyWallpaperOnly(presetId: AppearancePresetId) {
  if (!isEditable.value)
    return
  pushUndoSnapshot()
  clearSaveTimer()
  skipNextAutoSave = true
  if (!panelState.applyAppearancePreset(presetId, { wallpaper: true, cardStyle: false, iconStyle: false })) {
    skipNextAutoSave = false
    return
  }
  uploadCloud(true)
}

function handleCardSurfaceSelect(surface: CardSurfacePresetId) {
  if (!isEditable.value)
    return
  pushUndoSnapshot()
  if (surface === 'default') {
    panelState.setCardSurface('default')
    return
  }
  clearSaveTimer()
  skipNextAutoSave = true
  if (!panelState.applyAppearancePreset(surface, { wallpaper: false, cardStyle: true, iconStyle: false })) {
    skipNextAutoSave = false
    return
  }
  uploadCloud(true)
}

function setIconStyleView(style: PanelPanelConfigStyleEnum) {
  if (!isEditable.value)
    return
  pushUndoSnapshot()
  panelState.panelConfig.iconStyle = style
}

function selectIconBadge(style: IconBadgeStyleId) {
  if (!isEditable.value)
    return
  pushUndoSnapshot()
  panelState.panelConfig.iconBadgeStyle = style
}

function selectAccentColor(color: string) {
  if (!isEditable.value)
    return
  pushUndoSnapshot()
  panelState.panelConfig.cardAccentColor = color
}

function setWallpaperTone(tone: 'dark' | 'light') {
  if (!isEditable.value)
    return
  pushUndoSnapshot()
  panelState.panelConfig.wallpaperTone = tone
}

async function persistStudio(successMessage?: unknown) {
  savingStudio.value = true
  try {
    const res = await studioStore.saveStudioConfig()
    if (res.code === 0) {
      if (typeof successMessage === 'string' && successMessage)
        ms.success(successMessage)
    }
    else {
      ms.error(res.msg || t('common.failed'))
    }
  }
  finally {
    savingStudio.value = false
  }
}

function selectHoverFx(effect: CardHoverEffectId) {
  pushUndoSnapshot()
  studioStore.config.modular.cardHoverEffect = effect
  studioStore.config.effects.hardShadowHover = effect === 'bauhaus-pop'
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectCursorPreset(cursor: CursorPresetId) {
  pushUndoSnapshot()
  studioStore.config.modular.cursorPreset = cursor
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectFontPreset(font: FontPresetId) {
  pushUndoSnapshot()
  studioStore.config.modular.fontPreset = font
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectIconShape(shape: IconShapeId) {
  pushUndoSnapshot()
  studioStore.config.modular.iconShape = shape
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectIconTone(tone: IconToneFilterId) {
  pushUndoSnapshot()
  studioStore.config.modular.iconToneFilter = tone
  if (isEditable.value)
    panelState.panelConfig.iconMonochrome = tone === 'soft-mono'
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function handleGridOverlayChange(val: boolean) {
  pushUndoSnapshot()
  studioStore.config.effects.gridOverlay = val
  persistStudio()
}

function handleReduceMotionChange(val: boolean) {
  pushUndoSnapshot()
  studioStore.config.effects.reduceMotion = val
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function resetAllVisualDefaults() {
  pushUndoSnapshot()
  studioStore.config.modular = defaultModularStyleConfig()
  studioStore.config.effects.gridOverlay = false
  studioStore.config.effects.reduceMotion = false
  studioStore.applyRuntimeModularStyle()
  persistStudio(t('apps.leonStudio.modular.resetModularDone'))
  if (isEditable.value) {
    clearSaveTimer()
    skipNextAutoSave = true
    if (panelState.restoreDefaultPanelConfig())
      uploadCloud(true)
    else
      skipNextAutoSave = false
  }
}

function openExportThemeJson() {
  themeJsonMode.value = 'export'
  themeJsonText.value = exportThemePackJson(panelState.panelConfig, themePackName.value)
  themeJsonModalShow.value = true
}

function openImportThemeJson() {
  themeJsonMode.value = 'import'
  themeJsonText.value = ''
  themeJsonModalShow.value = true
}

function copyThemeJson() {
  navigator.clipboard?.writeText(themeJsonText.value).then(() => {
    ms.success(t('apps.leonStudio.copiedSuccess'))
  }).catch(() => {
    ms.warning(t('apps.leonStudio.copyFailed'))
  })
}

function downloadThemeJson() {
  const blob = new Blob([themeJsonText.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'leon-panel-theme.json'
  a.click()
  URL.revokeObjectURL(url)
}

function confirmImportThemeJson() {
  if (!isEditable.value)
    return
  const result = applyThemePackJson(panelState.panelConfig, themeJsonText.value)
  if (!result.ok) {
    ms.error(t('apps.leonStudio.invalidThemeJson'))
    return
  }
  pushUndoSnapshot()
  clearSaveTimer()
  skipNextAutoSave = true
  panelState.panelConfig = result.config
  panelState.recordState()
  uploadCloud(true).then((ok) => {
    if (ok) {
      themeJsonModalShow.value = false
      ms.success(t('apps.leonStudio.themeImported', { name: result.name }))
    }
  })
}

function handleWallpaperUrlInput(src: string) {
  panelState.setWallpaperSource(src)
}

function handleUploadBackgroundFinish({
  file,
  event,
}: {
  file: UploadFileInfo
  event?: ProgressEvent
}) {
  if (!panelState.isCloudConfigReady)
    return file
  const res = JSON.parse((event?.target as XMLHttpRequest).response)
  if (res.code === 0 && res.data?.imageUrl) {
    pushUndoSnapshot()
    panelState.setWallpaperSource(res.data.imageUrl)
  }
  else {
    ms.error(t('common.uploadFail'))
  }
  return file
}

function usePublicWallpaper(src: string) {
  pushUndoSnapshot()
  panelState.setWallpaperSource(src)
  showPublicWallpapers.value = false
}

function useOwnWallpaper(src: string) {
  pushUndoSnapshot()
  panelState.setWallpaperSource(src)
  showOwnWallpapers.value = false
}

function retryLoadCloudConfig() {
  panelState.updatePanelConfigByCloud()
}

function uploadCloud(silentSuccess = false): Promise<boolean> {
  clearSaveTimer()
  return panelState.savePanelConfigToCloud().then((result) => {
    if (result.stale || result.blocked)
      return false
    if (result.ok) {
      saveFailedMessage.value = ''
      if (!silentSuccess)
        ms.success(t('apps.baseSettings.configSaved'))
      return true
    }
    if (result.msg) {
      const errText = t('apps.baseSettings.configFailed', { message: result.msg })
      saveFailedMessage.value = errText
      ms.error(errText)
    }
    else {
      const errText = t('common.networkError')
      saveFailedMessage.value = errText
      ms.error(errText)
    }
    return false
  })
}
</script>

<template>
  <div class="leon-visual-studio">
    <!-- 顶部常驻区：实时预览 + 撤销/导入导出工具栏 + 紧凑图标锚点栏 -->
    <div class="leon-pinned-dock">
      <NAlert
        v-if="panelState.cloudConfigState === 'loading' || panelState.cloudConfigState === 'idle'"
        type="info"
        class="mb-2"
        data-testid="panel-config-loading"
      >
        <div class="flex items-center gap-2">
          <NSpin size="small" />
          <span>{{ $t('apps.baseSettings.configLoading') }}</span>
        </div>
      </NAlert>

      <NAlert
        v-else-if="panelState.cloudConfigState === 'error'"
        type="error"
        class="mb-2"
        data-testid="panel-config-load-error"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ panelState.cloudConfigError || $t('apps.baseSettings.configLoadFailed') }}</span>
          <NButton size="tiny" type="error" secondary data-testid="panel-config-load-retry" @click="retryLoadCloudConfig">
            {{ $t('apps.baseSettings.configLoadRetry') }}
          </NButton>
        </div>
      </NAlert>

      <NAlert
        v-if="saveFailedMessage && isEditable"
        type="warning"
        class="mb-2"
        data-testid="panel-config-save-error"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ saveFailedMessage }}</span>
          <NButton size="tiny" type="warning" secondary data-testid="panel-config-save-retry" @click="uploadCloud()">
            {{ $t('apps.baseSettings.configSaveRetry') }}
          </NButton>
        </div>
      </NAlert>

      <div
        class="leon-sandbox-shell"
        :class="{
          'leon-fx-grid-overlay': studioStore.config.effects.gridOverlay,
          'leon-tone-light': activeHomepageTheme.isLightCanvas,
        }"
        :style="sandboxCanvasStyle"
        data-testid="modular-live-sandbox"
      >
        <div class="leon-sandbox-mask" :style="sandboxMaskStyle" />
        <div class="leon-sandbox-inner">
          <div class="flex flex-wrap items-center justify-between gap-1.5">
            <span
              class="leon-sandbox-pill"
              :style="{
                background: activeHomepageTheme.controlBackground,
                color: activeHomepageTheme.controlTextColor,
              }"
            >
              <SvgIcon icon="lucide:sparkles" class="text-[12px]" />
              <span>{{ $t('apps.leonStudio.modular.sandboxTitleShort') }}</span>
            </span>

            <div class="flex flex-wrap items-center gap-1">
              <NButton
                size="tiny"
                secondary
                :disabled="!canUndo"
                data-testid="style-undo-btn"
                :title="$t('apps.leonStudio.modular.undoTooltip')"
                @click="undoLastChange"
              >
                <template #icon>
                  <SvgIcon icon="lucide:refresh-cw" class="text-[12px]" />
                </template>
                {{ $t('apps.leonStudio.modular.undoBtn') }}
              </NButton>
              <NButton size="tiny" secondary :disabled="!isEditable" data-testid="theme-json-export" :title="$t('apps.leonStudio.exportThemeJson')" @click="openExportThemeJson">
                <template #icon>
                  <SvgIcon icon="lucide:file-down" class="text-[12px]" />
                </template>
                {{ $t('apps.leonStudio.exportThemeJson') }}
              </NButton>
              <NButton size="tiny" secondary :disabled="!isEditable" data-testid="theme-json-import" :title="$t('apps.leonStudio.importThemeJson')" @click="openImportThemeJson">
                <template #icon>
                  <SvgIcon icon="lucide:file-up" class="text-[12px]" />
                </template>
                {{ $t('apps.leonStudio.importThemeJson') }}
              </NButton>
              <NPopconfirm @positive-click="resetAllVisualDefaults">
                <template #trigger>
                  <NButton size="tiny" secondary :loading="savingStudio" data-testid="modular-reset-btn">
                    {{ $t('common.reset') }}
                  </NButton>
                </template>
                {{ $t('apps.baseSettings.resetWarnText') }}
              </NPopconfirm>
              <NButton
                v-if="switchStarterApp"
                size="tiny"
                secondary
                :title="$t('apps.leonStudio.gotoLayoutStudio')"
                @click="switchStarterApp?.('LeonStudio')"
              >
                <template #icon>
                  <SvgIcon icon="lucide:layout-grid" class="text-[12px]" />
                </template>
              </NButton>
              <NButton
                size="tiny"
                secondary
                data-testid="toggle-preview-collapse"
                :title="previewCollapsed ? $t('apps.leonStudio.modular.expandPreview') : $t('apps.leonStudio.modular.collapsePreview')"
                @click="previewCollapsed = !previewCollapsed"
              >
                <template #icon>
                  <SvgIcon :icon="previewCollapsed ? 'lucide:chevron-down' : 'lucide:chevron-up'" class="text-[12px]" />
                </template>
              </NButton>
            </div>
          </div>

          <div v-show="!previewCollapsed" class="mt-2">
            <div class="grid grid-cols-2 gap-2">
              <div class="leon-hover-demo-wrap">
                <div
                  class="leon-hover-demo-card"
                  :style="sandboxCardStyle"
                  @pointermove="handleDemoPointerMove"
                  @pointerleave="handleDemoPointerLeave"
                >
                  <div class="leon-icon-badge leon-icon-badge-fullbleed shrink-0">
                    <div class="item-icon leon-demo-icon-full" style="background: linear-gradient(135deg, #0ea5e9, #2563eb);">
                      <SvgIcon icon="lucide:container" class="text-[20px] text-white" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-semibold truncate">
                      {{ $t('apps.leonStudio.modular.sandboxCardDockerTitle') }}
                    </div>
                    <div class="text-[11px] truncate mt-0.5" :style="{ color: sandboxSecondaryTextColor }">
                      192.168.2.200
                    </div>
                  </div>
                </div>
              </div>

              <div class="leon-hover-demo-wrap">
                <div
                  class="leon-hover-demo-card"
                  :style="sandboxCardStyle"
                  @pointermove="handleDemoPointerMove"
                  @pointerleave="handleDemoPointerLeave"
                >
                  <div class="leon-icon-badge leon-icon-badge-fullbleed shrink-0">
                    <div class="item-icon leon-demo-icon-full" style="background: linear-gradient(135deg, #8b5cf6, #ec4899);">
                      <SvgIcon icon="lucide:play-circle" class="text-[20px] text-white" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-semibold truncate">
                      {{ $t('apps.leonStudio.modular.sandboxCardMediaTitle') }}
                    </div>
                    <div class="text-[11px] truncate mt-0.5" :style="{ color: sandboxSecondaryTextColor }">
                      4K HDR
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 紧凑锚点导航条 -->
      <div class="leon-section-nav" role="tablist">
        <button
          v-for="nav in sectionNavItems"
          :key="nav.id"
          type="button"
          class="leon-section-nav-pill"
          :class="{ 'is-active': activeSection === nav.id }"
          @click="scrollToSection(nav.id)"
        >
          <SvgIcon :icon="nav.icon" class="text-[13px]" />
          <span>{{ $t(nav.labelKey) }}</span>
        </button>
      </div>
    </div>

    <!-- 下方独立滚动区：纯视觉缩略图 + 短标签 -->
    <div ref="scrollPaneRef" class="leon-visual-scroll" @scroll.passive="handlePaneScroll">
      <fieldset :disabled="!isEditable" class="leon-style-fieldset space-y-2.5">
        <!-- 1. 整套主题（纯色卡视觉网格，键盘与触屏均可直接预览/应用） -->
        <NCard size="small" data-section="presets" data-testid="appearance-presets-card">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:palette" class="text-[14px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.navPresets') }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <NCheckbox v-model:checked="selectedScopes.wallpaper" size="small" :disabled="!isEditable" data-testid="preset-scope-wallpaper">
                {{ $t('apps.baseSettings.presets.scopeWallpaper') }}
              </NCheckbox>
              <NCheckbox v-model:checked="selectedScopes.cardStyle" size="small" :disabled="!isEditable" data-testid="preset-scope-cardStyle">
                {{ $t('apps.baseSettings.presets.scopeCardStyle') }}
              </NCheckbox>
              <NCheckbox v-model:checked="selectedScopes.iconStyle" size="small" :disabled="!isEditable" data-testid="preset-scope-iconStyle">
                {{ $t('apps.baseSettings.presets.scopeIconStyle') }}
              </NCheckbox>
            </div>
          </div>

          <div class="preset-grid">
            <div
              v-for="preset in presetList"
              :key="preset.id"
              class="preset-option"
              :class="{ 'is-active': panelState.panelConfig.cardSurface === preset.id }"
              :title="$t(preset.descKey)"
              :data-testid="`preset-card-${preset.id}`"
            >
              <div
                class="preset-swatch"
                :style="{
                  backgroundColor: preset.swatch.canvas,
                  backgroundImage: `url(${preset.wallpaper.backgroundImageSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }"
              >
                <span v-if="panelState.panelConfig.cardSurface === preset.id" class="leon-selected-check" aria-hidden="true">
                  <SvgIcon icon="lucide:check" class="text-[10px]" />
                </span>
                <div
                  class="preset-swatch-card"
                  :style="{
                    background: preset.swatch.card,
                    borderColor: preset.swatch.border,
                  }"
                >
                  <span class="preset-swatch-dot" :style="{ background: preset.swatch.accent }" />
                  <div class="preset-swatch-lines">
                    <span class="preset-swatch-line" :style="{ background: preset.swatch.text }" />
                    <span class="preset-swatch-line short" :style="{ background: preset.swatch.text }" />
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between gap-1 mt-1.5">
                <span class="font-semibold text-xs truncate">{{ $t(preset.nameKey) }}</span>
              </div>

              <div class="grid grid-cols-2 gap-1.5 mt-1.5">
                <NButton
                  size="tiny"
                  secondary
                  :disabled="!isEditable"
                  :data-testid="`preset-preview-${preset.id}`"
                  @click="previewPreset(preset.id)"
                >
                  {{ $t('apps.baseSettings.presets.preview') }}
                </NButton>
                <NButton
                  size="tiny"
                  type="primary"
                  :disabled="!isEditable"
                  :data-testid="`preset-apply-${preset.id}`"
                  @click="applyPreset(preset.id)"
                >
                  {{ $t('apps.leonStudio.modular.applyShort') }}
                </NButton>
              </div>
            </div>
          </div>
        </NCard>

        <!-- 2. 画布壁纸（10 枚真实缩略图 + 一行紧凑工具条） -->
        <NCard size="small" data-section="wallpaper">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:wallpaper" class="text-[14px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.navWallpaper') }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <NUpload
                action="/api/file/uploadImg"
                :show-file-list="false"
                name="imgfile"
                :data="{ category: 'wallpaper' }"
                :headers="{ token: authStore.token as string }"
                @finish="handleUploadBackgroundFinish"
              >
                <NButton size="tiny" secondary :disabled="!isEditable" data-testid="upload-wallpaper-btn">
                  <template #icon>
                    <SvgIcon icon="lucide:upload" class="text-[12px]" />
                  </template>
                  {{ $t('apps.leonStudio.modular.uploadShort') }}
                </NButton>
              </NUpload>
              <NButton size="tiny" secondary :disabled="!isEditable" data-testid="open-own-wallpapers" @click="showOwnWallpapers = true">
                <template #icon>
                  <SvgIcon icon="lucide:image" class="text-[12px]" />
                </template>
                {{ $t('apps.leonStudio.modular.ownGalleryShort') }}
              </NButton>
              <NButton size="tiny" secondary :disabled="!isEditable" data-testid="open-public-wallpapers" @click="showPublicWallpapers = true">
                <template #icon>
                  <SvgIcon icon="lucide:images" class="text-[12px]" />
                </template>
                {{ $t('apps.leonStudio.modular.publicGalleryShort') }}
              </NButton>
              <NButton
                size="tiny"
                :type="showWallpaperInput ? 'primary' : 'default'"
                secondary
                :disabled="!isEditable"
                @click="showWallpaperInput = !showWallpaperInput"
              >
                URL
              </NButton>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              v-for="preset in presetList"
              :key="`wall-${preset.id}`"
              type="button"
              class="leon-swatch-tile"
              :class="{ 'is-active': panelState.panelConfig.backgroundImageSrc === preset.wallpaper.backgroundImageSrc }"
              :disabled="!isEditable"
              @click="applyWallpaperOnly(preset.id)"
            >
              <div
                class="leon-wall-swatch"
                :style="{
                  backgroundColor: preset.swatch.canvas,
                  backgroundImage: `url(${preset.wallpaper.backgroundImageSrc})`,
                }"
              >
                <span v-if="panelState.panelConfig.backgroundImageSrc === preset.wallpaper.backgroundImageSrc" class="leon-selected-check" aria-hidden="true">
                  <SvgIcon icon="lucide:check" class="text-[10px]" />
                </span>
                <span class="leon-wall-label">{{ $t(preset.nameKey) }}</span>
              </div>
            </button>
          </div>

          <div v-if="showWallpaperInput" class="mt-2">
            <NInput
              :value="panelState.panelConfig.backgroundImageSrc"
              type="text"
              size="small"
              clearable
              :disabled="!isEditable"
              data-testid="wallpaper-url-input"
              placeholder="https://... /assets/..."
              @update:value="handleWallpaperUrlInput"
            />
          </div>

          <div class="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-75 shrink-0">{{ $t('apps.baseSettings.vague') }}</span>
              <NSlider v-model:value="panelState.panelConfig.backgroundBlur" class="flex-1" :step="1" :min="0" :max="20" />
              <span class="text-[11px] font-mono opacity-75 w-8 text-right">{{ panelState.panelConfig.backgroundBlur ?? 0 }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-75 shrink-0">{{ $t('apps.baseSettings.mask') }}</span>
              <NSlider v-model:value="panelState.panelConfig.backgroundMaskNumber" class="flex-1" :step="0.05" :min="0" :max="1" />
              <span class="text-[11px] font-mono opacity-75 w-8 text-right">{{ Math.round((panelState.panelConfig.backgroundMaskNumber ?? 0) * 100) }}%</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="leon-mod-chip"
                :class="{ 'is-active': displayedWallpaperTone === 'dark' }"
                :disabled="!isEditable"
                data-testid="wallpaper-tone-dark"
                @click="setWallpaperTone('dark')"
              >
                {{ $t('apps.leonStudio.modular.toneDarkShort') }}
              </button>
              <button
                type="button"
                class="leon-mod-chip"
                :class="{ 'is-active': displayedWallpaperTone === 'light' }"
                :disabled="!isEditable"
                data-testid="wallpaper-tone-light"
                @click="setWallpaperTone('light')"
              >
                {{ $t('apps.leonStudio.modular.toneLightShort') }}
              </button>
            </div>
            <label class="flex items-center justify-end gap-2 text-xs">
              <span class="opacity-80">{{ $t('apps.leonStudio.fxGridOverlay') }}</span>
              <NSwitch :value="studioStore.config.effects.gridOverlay" size="small" @update:value="handleGridOverlayChange" />
            </label>
          </div>

          <NModal v-model:show="showOwnWallpapers" preset="card" :title="$t('apps.ownGallery.title')" style="width: min(720px, 96vw);">
            <OwnGallery selectable @select="useOwnWallpaper" />
          </NModal>
          <NModal v-model:show="showPublicWallpapers" preset="card" :title="$t('apps.publicGallery.appName')" style="width: min(720px, 96vw);">
            <PublicGallery locked-category="wallpaper" selectable @select="usePublicWallpaper" />
          </NModal>
        </NCard>

        <!-- 3. 卡片材质与快捷色点 -->
        <NCard size="small" data-section="card" data-testid="card-style-settings">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:layout-grid" class="text-[14px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.navCard') }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                v-for="color in quickAccentColors"
                :key="color"
                type="button"
                class="leon-color-dot"
                :class="{ 'is-active': panelState.panelConfig.cardAccentColor === color }"
                :style="{ backgroundColor: color }"
                :title="color"
                :disabled="!isEditable"
                @click="selectAccentColor(color)"
              />
              <NButton size="tiny" secondary @click="showColorFineTune = !showColorFineTune">
                {{ $t('apps.leonStudio.modular.fineTuneShort') }}
              </NButton>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              v-for="preset in presetList"
              :key="`surface-${preset.id}`"
              type="button"
              class="leon-swatch-tile"
              :class="{ 'is-active': panelState.panelConfig.cardSurface === preset.id }"
              :disabled="!isEditable"
              @click="handleCardSurfaceSelect(preset.id)"
            >
              <div
                class="leon-surface-swatch"
                :style="{
                  background: preset.swatch.card,
                  borderColor: preset.swatch.border,
                  color: preset.swatch.text,
                }"
              >
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: preset.swatch.accent }" />
                <span class="text-[11px] font-semibold truncate">{{ $t(preset.nameKey) }}</span>
              </div>
            </button>
          </div>

          <div class="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-75 shrink-0">{{ $t('apps.baseSettings.cardRadius') }}</span>
              <NSlider v-model:value="panelState.panelConfig.cardBorderRadius" class="flex-1" :step="1" :min="0" :max="24" />
              <span class="text-[11px] font-mono opacity-75 w-8 text-right">{{ panelState.panelConfig.cardBorderRadius ?? 14 }}px</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-75 shrink-0">{{ $t('apps.baseSettings.cardBlur') }}</span>
              <NSlider v-model:value="panelState.panelConfig.cardBlur" class="flex-1" :step="2" :min="0" :max="24" />
              <span class="text-[11px] font-mono opacity-75 w-8 text-right">{{ panelState.panelConfig.cardBlur ?? 0 }}px</span>
            </div>
          </div>

          <div v-if="showColorFineTune" class="mt-2.5 pt-2.5 border-t border-slate-300/40 dark:border-zinc-700/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-75 shrink-0">{{ $t('apps.baseSettings.cardBackgroundColor') }}</span>
              <NColorPicker
                v-model:value="panelState.panelConfig.cardBackgroundColor"
                :show-alpha="true"
                size="small"
                :modes="['rgb', 'hex']"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-75 shrink-0">{{ $t('apps.baseSettings.cardAccentColor') }}</span>
              <NColorPicker
                v-model:value="panelState.panelConfig.cardAccentColor"
                :show-alpha="false"
                size="small"
                :modes="['hex']"
              />
            </div>
          </div>
        </NCard>

        <!-- 4. 图标外观（全图形对比：视图线框 · 形状轮廓 · 真实彩色图标滤镜对比） -->
        <NCard size="small" data-section="icon">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:boxes" class="text-[14px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.navIcon') }}</span>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <label v-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.info" class="flex items-center gap-1.5">
                <span class="opacity-75">{{ $t('apps.baseSettings.hideDescription') }}</span>
                <NSwitch v-model:value="panelState.panelConfig.iconTextInfoHideDescription" size="small" />
              </label>
              <label v-else-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.icon" class="flex items-center gap-1.5">
                <span class="opacity-75">{{ $t('apps.baseSettings.hideTitle') }}</span>
                <NSwitch v-model:value="panelState.panelConfig.iconTextIconHideTitle" size="small" />
              </label>
            </div>
          </div>

          <div class="space-y-3">
            <!-- 4.1 卡片视图线框 + 容器胶囊 -->
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="leon-visual-tile"
                :class="{ 'is-active': panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.info }"
                :disabled="!isEditable"
                data-testid="icon-view-info"
                @click="setIconStyleView(PanelPanelConfigStyleEnum.info)"
              >
                <span class="leon-wireframe-info" aria-hidden="true">
                  <span class="wf-sq" />
                  <span class="wf-lines"><i /><i class="short" /></span>
                </span>
                <span class="text-xs font-semibold">{{ $t('apps.baseSettings.detailIcon') }}</span>
              </button>

              <button
                type="button"
                class="leon-visual-tile"
                :class="{ 'is-active': panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.icon }"
                :disabled="!isEditable"
                data-testid="icon-view-small"
                @click="setIconStyleView(PanelPanelConfigStyleEnum.icon)"
              >
                <span class="leon-wireframe-small" aria-hidden="true">
                  <span class="wf-sq" />
                  <i />
                </span>
                <span class="text-xs font-semibold">{{ $t('apps.baseSettings.smallIcon') }}</span>
              </button>
            </div>

            <!-- 4.2 几何形状（4 枚大号图形卡片） -->
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="shape in ICON_SHAPE_OPTIONS"
                :key="shape.id"
                type="button"
                class="leon-visual-tile is-centered"
                :class="{ 'is-active': studioStore.config.modular.iconShape === shape.id }"
                :title="$t(shape.descKey)"
                :data-testid="`modular-shape-${shape.id}`"
                @click="selectIconShape(shape.id)"
              >
                <span class="leon-shape-glyph-lg" :class="`is-${shape.id}`" />
                <span class="text-[11px] font-semibold truncate">{{ $t(shape.nameKey) }}</span>
              </button>
            </div>

            <!-- 4.3 色彩滤镜（真实彩色图标缩略对比，一眼看出区别） -->
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="tone in ICON_TONE_OPTIONS"
                :key="tone.id"
                type="button"
                class="leon-visual-tile is-centered"
                :class="{ 'is-active': studioStore.config.modular.iconToneFilter === tone.id }"
                :title="$t(tone.descKey)"
                :data-testid="`modular-tone-${tone.id}`"
                @click="selectIconTone(tone.id)"
              >
                <span class="leon-tone-sample-icon" :class="`is-${tone.id}`">
                  <SvgIcon icon="lucide:sparkles" class="text-[14px] text-white" />
                </span>
                <span class="text-[11px] font-semibold truncate">{{ $t(tone.nameKey) }}</span>
              </button>
            </div>

            <!-- 4.4 容器样式胶囊 + 图标文字色 -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="badge in iconBadgeOptions"
                  :key="badge.id"
                  type="button"
                  class="leon-mod-chip"
                  :class="{ 'is-active': (panelState.panelConfig.iconBadgeStyle || 'precision') === badge.id }"
                  :disabled="!isEditable"
                  @click="selectIconBadge(badge.id)"
                >
                  {{ $t(badge.labelKey) }}
                </button>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] opacity-70">{{ $t('common.textColor') }}</span>
                <NColorPicker
                  v-model:value="panelState.panelConfig.iconTextColor"
                  style="width: 72px;"
                  :show-alpha="false"
                  size="small"
                  :modes="['hex']"
                />
              </div>
            </div>
          </div>
        </NCard>

        <!-- 5. 字体排版与硬件级指针（悬停指针卡片直接局部试用指针手感） -->
        <NCard size="small" data-section="font-cursor">
          <div class="leon-mod-title mb-2">
            <SvgIcon icon="lucide:book-open" class="text-[14px] opacity-80" />
            <span>{{ $t('apps.leonStudio.modular.fontTitle') }}</span>
          </div>

          <div class="grid grid-cols-3 gap-2 mb-3.5">
            <button
              v-for="font in fontPresetList"
              :key="font.id"
              type="button"
              class="leon-visual-tile is-centered"
              :class="{ 'is-active': studioStore.config.modular.fontPreset === font.id }"
              :data-testid="`modular-font-${font.id}`"
              @click="selectFontPreset(font.id)"
            >
              <span
                class="text-base font-bold leading-tight"
                :style="{ fontFamily: font.fontFamily, letterSpacing: font.letterSpacing }"
              >
                Aa 导航
              </span>
              <span class="text-[11px] opacity-75 truncate">{{ $t(font.nameKey) }}</span>
            </button>
          </div>

          <div class="pt-3 border-t border-slate-300/40 dark:border-zinc-700/60">
            <div class="leon-mod-title mb-2">
              <SvgIcon icon="lucide:compass" class="text-[14px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.cursorTitleShort') }}</span>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <button
                v-for="opt in CURSOR_PRESET_OPTIONS"
                :key="opt.id"
                type="button"
                class="leon-visual-tile is-centered"
                :class="{ 'is-active': studioStore.config.modular.cursorPreset === opt.id }"
                :style="cursorPreviewStyle(opt.id, opt.previewSvgUri)"
                :title="$t(opt.descKey)"
                :data-testid="`modular-cursor-${opt.id}`"
                @click="selectCursorPreset(opt.id)"
              >
                <span class="leon-cursor-svg-box">
                  <img :src="opt.previewSvgUri" width="24" height="24" alt="" class="block select-none">
                </span>
                <span class="text-[11px] font-semibold truncate">{{ $t(opt.nameKey) }}</span>
              </button>
            </div>
          </div>
        </NCard>

        <!-- 6. 指针划过标签动效（每张选项卡片自身就是交互体验演示） -->
        <NCard size="small" data-section="hover-fx">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:sparkles" class="text-[14px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.navHoverFx') }}</span>
            </div>
            <label class="flex items-center gap-2 text-xs">
              <span class="opacity-80">{{ $t('apps.leonStudio.fxReduceMotion') }}</span>
              <NSwitch :value="studioStore.config.effects.reduceMotion" size="small" @update:value="handleReduceMotionChange" />
            </label>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              v-for="opt in CARD_HOVER_EFFECT_OPTIONS"
              :key="opt.id"
              type="button"
              class="leon-fx-live-tile"
              :class="[`fx-preview-${opt.id}`, { 'is-active': studioStore.config.modular.cardHoverEffect === opt.id }]"
              :title="$t(opt.descKey)"
              :data-testid="`modular-hover-${opt.id}`"
              @pointermove="(e) => handleFxTilePointerMove(e, opt.id)"
              @pointerleave="resetCardPointerFx"
              @click="selectHoverFx(opt.id)"
            >
              <span class="leon-fx-mini-card" aria-hidden="true">
                <i class="fx-dot" />
                <i class="fx-bar" />
              </span>
              <span class="text-xs font-semibold truncate relative z-10">{{ $t(opt.nameKey) }}</span>
            </button>
          </div>
        </NCard>
      </fieldset>
    </div>

    <NModal
      v-model:show="themeJsonModalShow"
      preset="card"
      :title="themeJsonMode === 'export' ? $t('apps.leonStudio.exportThemeJson') : $t('apps.leonStudio.importThemeJson')"
      style="width: min(620px, 95vw);"
    >
      <div class="space-y-3">
        <NInput
          v-model:value="themeJsonText"
          type="textarea"
          :rows="12"
          :readonly="themeJsonMode === 'export'"
          class="font-mono"
          :placeholder="$t('apps.leonStudio.importThemeJsonPlaceholder')"
        />
        <div class="flex justify-end gap-2">
          <template v-if="themeJsonMode === 'export'">
            <NButton size="small" @click="copyThemeJson">
              {{ $t('apps.leonStudio.copyJson') }}
            </NButton>
            <NButton size="small" type="primary" @click="downloadThemeJson">
              {{ $t('apps.leonStudio.downloadJson') }}
            </NButton>
          </template>
          <template v-else>
            <NButton size="small" @click="themeJsonModalShow = false">
              {{ $t('common.cancel') }}
            </NButton>
            <NButton size="small" type="primary" data-testid="confirm-import-theme-json" @click="confirmImportThemeJson">
              {{ $t('common.confirm') }}
            </NButton>
          </template>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.leon-visual-studio {
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 8px;
}

.leon-pinned-dock {
  flex-shrink: 0;
  z-index: 15;
}

.leon-visual-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  padding-bottom: 12px;
}

.leon-style-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

.leon-style-fieldset:disabled {
  opacity: 0.65;
  pointer-events: none;
}

.leon-sandbox-shell {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.28);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.leon-sandbox-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.leon-sandbox-inner {
  position: relative;
  z-index: 2;
  padding: 9px 11px;
}

.leon-sandbox-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(8px);
}

.leon-hover-demo-wrap {
  display: block;
}

.leon-hover-demo-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s ease, box-shadow 0.2s ease;
}

.leon-demo-icon-full {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1), filter 0.2s ease;
}

.leon-section-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 7px 2px 1px;
  scrollbar-width: none;
}

.leon-section-nav::-webkit-scrollbar {
  display: none;
}

.leon-section-nav-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(148, 163, 184, 0.06);
  color: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.leon-section-nav-pill:hover,
.leon-section-nav-pill:focus-visible {
  outline: none;
  border-color: var(--leon-ui-primary, #0ea5e9);
}

.leon-section-nav-pill.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 15%, transparent);
  color: var(--leon-ui-primary, #0ea5e9);
  font-weight: 600;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 8px;
}

.preset-option {
  display: flex;
  flex-direction: column;
  padding: 7px;
  border-radius: 10px;
  border: 1.5px solid rgba(148, 163, 184, 0.24);
  background: rgba(148, 163, 184, 0.04);
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
  min-width: 0;
}

.preset-option.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  box-shadow: 0 0 0 1px var(--leon-ui-primary, #0ea5e9);
}

.preset-swatch {
  position: relative;
  height: 52px;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preset-swatch-card {
  width: 100%;
  height: 32px;
  border-radius: 7px;
  border: 1px solid transparent;
  padding: 4px 7px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-swatch-dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  flex: 0 0 12px;
}

.preset-swatch-lines {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.preset-swatch-line {
  height: 4px;
  border-radius: 999px;
  width: 78%;
  opacity: 0.9;
}

.preset-swatch-line.short {
  width: 48%;
  opacity: 0.55;
}

.leon-selected-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--leon-ui-primary, #0ea5e9);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.leon-mod-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}

.leon-color-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.leon-color-dot:hover,
.leon-color-dot:focus-visible {
  outline: none;
  transform: scale(1.12);
}

.leon-color-dot.is-active {
  border-color: #ffffff;
  box-shadow: 0 0 0 2px var(--leon-ui-primary, #0ea5e9);
}

.leon-visual-tile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 10px;
  border: 1.5px solid rgba(148, 163, 184, 0.25);
  background: rgba(148, 163, 184, 0.05);
  color: inherit;
  cursor: pointer;
  width: 100%;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.leon-visual-tile.is-centered {
  flex-direction: column;
  justify-content: center;
  text-align: center;
  gap: 6px;
  padding: 10px 6px;
}

.leon-visual-tile:hover:not(:disabled),
.leon-visual-tile:focus-visible:not(:disabled) {
  outline: none;
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 7%, transparent);
}

.leon-visual-tile.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 13%, transparent);
  box-shadow: 0 0 0 1px var(--leon-ui-primary, #0ea5e9);
}

.leon-wireframe-info {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: 44px;
  height: 24px;
  padding: 3px 4px;
  border-radius: 5px;
  border: 1px solid currentColor;
  opacity: 0.78;
}

.leon-wireframe-info .wf-sq {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: currentColor;
  opacity: 0.55;
  flex-shrink: 0;
}

.leon-wireframe-info .wf-lines {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.leon-wireframe-info .wf-lines i {
  display: block;
  height: 3px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.65;
}

.leon-wireframe-info .wf-lines i.short {
  width: 65%;
  opacity: 0.4;
}

.leon-wireframe-small {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 30px;
  height: 28px;
  opacity: 0.78;
}

.leon-wireframe-small .wf-sq {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: currentColor;
  opacity: 0.55;
}

.leon-wireframe-small i {
  display: block;
  width: 20px;
  height: 3px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.55;
}

.leon-shape-glyph-lg {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 2px solid currentColor;
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 18%, transparent);
}

.leon-shape-glyph-lg.is-squircle {
  border-radius: 7px;
}

.leon-shape-glyph-lg.is-circle {
  border-radius: 999px;
}

.leon-shape-glyph-lg.is-sharp {
  border-radius: 0;
}

.leon-shape-glyph-lg.is-pill {
  border-radius: 11px;
}

.leon-tone-sample-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: linear-gradient(135deg, #0ea5e9, #ec4899);
}

.leon-tone-sample-icon.is-soft-mono {
  filter: grayscale(92%) opacity(0.84);
}

.leon-tone-sample-icon.is-high-contrast {
  filter: contrast(1.24) saturate(1.28);
}

.leon-tone-sample-icon.is-luminous {
  box-shadow: 0 3px 10px rgba(14, 165, 233, 0.58);
}

.leon-mod-chip {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.06);
  color: inherit;
  transition: all 0.15s ease;
  cursor: pointer;
}

.leon-mod-chip:hover:not(:disabled),
.leon-mod-chip:focus-visible:not(:disabled) {
  outline: none;
  border-color: var(--leon-ui-primary, #0ea5e9);
}

.leon-mod-chip.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 16%, transparent);
  color: var(--leon-ui-primary, #0ea5e9);
  font-weight: 600;
}

.leon-mod-chip:disabled,
.leon-swatch-tile:disabled,
.leon-visual-tile:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.leon-cursor-svg-box {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(148, 163, 184, 0.14);
  border: 1px solid rgba(148, 163, 184, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Interactive Hover FX Tiles — each tile previews its own effect directly on hover */
.leon-fx-live-tile {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 8px;
  border-radius: 10px;
  border: 1.5px solid rgba(148, 163, 184, 0.26);
  background: rgba(148, 163, 184, 0.05);
  color: inherit;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1), border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.leon-fx-live-tile:focus-visible {
  outline: none;
  border-color: var(--leon-ui-primary, #0ea5e9);
}

.leon-fx-live-tile.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 13%, transparent);
  box-shadow: 0 0 0 1px var(--leon-ui-primary, #0ea5e9);
}

.leon-fx-mini-card {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: 44px;
  height: 20px;
  padding: 0 5px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(148, 163, 184, 0.12);
}

.leon-fx-mini-card .fx-dot {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  background: var(--leon-ui-primary, #0ea5e9);
  display: block;
}

.leon-fx-mini-card .fx-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.45;
  display: block;
}

.fx-preview-spotlight::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  background: radial-gradient(120px circle at var(--leon-mx, 50%) var(--leon-my, 50%), color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 34%, transparent) 0%, transparent 72%);
  transition: opacity 0.18s ease;
}

.fx-preview-spotlight:hover::before {
  opacity: 1;
}

.fx-preview-tilt-3d:hover {
  transform: perspective(420px) rotateX(var(--leon-rx, 4deg)) rotateY(var(--leon-ry, -4deg)) translateY(-2px);
}

.fx-preview-shimmer::after {
  content: '';
  position: absolute;
  top: -20%;
  left: -120%;
  width: 55%;
  height: 140%;
  background: linear-gradient(112deg, transparent 0%, rgba(255, 255, 255, 0.35) 50%, transparent 100%);
  transform: skewX(-18deg);
  pointer-events: none;
}

.fx-preview-shimmer:hover::after {
  left: 145%;
  transition: left 0.55s ease;
}

.fx-preview-border-glow:hover {
  border-color: var(--leon-ui-primary, #0ea5e9);
  box-shadow: 0 0 12px color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 45%, transparent);
}

.fx-preview-magnetic:hover {
  transform: translate3d(var(--leon-tx, 2px), var(--leon-ty, -2px), 0);
}

.fx-preview-lift:hover {
  transform: translateY(-3px);
}

.fx-preview-bauhaus-pop:hover {
  transform: translate(-2px, -2px);
  border-color: var(--leon-ui-primary, #0ea5e9);
  box-shadow: 3px 3px 0 0 var(--leon-ui-primary, #0ea5e9);
}

.leon-swatch-tile {
  padding: 0;
  border-radius: 9px;
  overflow: hidden;
  border: 1.5px solid rgba(148, 163, 184, 0.25);
  background: transparent;
  cursor: pointer;
  transition: border-color 0.16s ease, transform 0.14s ease, box-shadow 0.16s ease;
  text-align: left;
}

.leon-swatch-tile:hover:not(:disabled),
.leon-swatch-tile:focus-visible:not(:disabled) {
  outline: none;
  border-color: var(--leon-ui-primary, #0ea5e9);
  transform: translateY(-1px);
}

.leon-swatch-tile.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  box-shadow: 0 0 0 1.5px var(--leon-ui-primary, #0ea5e9);
}

.leon-surface-swatch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid;
  border-radius: 7px;
  margin: 2px;
}

.leon-wall-swatch {
  position: relative;
  height: 46px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
  padding: 4px 6px;
}

.leon-wall-label {
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
  background: rgba(9, 9, 11, 0.64);
  padding: 1px 5px;
  border-radius: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
