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
  NSelect,
  NSlider,
  NSpin,
  NSwitch,
  NUpload,
  NUploadDragger,
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
  applyCardPointerFx,
  defaultModularStyleConfig,
  resetCardPointerFx,
} from '@/utils/studio/modularStyle'

const authStore = useAuthStore()
const panelState = usePanelState()
const studioStore = useStudioStore()
const ms = useMessage()
const switchStarterApp = inject<((target: string) => void) | undefined>('leonSwitchStarterApp', undefined)

const showWallpaperInput = ref(false)
const showPublicWallpapers = ref(false)
const showOwnWallpapers = ref(false)
const showFineTuneCardColors = ref(false)
const previewCollapsed = ref(false)
const activeSection = ref('presets')
const scrollPaneRef = ref<HTMLElement | null>(null)

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
const displayedWallpaperTone = computed(() => panelState.panelConfig.wallpaperTone ?? inferWallpaperToneFromSrc(panelState.panelConfig.backgroundImageSrc))

onMounted(() => {
  if (authStore.token && panelState.cloudConfigState === 'idle')
    panelState.updatePanelConfigByCloud()
  if (!studioStore.loaded)
    studioStore.loadFromCloud()
  studioStore.applyRuntimeModularStyle()
})

const presetList = computed(() => APPEARANCE_PRESET_IDS.map(id => APPEARANCE_PRESETS[id]))
const fontPresetList = computed(() => FONT_PRESET_IDS.map(id => FONT_PRESETS[id]))
const activeHomepageTheme = computed(() => resolveHomepageThemeVars(panelState.activePanelConfig))

const sectionNavItems = [
  { id: 'presets', labelKey: 'apps.leonStudio.modular.navPresets' },
  { id: 'wallpaper', labelKey: 'apps.leonStudio.modular.navWallpaper' },
  { id: 'card', labelKey: 'apps.leonStudio.modular.navCard' },
  { id: 'icon', labelKey: 'apps.leonStudio.modular.navIcon' },
  { id: 'font-cursor', labelKey: 'apps.leonStudio.modular.navFontCursor' },
  { id: 'hover-fx', labelKey: 'apps.leonStudio.modular.navHoverFx' },
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

const iconTypeOptions = [
  {
    label: t('apps.baseSettings.detailIcon'),
    value: PanelPanelConfigStyleEnum.info,
  },
  {
    label: t('apps.baseSettings.smallIcon'),
    value: PanelPanelConfigStyleEnum.icon,
  },
]

const iconBadgeOptions: Array<{ id: IconBadgeStyleId; labelKey: string }> = [
  { id: 'precision', labelKey: 'apps.baseSettings.iconBadgePrecision' },
  { id: 'default', labelKey: 'apps.baseSettings.iconBadgeDefault' },
  { id: 'bauhaus', labelKey: 'apps.baseSettings.iconBadgeBauhaus' },
  { id: 'glass', labelKey: 'apps.baseSettings.iconBadgeGlass' },
  { id: 'soft', labelKey: 'apps.baseSettings.iconBadgeSoft' },
  { id: 'outline', labelKey: 'apps.baseSettings.iconBadgeOutline' },
]

const wallpaperToneOptions = [
  {
    label: t('apps.baseSettings.wallpaperToneDark'),
    value: 'dark',
  },
  {
    label: t('apps.baseSettings.wallpaperToneLight'),
    value: 'light',
  },
]

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
  clearSaveTimer()
  skipNextAutoSave = true
  if (!panelState.applyAppearancePreset(presetId, { wallpaper: true, cardStyle: false, iconStyle: false })) {
    skipNextAutoSave = false
    return
  }
  uploadCloud()
}

function handleCardSurfaceSelect(surface: CardSurfacePresetId) {
  if (!isEditable.value)
    return
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
  uploadCloud()
}

function selectIconBadge(style: IconBadgeStyleId) {
  if (!isEditable.value)
    return
  panelState.panelConfig.iconBadgeStyle = style
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
  studioStore.config.modular.cardHoverEffect = effect
  studioStore.config.effects.hardShadowHover = effect === 'bauhaus-pop'
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectCursorPreset(cursor: CursorPresetId) {
  studioStore.config.modular.cursorPreset = cursor
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectFontPreset(font: FontPresetId) {
  studioStore.config.modular.fontPreset = font
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectIconShape(shape: IconShapeId) {
  studioStore.config.modular.iconShape = shape
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectIconTone(tone: IconToneFilterId) {
  studioStore.config.modular.iconToneFilter = tone
  if (isEditable.value)
    panelState.panelConfig.iconMonochrome = tone === 'soft-mono'
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function handleGridOverlayChange(val: boolean) {
  studioStore.config.effects.gridOverlay = val
  persistStudio()
}

function handleReduceMotionChange(val: boolean) {
  studioStore.config.effects.reduceMotion = val
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function resetAllVisualDefaults() {
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
  if (res.code === 0 && res.data?.imageUrl)
    panelState.setWallpaperSource(res.data.imageUrl)
  else
    ms.error(t('common.uploadFail'))
  return file
}

function usePublicWallpaper(src: string) {
  panelState.setWallpaperSource(src)
  showPublicWallpapers.value = false
}

function useOwnWallpaper(src: string) {
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
    <!-- 顶部常驻区：状态提示 + 跟随预览沙盒 + 模块快速跳转栏（滚轮下划时始终固定在顶部） -->
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
              <span>{{ $t('apps.leonStudio.modular.sandboxTitle') }}</span>
            </span>

            <div class="flex flex-wrap items-center gap-1.5">
              <NButton size="tiny" secondary :disabled="!isEditable" data-testid="theme-json-export" @click="openExportThemeJson">
                {{ $t('apps.leonStudio.exportThemeJson') }}
              </NButton>
              <NButton size="tiny" secondary :disabled="!isEditable" data-testid="theme-json-import" @click="openImportThemeJson">
                {{ $t('apps.leonStudio.importThemeJson') }}
              </NButton>
              <NPopconfirm @positive-click="resetAllVisualDefaults">
                <template #trigger>
                  <NButton size="tiny" secondary :loading="savingStudio" data-testid="modular-reset-btn">
                    {{ $t('apps.leonStudio.modular.resetModular') }}
                  </NButton>
                </template>
                {{ $t('apps.baseSettings.resetWarnText') }}
              </NPopconfirm>
              <NButton
                v-if="switchStarterApp"
                size="tiny"
                secondary
                @click="switchStarterApp?.('LeonStudio')"
              >
                <template #icon>
                  <SvgIcon icon="lucide:layout-grid" class="text-[12px]" />
                </template>
                {{ $t('apps.leonStudio.gotoLayoutStudio') }}
              </NButton>
              <NButton size="tiny" secondary @click="previewCollapsed = !previewCollapsed">
                <template #icon>
                  <SvgIcon :icon="previewCollapsed ? 'lucide:chevron-down' : 'lucide:chevron-up'" class="text-[12px]" />
                </template>
                {{ previewCollapsed ? $t('apps.leonStudio.modular.expandPreview') : $t('apps.leonStudio.modular.collapsePreview') }}
              </NButton>
            </div>
          </div>

          <div v-show="!previewCollapsed" class="mt-2.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div class="leon-hover-demo-wrap">
                <div
                  class="leon-hover-demo-card"
                  :style="sandboxCardStyle"
                  @pointermove="handleDemoPointerMove"
                  @pointerleave="handleDemoPointerLeave"
                >
                  <div
                    class="leon-icon-badge shrink-0"
                    :class="`leon-icon-badge-${activeHomepageTheme.iconBadgeStyle}`"
                    style="width: 42px; height: 42px;"
                  >
                    <div class="item-icon leon-demo-icon-inner" style="background: linear-gradient(135deg, #0ea5e9, #2563eb);">
                      <SvgIcon icon="lucide:container" class="text-[20px] text-white" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-semibold truncate">
                      {{ $t('apps.leonStudio.modular.sandboxCardDockerTitle') }}
                    </div>
                    <div class="text-[11px] truncate mt-0.5" :style="{ color: sandboxSecondaryTextColor }">
                      {{ $t('apps.leonStudio.modular.sandboxCardDockerDesc') }}
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
                  <div
                    class="leon-icon-badge shrink-0"
                    :class="`leon-icon-badge-${activeHomepageTheme.iconBadgeStyle}`"
                    style="width: 42px; height: 42px;"
                  >
                    <div class="item-icon leon-demo-icon-inner" style="background: linear-gradient(135deg, #8b5cf6, #ec4899);">
                      <SvgIcon icon="lucide:play-circle" class="text-[20px] text-white" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-semibold truncate">
                      {{ $t('apps.leonStudio.modular.sandboxCardMediaTitle') }}
                    </div>
                    <div class="text-[11px] truncate mt-0.5" :style="{ color: sandboxSecondaryTextColor }">
                      {{ $t('apps.leonStudio.modular.sandboxCardMediaDesc') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 模块锚点快速跳转条 -->
      <div class="leon-section-nav">
        <button
          v-for="nav in sectionNavItems"
          :key="nav.id"
          type="button"
          class="leon-section-nav-pill"
          :class="{ 'is-active': activeSection === nav.id }"
          @click="scrollToSection(nav.id)"
        >
          {{ $t(nav.labelKey) }}
        </button>
      </div>
    </div>

    <!-- 下方独立滚动内容区 -->
    <div ref="scrollPaneRef" class="leon-visual-scroll" @scroll.passive="handlePaneScroll">
      <fieldset :disabled="!isEditable" class="leon-style-fieldset space-y-3">
        <!-- 1. 整套主题快选 -->
        <NCard size="small" data-section="presets" data-testid="appearance-presets-card">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:palette" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.baseSettings.presets.title') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.baseSettings.presets.hint') }}
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-2.5">
            <span class="text-xs font-medium opacity-80">
              {{ $t('apps.baseSettings.presets.scopeLabel') }}
            </span>
            <NCheckbox v-model:checked="selectedScopes.wallpaper" :disabled="!isEditable" data-testid="preset-scope-wallpaper">
              {{ $t('apps.baseSettings.presets.scopeWallpaper') }}
            </NCheckbox>
            <NCheckbox v-model:checked="selectedScopes.cardStyle" :disabled="!isEditable" data-testid="preset-scope-cardStyle">
              {{ $t('apps.baseSettings.presets.scopeCardStyle') }}
            </NCheckbox>
            <NCheckbox v-model:checked="selectedScopes.iconStyle" :disabled="!isEditable" data-testid="preset-scope-iconStyle">
              {{ $t('apps.baseSettings.presets.scopeIconStyle') }}
            </NCheckbox>
          </div>

          <div class="preset-grid">
            <div
              v-for="preset in presetList"
              :key="preset.id"
              class="preset-option"
              :class="{ 'is-active': panelState.panelConfig.cardSurface === preset.id }"
              :data-testid="`preset-card-${preset.id}`"
            >
              <div class="preset-swatch" :style="{ background: preset.swatch.canvas }">
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

              <div class="preset-meta">
                <div class="font-semibold text-xs truncate">
                  {{ $t(preset.nameKey) }}
                </div>
                <div class="text-[11px] opacity-65 mt-0.5 line-clamp-2 leading-4">
                  {{ $t(preset.descKey) }}
                </div>
              </div>

              <div class="flex gap-1.5 mt-2">
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
                  {{ $t('apps.baseSettings.presets.applySelected') }}
                </NButton>
              </div>
            </div>
          </div>
        </NCard>

        <!-- 2. 画布与壁纸（合并内置壁纸 + 本地上传/图库 + 模糊/遮罩/色调 + 正交参考网格） -->
        <NCard size="small" data-section="wallpaper">
          <div class="leon-mod-header">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:wallpaper" class="text-[15px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.wallpaperTitle') }}</span>
            </div>
            <div class="leon-mod-desc">
              {{ $t('apps.leonStudio.modular.wallpaperDesc') }}
            </div>
          </div>

          <div class="text-xs font-semibold opacity-80 mb-1.5">
            {{ $t('apps.leonStudio.modular.builtinWallpapersLabel') }}
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
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
                <span class="leon-wall-label">{{ $t(preset.nameKey) }}</span>
              </div>
            </button>
          </div>

          <NUpload
            action="/api/file/uploadImg"
            :show-file-list="false"
            name="imgfile"
            :data="{ category: 'wallpaper' }"
            :headers="{
              token: authStore.token as string,
            }"
            :directory-dnd="true"
            @finish="handleUploadBackgroundFinish"
          >
            <NUploadDragger style="width: 100%;">
              <div
                class="h-[116px] w-full border bg-slate-100 dark:bg-zinc-800 flex justify-center items-center cursor-pointer rounded-[10px]"
                :style="{ background: `url(${panelState.panelConfig.backgroundImageSrc}) no-repeat`, backgroundSize: 'cover', backgroundPosition: 'center' }"
              >
                <div class="text-shadow text-white text-xs font-medium px-3 py-1 rounded bg-black/45">
                  {{ $t('apps.baseSettings.uploadOrDragText') }}
                </div>
              </div>
            </NUploadDragger>
          </NUpload>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <NButton size="small" :disabled="!isEditable" data-testid="open-own-wallpapers" @click="showOwnWallpapers = true">
              {{ $t('apps.ownGallery.open') }}
            </NButton>
            <NButton size="small" :disabled="!isEditable" data-testid="open-public-wallpapers" @click="showPublicWallpapers = true">
              {{ $t('apps.publicGallery.open') }}
            </NButton>
            <label class="flex items-center gap-1.5 text-xs ml-auto">
              <span>{{ $t('apps.baseSettings.customImageAddress') }}</span>
              <NSwitch v-model:value="showWallpaperInput" size="small" :disabled="!isEditable" />
            </label>
          </div>

          <div v-if="showWallpaperInput" class="mt-2">
            <NInput
              :value="panelState.panelConfig.backgroundImageSrc"
              type="text"
              size="small"
              clearable
              :disabled="!isEditable"
              data-testid="wallpaper-url-input"
              @update:value="handleWallpaperUrlInput"
            />
          </div>

          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.wallpaperTone') }}</span>
              <NSelect
                size="small"
                :value="displayedWallpaperTone"
                :options="wallpaperToneOptions"
                :disabled="!isEditable"
                data-testid="wallpaper-tone-select"
                @update:value="(val: 'dark' | 'light') => (panelState.panelConfig.wallpaperTone = val)"
              />
            </div>

            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-300/40 dark:border-zinc-700/60">
              <span class="text-xs font-medium">{{ $t('apps.leonStudio.fxGridOverlay') }}</span>
              <NSwitch :value="studioStore.config.effects.gridOverlay" size="small" @update:value="handleGridOverlayChange" />
            </div>

            <div class="flex items-center gap-2.5">
              <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.vague') }}</span>
              <NSlider v-model:value="panelState.panelConfig.backgroundBlur" class="flex-1" :step="1" :min="0" :max="20" />
              <span class="text-xs font-mono opacity-75 w-9 text-right">{{ panelState.panelConfig.backgroundBlur ?? 0 }}px</span>
            </div>

            <div class="flex items-center gap-2.5">
              <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.mask') }}</span>
              <NSlider v-model:value="panelState.panelConfig.backgroundMaskNumber" class="flex-1" :step="0.05" :min="0" :max="1" />
              <span class="text-xs font-mono opacity-75 w-9 text-right">{{ Math.round((panelState.panelConfig.backgroundMaskNumber ?? 0) * 100) }}%</span>
            </div>
          </div>

          <NModal v-model:show="showOwnWallpapers" preset="card" :title="$t('apps.ownGallery.title')" style="width: min(720px, 96vw);">
            <OwnGallery selectable @select="useOwnWallpaper" />
          </NModal>
          <NModal v-model:show="showPublicWallpapers" preset="card" :title="$t('apps.publicGallery.appName')" style="width: min(720px, 96vw);">
            <PublicGallery locked-category="wallpaper" selectable @select="usePublicWallpaper" />
          </NModal>
        </NCard>

        <!-- 3. 卡片材质与色彩 -->
        <NCard size="small" data-section="card" data-testid="card-style-settings">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:layout-grid" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.leonStudio.modular.cardSurfaceTitle') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.leonStudio.modular.cardSurfaceDesc') }}
              </div>
            </div>
            <NButton size="tiny" secondary @click="showFineTuneCardColors = !showFineTuneCardColors">
              {{ $t('apps.leonStudio.modular.advancedColorToggle') }}
            </NButton>
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

          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex items-center gap-2.5">
              <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.cardRadius') }}</span>
              <NSlider v-model:value="panelState.panelConfig.cardBorderRadius" class="flex-1" :step="1" :min="0" :max="24" />
              <span class="text-xs font-mono opacity-75 w-9 text-right">{{ panelState.panelConfig.cardBorderRadius ?? 14 }}px</span>
            </div>
            <div class="flex items-center gap-2.5">
              <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.cardBlur') }}</span>
              <NSlider v-model:value="panelState.panelConfig.cardBlur" class="flex-1" :step="2" :min="0" :max="24" />
              <span class="text-xs font-mono opacity-75 w-9 text-right">{{ panelState.panelConfig.cardBlur ?? 0 }}px</span>
            </div>
          </div>

          <div v-if="showFineTuneCardColors" class="mt-3 pt-3 border-t border-slate-300/40 dark:border-zinc-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div class="text-xs opacity-80 mb-1">
                {{ $t('apps.baseSettings.cardBackgroundColor') }}
              </div>
              <NColorPicker
                v-model:value="panelState.panelConfig.cardBackgroundColor"
                :show-alpha="true"
                size="small"
                :modes="['rgb', 'hex']"
                :swatches="[
                  '#14171f',
                  '#ffffff',
                  'rgba(15, 42, 74, 0.56)',
                  'rgba(17, 21, 28, 0.88)',
                ]"
              />
            </div>
            <div>
              <div class="text-xs opacity-80 mb-1">
                {{ $t('apps.baseSettings.cardAccentColor') }}
              </div>
              <NColorPicker
                v-model:value="panelState.panelConfig.cardAccentColor"
                :show-alpha="false"
                size="small"
                :modes="['hex']"
                :swatches="[
                  '#0ea5e9',
                  '#2563eb',
                  '#ff4f00',
                  '#eab308',
                  '#00c2a8',
                  '#8b5cf6',
                ]"
              />
            </div>
          </div>
        </NCard>

        <!-- 4. 图标外观（整合默认视图 + 容器 + 几何形状 + 色彩滤镜 + 文字色） -->
        <NCard size="small" data-section="icon">
          <div class="leon-mod-header">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:boxes" class="text-[15px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.iconTitle') }}</span>
            </div>
            <div class="leon-mod-desc">
              {{ $t('apps.leonStudio.modular.iconDesc') }}
            </div>
          </div>

          <div class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div class="flex items-center gap-2">
                <span class="text-xs opacity-80 shrink-0">{{ $t('common.style') }}</span>
                <NSelect v-model:value="panelState.panelConfig.iconStyle" size="small" :options="iconTypeOptions" data-testid="icon-style-select" />
              </div>
              <div v-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.info" class="flex items-center justify-between px-2.5 py-1 rounded-lg border border-slate-300/40 dark:border-zinc-700/60">
                <span class="text-xs">{{ $t('apps.baseSettings.hideDescription') }}</span>
                <NSwitch v-model:value="panelState.panelConfig.iconTextInfoHideDescription" size="small" />
              </div>
              <div v-else-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.icon" class="flex items-center justify-between px-2.5 py-1 rounded-lg border border-slate-300/40 dark:border-zinc-700/60">
                <span class="text-xs">{{ $t('apps.baseSettings.hideTitle') }}</span>
                <NSwitch v-model:value="panelState.panelConfig.iconTextIconHideTitle" size="small" />
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold mb-1.5 opacity-80">
                {{ $t('apps.leonStudio.modular.iconBadgeLabel') }}
              </div>
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
            </div>

            <div>
              <div class="text-xs font-semibold mb-1.5 opacity-80">
                {{ $t('apps.leonStudio.modular.iconShapeLabel') }}
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="shape in ICON_SHAPE_OPTIONS"
                  :key="shape.id"
                  type="button"
                  class="leon-mod-tile"
                  :class="{ 'is-active': studioStore.config.modular.iconShape === shape.id }"
                  :data-testid="`modular-shape-${shape.id}`"
                  @click="selectIconShape(shape.id)"
                >
                  <div class="flex items-center gap-2">
                    <span class="leon-shape-glyph" :class="`is-${shape.id}`" />
                    <span class="font-semibold text-xs truncate">{{ $t(shape.nameKey) }}</span>
                  </div>
                  <div class="text-[11px] opacity-65 mt-0.5 truncate">
                    {{ $t(shape.descKey) }}
                  </div>
                </button>
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold mb-1.5 opacity-80">
                {{ $t('apps.leonStudio.modular.iconToneLabel') }}
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="tone in ICON_TONE_OPTIONS"
                  :key="tone.id"
                  type="button"
                  class="leon-mod-tile"
                  :class="{ 'is-active': studioStore.config.modular.iconToneFilter === tone.id }"
                  :data-testid="`modular-tone-${tone.id}`"
                  @click="selectIconTone(tone.id)"
                >
                  <div class="font-semibold text-xs truncate">
                    {{ $t(tone.nameKey) }}
                  </div>
                  <div class="text-[11px] opacity-65 mt-0.5 line-clamp-2 leading-snug">
                    {{ $t(tone.descKey) }}
                  </div>
                </button>
              </div>
            </div>

            <div class="flex items-center gap-3 pt-1">
              <span class="text-xs opacity-80 shrink-0">{{ $t('common.textColor') }}</span>
              <NColorPicker
                v-model:value="panelState.panelConfig.iconTextColor"
                class="max-w-[220px]"
                :show-alpha="false"
                size="small"
                :modes="['hex']"
                :swatches="[
                  '#f8fafc',
                  '#ffffff',
                  '#0f172a',
                  '#000000',
                  '#38bdf8',
                ]"
              />
            </div>
          </div>
        </NCard>

        <!-- 5. 字体排版与零延迟硬件级鼠标指针 -->
        <NCard size="small" data-section="font-cursor">
          <div class="leon-mod-header">
            <div class="leon-mod-title">
              <SvgIcon icon="lucide:book-open" class="text-[15px] opacity-80" />
              <span>{{ $t('apps.leonStudio.modular.fontTitle') }}</span>
            </div>
            <div class="leon-mod-desc">
              {{ $t('apps.leonStudio.modular.fontDesc') }}
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            <button
              v-for="font in fontPresetList"
              :key="font.id"
              type="button"
              class="leon-mod-tile"
              :class="{ 'is-active': studioStore.config.modular.fontPreset === font.id }"
              :data-testid="`modular-font-${font.id}`"
              @click="selectFontPreset(font.id)"
            >
              <div
                class="text-sm font-semibold truncate"
                :style="{ fontFamily: font.fontFamily, letterSpacing: font.letterSpacing }"
              >
                {{ font.sample }}
              </div>
              <div class="text-[11px] opacity-65 mt-1 truncate">
                {{ $t(font.nameKey) }}
              </div>
            </button>
          </div>

          <div class="pt-3 border-t border-slate-300/40 dark:border-zinc-700/60">
            <div class="leon-mod-header">
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:compass" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.leonStudio.modular.cursorTitle') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.leonStudio.modular.cursorDesc') }}
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="opt in CURSOR_PRESET_OPTIONS"
                :key="opt.id"
                type="button"
                class="leon-mod-tile"
                :class="{ 'is-active': studioStore.config.modular.cursorPreset === opt.id }"
                :data-testid="`modular-cursor-${opt.id}`"
                @click="selectCursorPreset(opt.id)"
              >
                <div class="flex items-center gap-2">
                  <span class="leon-cursor-svg-box">
                    <img :src="opt.previewSvgUri" width="20" height="20" alt="" class="block select-none">
                  </span>
                  <span class="font-semibold text-xs truncate">{{ $t(opt.nameKey) }}</span>
                </div>
                <div class="text-[11px] opacity-65 mt-1 line-clamp-2 leading-snug">
                  {{ $t(opt.descKey) }}
                </div>
              </button>
            </div>
          </div>
        </NCard>

        <!-- 6. 指针划过标签动效 + 全局零动效开关 -->
        <NCard size="small" data-section="hover-fx">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div>
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:sparkles" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.leonStudio.modular.hoverFxTitle') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.leonStudio.modular.hoverFxDesc') }}
              </div>
            </div>
            <label class="flex items-center gap-2 text-xs font-medium">
              <span>{{ $t('apps.leonStudio.fxReduceMotion') }}</span>
              <NSwitch :value="studioStore.config.effects.reduceMotion" size="small" @update:value="handleReduceMotionChange" />
            </label>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              v-for="opt in CARD_HOVER_EFFECT_OPTIONS"
              :key="opt.id"
              type="button"
              class="leon-mod-tile"
              :class="{ 'is-active': studioStore.config.modular.cardHoverEffect === opt.id }"
              :data-testid="`modular-hover-${opt.id}`"
              @click="selectHoverFx(opt.id)"
            >
              <div class="font-semibold text-xs truncate">
                {{ $t(opt.nameKey) }}
              </div>
              <div class="text-[11px] opacity-65 mt-0.5 line-clamp-2 leading-snug">
                {{ $t(opt.descKey) }}
              </div>
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

.text-shadow {
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65);
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
  padding: 10px 12px;
}

.leon-sandbox-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
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
  padding: 9px 12px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s ease, box-shadow 0.2s ease;
}

.leon-demo-icon-inner {
  width: 32px;
  height: 32px;
  border-radius: 9px;
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
  padding: 8px 2px 2px;
  scrollbar-width: none;
}

.leon-section-nav::-webkit-scrollbar {
  display: none;
}

.leon-section-nav-pill {
  flex-shrink: 0;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(148, 163, 184, 0.06);
  color: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.leon-section-nav-pill:hover {
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
  grid-template-columns: repeat(auto-fit, minmax(156px, 1fr));
  gap: 8px;
}

.preset-option {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.05);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  min-width: 0;
}

.preset-option.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  box-shadow: 0 0 0 1px var(--leon-ui-primary, #0ea5e9);
}

.preset-swatch {
  height: 50px;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.preset-swatch-card {
  width: 100%;
  height: 34px;
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 5px 7px;
  display: flex;
  align-items: center;
  gap: 7px;
}

.preset-swatch-dot {
  width: 13px;
  height: 13px;
  border-radius: 4px;
  flex: 0 0 13px;
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
  width: 50%;
  opacity: 0.55;
}

.preset-meta {
  min-width: 0;
}

.leon-mod-header {
  margin-bottom: 10px;
}

.leon-mod-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}

.leon-mod-desc {
  font-size: 11px;
  opacity: 0.68;
  margin-top: 2px;
}

.leon-mod-tile {
  text-align: left;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(148, 163, 184, 0.05);
  transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
  cursor: pointer;
  width: 100%;
}

.leon-mod-tile:hover {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 7%, transparent);
}

.leon-mod-tile.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 12%, transparent);
  box-shadow: 0 0 0 1px var(--leon-ui-primary, #0ea5e9);
}

.leon-mod-chip {
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.06);
  transition: all 0.15s ease;
  cursor: pointer;
}

.leon-mod-chip:hover:not(:disabled) {
  border-color: var(--leon-ui-primary, #0ea5e9);
}

.leon-mod-chip.is-active {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 16%, transparent);
  font-weight: 600;
}

.leon-mod-chip:disabled,
.leon-swatch-tile:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.leon-shape-glyph {
  display: inline-block;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 1.5px solid currentColor;
  opacity: 0.8;
}

.leon-shape-glyph.is-squircle {
  border-radius: 4px;
}

.leon-shape-glyph.is-circle {
  border-radius: 999px;
}

.leon-shape-glyph.is-sharp {
  border-radius: 0;
}

.leon-shape-glyph.is-pill {
  border-radius: 6px;
}

.leon-cursor-svg-box {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 7px;
  background: rgba(15, 23, 42, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.leon-swatch-tile:hover:not(:disabled) {
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
  height: 44px;
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
