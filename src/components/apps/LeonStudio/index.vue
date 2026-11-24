<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSlider,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  useMessage,
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useAuthStore, usePanelState, useStudioStore } from '@/store'
import {
  APPEARANCE_PRESETS,
  APPEARANCE_PRESET_IDS,
  type AppearancePresetId,
  type IconBadgeStyleId,
  type PanelLayoutMode,
  applyThemePackJson,
  exportThemePackJson,
  resolveHomepageThemeVars,
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
import {
  type DesktopWidgetItem,
  type DesktopWidgetType,
  createDesktopWidget,
  sanitizeWidgetUrl,
} from '@/utils/studio/studioConfig'
import {
  type CustomCodeSnippet,
  type CustomSnippetType,
} from '@/utils/studio/customCode'
import { t } from '@/locales'

const ms = useMessage()
const authStore = useAuthStore()
const panelState = usePanelState()
const studioStore = useStudioStore()

const isAdmin = computed(() => authStore.userInfo?.role === 1)
const isEditable = computed(() => panelState.isCloudConfigReady)
const presetList = computed(() => APPEARANCE_PRESET_IDS.map(id => APPEARANCE_PRESETS[id]))
const fontPresetList = computed(() => FONT_PRESET_IDS.map(id => FONT_PRESETS[id]))

const activeHomepageTheme = computed(() => resolveHomepageThemeVars(panelState.activePanelConfig))

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
  const maskPct = Math.max(0, Math.min(100, Number(cfg.backgroundMaskNumber) || 0))
  const isLight = activeHomepageTheme.value.isLightCanvas
  return {
    backdropFilter: blur > 0 ? `blur(${Math.min(12, blur)}px)` : 'none',
    backgroundColor: maskPct > 0
      ? (isLight ? `rgba(255, 255, 255, ${(maskPct / 100) * 0.45})` : `rgba(0, 0, 0, ${(maskPct / 100) * 0.65})`)
      : 'transparent',
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

const layoutModeOptions: Array<{ label: string; value: PanelLayoutMode }> = [
  { label: t('apps.leonStudio.layoutStandard'), value: 'standard' },
  { label: t('apps.leonStudio.layoutCompact'), value: 'compact' },
  { label: t('apps.leonStudio.layoutDock'), value: 'dock' },
]

// Theme JSON export / import modal
const themeJsonModalShow = ref(false)
const themeJsonMode = ref<'export' | 'import'>('export')
const themeJsonText = ref('')
const themePackName = ref('Leon Bauhaus Theme')

// Custom CSS/JS snippet editor
const newSnippetName = ref('')
const newSnippetType = ref<CustomSnippetType>('css')
const newSnippetCode = ref('')
const savingCode = ref(false)
const savingStudio = ref(false)

onMounted(() => {
  if (!studioStore.loaded)
    studioStore.loadFromCloud()
  studioStore.applyRuntimeModularStyle()
})

function handleDemoPointerMove(event: PointerEvent) {
  applyCardPointerFx(event, studioStore.config.modular.cardHoverEffect, studioStore.config.effects.reduceMotion)
}

function handleDemoPointerLeave(event: PointerEvent) {
  resetCardPointerFx(event)
}

function savePanelStyleNow() {
  if (!isEditable.value)
    return
  panelState.recordState()
  panelState.savePanelConfigToCloud().then((res) => {
    if (res.ok)
      ms.success(t('common.saveSuccess'))
    else if (res.msg)
      ms.error(res.msg)
  })
}

function selectHoverFx(effect: CardHoverEffectId) {
  studioStore.config.modular.cardHoverEffect = effect
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
  studioStore.applyRuntimeModularStyle()
  persistStudio()
}

function selectIconBadge(style: IconBadgeStyleId) {
  if (!isEditable.value)
    return
  panelState.panelConfig.iconBadgeStyle = style
  savePanelStyleNow()
}

function applyWallpaperOnly(presetId: AppearancePresetId) {
  if (!isEditable.value)
    return
  if (!panelState.applyAppearancePreset(presetId, { wallpaper: true, cardStyle: false, iconStyle: false }))
    return
  panelState.savePanelConfigToCloud().then((res) => {
    if (res.ok)
      ms.success(t('common.saveSuccess'))
    else if (res.msg)
      ms.error(res.msg)
  })
}

function applyCardSurfaceOnly(presetId: AppearancePresetId) {
  if (!isEditable.value)
    return
  if (!panelState.applyAppearancePreset(presetId, { wallpaper: false, cardStyle: true, iconStyle: false }))
    return
  panelState.savePanelConfigToCloud().then((res) => {
    if (res.ok)
      ms.success(t('common.saveSuccess'))
    else if (res.msg)
      ms.error(res.msg)
  })
}

function resetModularDefaults() {
  studioStore.config.modular = defaultModularStyleConfig()
  studioStore.applyRuntimeModularStyle()
  persistStudio(t('apps.leonStudio.modular.resetModularDone'))
}

function handleLayoutModeChange(mode: PanelLayoutMode) {
  if (!isEditable.value)
    return
  panelState.panelConfig.layoutMode = mode
  panelState.recordState()
  panelState.savePanelConfigToCloud().then((res) => {
    if (res.ok)
      ms.success(t('common.saveSuccess'))
  })
}

function previewTheme(presetId: AppearancePresetId) {
  if (!isEditable.value)
    return
  panelState.startAppearancePreview(presetId, { wallpaper: true, cardStyle: true, iconStyle: true })
}

function applyTheme(presetId: AppearancePresetId) {
  if (!isEditable.value)
    return
  if (!panelState.applyAppearancePreset(presetId, { wallpaper: true, cardStyle: true, iconStyle: true }))
    return
  panelState.savePanelConfigToCloud().then((res) => {
    if (res.ok)
      ms.success(t('common.saveSuccess'))
    else if (res.msg)
      ms.error(res.msg)
  })
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
  panelState.panelConfig = result.config
  panelState.recordState()
  panelState.savePanelConfigToCloud().then((res) => {
    if (res.ok) {
      themeJsonModalShow.value = false
      ms.success(t('apps.leonStudio.themeImported', { name: result.name }))
    }
    else if (res.msg) {
      ms.error(res.msg)
    }
  })
}

async function persistStudio(successMessage?: unknown) {
  savingStudio.value = true
  try {
    const res = await studioStore.saveStudioConfig()
    if (res.code === 0)
      ms.success((typeof successMessage === 'string' && successMessage) ? successMessage : t('common.saveSuccess'))
    else
      ms.error(res.msg || t('common.failed'))
  }
  finally {
    savingStudio.value = false
  }
}

function addWidget(type: DesktopWidgetType) {
  studioStore.config.widgets.push(createDesktopWidget(type))
  persistStudio()
}

function moveWidget(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= studioStore.config.widgets.length)
    return
  const list = [...studioStore.config.widgets]
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  studioStore.config.widgets = list
  persistStudio()
}

function removeWidget(index: number) {
  studioStore.config.widgets.splice(index, 1)
  persistStudio()
}

function validateIframeField(widget: DesktopWidgetItem) {
  if (widget.type === 'iframe' && widget.url && !sanitizeWidgetUrl(widget.url))
    ms.warning(t('apps.leonStudio.widgetIframeInvalidUrl'))
}

async function persistCustomCode() {
  if (!isAdmin.value)
    return
  savingCode.value = true
  try {
    const res = await studioStore.saveCustomCode(studioStore.customCode.snippets)
    if (res.code === 0)
      ms.success(t('common.saveSuccess'))
    else
      ms.error(res.msg || t('common.failed'))
  }
  finally {
    savingCode.value = false
  }
}

function addCustomSnippet() {
  if (!isAdmin.value)
    return
  if (!newSnippetName.value.trim() || !newSnippetCode.value.trim()) {
    ms.warning(t('apps.leonStudio.snippetFieldsRequired'))
    return
  }
  const item: CustomCodeSnippet = {
    id: `${newSnippetType.value}-${Date.now()}`,
    name: newSnippetName.value.trim(),
    type: newSnippetType.value,
    enabled: true,
    code: newSnippetCode.value,
    updatedAt: Date.now(),
  }
  studioStore.customCode.snippets.push(item)
  newSnippetName.value = ''
  newSnippetCode.value = ''
  persistCustomCode()
}

function removeCustomSnippet(index: number) {
  if (!isAdmin.value)
    return
  studioStore.customCode.snippets.splice(index, 1)
  persistCustomCode()
}
</script>

<template>
  <div class="leon-studio-root p-2 space-y-3">
    <NAlert v-if="studioStore.safeMode" type="warning" :bordered="true" data-testid="studio-safe-mode-alert">
      {{ $t('apps.leonStudio.safeModeActiveNotice') }}
    </NAlert>

    <NTabs type="line" animated default-value="modular">
      <!-- TAB 0: 模块化设计工坊 -->
      <NTabPane name="modular" :tab="$t('apps.leonStudio.tabModular')">
        <div class="space-y-4">
          <!-- 实时模块化交互预览沙盒 -->
          <div class="leon-sandbox-shell" :style="sandboxCanvasStyle" data-testid="modular-live-sandbox">
            <div class="leon-sandbox-mask" :style="sandboxMaskStyle" />
            <div class="leon-sandbox-inner">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <span
                    class="leon-sandbox-pill"
                    :style="{
                      background: activeHomepageTheme.controlBackground,
                      color: activeHomepageTheme.controlTextColor,
                    }"
                  >
                    <SvgIcon icon="lucide:sparkles" class="text-[13px]" />
                    <span>{{ $t('apps.leonStudio.modular.sandboxTitle') }}</span>
                  </span>
                </div>
                <NButton size="tiny" secondary :loading="savingStudio" data-testid="modular-reset-btn" @click="resetModularDefaults">
                  <template #icon>
                    <SvgIcon icon="lucide:refresh-cw" class="text-[12px]" />
                  </template>
                  {{ $t('apps.leonStudio.modular.resetModular') }}
                </NButton>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      style="width: 46px; height: 46px;"
                    >
                      <div class="item-icon leon-demo-icon-inner" style="background: linear-gradient(135deg, #0ea5e9, #2563eb);">
                        <SvgIcon icon="lucide:container" class="text-[22px] text-white" />
                      </div>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-semibold truncate">
                        {{ $t('apps.leonStudio.modular.sandboxCardDockerTitle') }}
                      </div>
                      <div class="text-xs truncate mt-0.5" :style="{ color: sandboxSecondaryTextColor }">
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
                      style="width: 46px; height: 46px;"
                    >
                      <div class="item-icon leon-demo-icon-inner" style="background: linear-gradient(135deg, #8b5cf6, #ec4899);">
                        <SvgIcon icon="lucide:play-circle" class="text-[22px] text-white" />
                      </div>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-semibold truncate">
                        {{ $t('apps.leonStudio.modular.sandboxCardMediaTitle') }}
                      </div>
                      <div class="text-xs truncate mt-0.5" :style="{ color: sandboxSecondaryTextColor }">
                        {{ $t('apps.leonStudio.modular.sandboxCardMediaDesc') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="mt-2.5 text-[11px] opacity-85"
                :style="{ color: activeHomepageTheme.isLightCanvas ? '#334155' : '#cbd5e1' }"
              >
                {{ $t('apps.leonStudio.modular.sandboxHint') }}
              </div>
            </div>
          </div>

          <!-- 模块 1：指针划过标签动效 -->
          <NCard size="small">
            <div class="leon-mod-header">
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:sparkles" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.leonStudio.modular.hoverFxTitle') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.leonStudio.modular.hoverFxDesc') }}
              </div>
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

          <!-- 模块 2：鼠标指针风格 -->
          <NCard size="small">
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
                <div class="flex items-center justify-between gap-1.5">
                  <span class="font-semibold text-xs truncate">{{ $t(opt.nameKey) }}</span>
                  <span class="leon-cursor-preview-dot" :class="`is-${opt.id}`" />
                </div>
                <div class="text-[11px] opacity-65 mt-0.5 line-clamp-2 leading-snug">
                  {{ $t(opt.descKey) }}
                </div>
              </button>
            </div>
          </NCard>

          <!-- 模块 3：字体排版模块 -->
          <NCard size="small">
            <div class="leon-mod-header">
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:book-open" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.leonStudio.modular.fontTitle') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.leonStudio.modular.fontDesc') }}
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
          </NCard>

          <!-- 模块 4：图标模块（容器 · 形状 · 色彩滤镜） -->
          <NCard size="small">
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
              <!-- 4.1 图标容器 -->
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

              <!-- 4.2 图标形状 -->
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

              <!-- 4.3 图标色彩滤镜 -->
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
            </div>
          </NCard>

          <!-- 模块 5：标签 / 卡片材质模块 -->
          <NCard size="small">
            <div class="leon-mod-header">
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:layout-grid" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.leonStudio.modular.cardSurfaceTitle') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.leonStudio.modular.cardSurfaceDesc') }}
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
                @click="applyCardSurfaceOnly(preset.id)"
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
            <div class="mt-3 flex items-center gap-3">
              <span class="text-xs opacity-80 shrink-0">{{ $t('apps.leonStudio.modular.cardRadiusLabel') }}</span>
              <NSlider
                v-model:value="panelState.panelConfig.cardBorderRadius"
                :min="0"
                :max="24"
                :step="1"
                :disabled="!isEditable"
                class="flex-1"
                @dragend="savePanelStyleNow"
              />
              <span class="text-xs font-mono opacity-75 w-10 text-right">{{ panelState.panelConfig.cardBorderRadius ?? 14 }}px</span>
            </div>
          </NCard>

          <!-- 模块 6：墙纸模块 -->
          <NCard size="small">
            <div class="leon-mod-header">
              <div class="leon-mod-title">
                <SvgIcon icon="lucide:wallpaper" class="text-[15px] opacity-80" />
                <span>{{ $t('apps.leonStudio.modular.wallpaperTitle') }}</span>
              </div>
              <div class="leon-mod-desc">
                {{ $t('apps.leonStudio.modular.wallpaperDesc') }}
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
                  <span class="leon-wall-label">{{ $t(preset.nameKey) }}</span>
                </div>
              </button>
            </div>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex items-center gap-2.5">
                <span class="text-xs opacity-80 shrink-0">{{ $t('apps.leonStudio.modular.wallpaperBlurLabel') }}</span>
                <NSlider
                  v-model:value="panelState.panelConfig.backgroundBlur"
                  :min="0"
                  :max="20"
                  :step="1"
                  :disabled="!isEditable"
                  class="flex-1"
                  @dragend="savePanelStyleNow"
                />
                <span class="text-xs font-mono opacity-75 w-9 text-right">{{ panelState.panelConfig.backgroundBlur ?? 0 }}px</span>
              </div>
              <div class="flex items-center gap-2.5">
                <span class="text-xs opacity-80 shrink-0">{{ $t('apps.leonStudio.modular.wallpaperMaskLabel') }}</span>
                <NSlider
                  v-model:value="panelState.panelConfig.backgroundMaskNumber"
                  :min="0"
                  :max="100"
                  :step="5"
                  :disabled="!isEditable"
                  class="flex-1"
                  @dragend="savePanelStyleNow"
                />
                <span class="text-xs font-mono opacity-75 w-9 text-right">{{ panelState.panelConfig.backgroundMaskNumber ?? 0 }}%</span>
              </div>
            </div>
          </NCard>
        </div>
      </NTabPane>

      <!-- TAB 1: 主题包与布局 -->
      <NTabPane name="themes" :tab="$t('apps.leonStudio.tabThemes')">
        <NCard size="small" class="mb-3">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <div class="font-bold text-sm">
                {{ $t('apps.leonStudio.layoutModeTitle') }}
              </div>
              <div class="text-xs opacity-70">
                {{ $t('apps.leonStudio.layoutModeDesc') }}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <NButton size="small" :disabled="!isEditable" data-testid="theme-json-export" @click="openExportThemeJson">
                {{ $t('apps.leonStudio.exportThemeJson') }}
              </NButton>
              <NButton size="small" type="primary" :disabled="!isEditable" data-testid="theme-json-import" @click="openImportThemeJson">
                {{ $t('apps.leonStudio.importThemeJson') }}
              </NButton>
            </div>
          </div>

          <NSelect
            :value="panelState.panelConfig.layoutMode || 'standard'"
            :options="layoutModeOptions"
            :disabled="!isEditable"
            data-testid="layout-mode-select"
            @update:value="handleLayoutModeChange"
          />
        </NCard>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="preset in presetList"
            :key="preset.id"
            class="leon-studio-preset-card"
            :class="{ 'is-selected': panelState.panelConfig.cardSurface === preset.id }"
          >
            <div class="leon-studio-preset-swatch" :style="{ background: preset.swatch.canvas }">
              <div
                class="leon-studio-mini-card"
                :style="{
                  background: preset.swatch.card,
                  borderColor: preset.swatch.border,
                  color: preset.swatch.text,
                }"
              >
                <span class="w-3 h-3 inline-block shrink-0" :style="{ background: preset.swatch.accent }" />
                <span class="text-xs font-bold truncate">{{ $t(preset.nameKey) }}</span>
              </div>
            </div>
            <div class="p-3 space-y-2">
              <div class="text-xs opacity-75">
                {{ $t(preset.descKey) }}
              </div>
              <div class="flex gap-2">
                <NButton size="tiny" :disabled="!isEditable" @click="previewTheme(preset.id)">
                  {{ $t('apps.baseSettings.presets.preview') }}
                </NButton>
                <NButton size="tiny" type="primary" :disabled="!isEditable" @click="applyTheme(preset.id)">
                  {{ $t('apps.baseSettings.presets.applySelected') }}
                </NButton>
              </div>
            </div>
          </div>
        </div>
      </NTabPane>

      <!-- TAB 2: 视觉特效开关 -->
      <NTabPane name="effects" :tab="$t('apps.leonStudio.tabEffects')">
        <NCard size="small" class="space-y-3">
          <div class="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div class="font-semibold text-sm">
                {{ $t('apps.leonStudio.fxGridOverlay') }}
              </div>
              <div class="text-xs opacity-70">
                {{ $t('apps.leonStudio.fxGridOverlayDesc') }}
              </div>
            </div>
            <NSwitch v-model:value="studioStore.config.effects.gridOverlay" @update:value="persistStudio" />
          </div>

          <div class="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div class="font-semibold text-sm">
                {{ $t('apps.leonStudio.fxHardShadow') }}
              </div>
              <div class="text-xs opacity-70">
                {{ $t('apps.leonStudio.fxHardShadowDesc') }}
              </div>
            </div>
            <NSwitch v-model:value="studioStore.config.effects.hardShadowHover" @update:value="persistStudio" />
          </div>

          <div class="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div class="font-semibold text-sm">
                {{ $t('apps.leonStudio.fxReduceMotion') }}
              </div>
              <div class="text-xs opacity-70">
                {{ $t('apps.leonStudio.fxReduceMotionDesc') }}
              </div>
            </div>
            <NSwitch v-model:value="studioStore.config.effects.reduceMotion" @update:value="persistStudio" />
          </div>

          <div class="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div class="font-semibold text-sm">
                {{ $t('apps.leonStudio.fxEnhancedClock') }}
              </div>
              <div class="text-xs opacity-70">
                {{ $t('apps.leonStudio.fxEnhancedClockDesc') }}
              </div>
            </div>
            <NSwitch v-model:value="studioStore.config.effects.enhancedClock" @update:value="persistStudio" />
          </div>

          <div v-if="studioStore.config.effects.enhancedClock" class="pt-2 space-y-2">
            <div class="text-xs font-semibold">
              {{ $t('apps.leonStudio.fxClockGreeting') }}
            </div>
            <div class="flex gap-2">
              <NInput
                v-model:value="studioStore.config.effects.clockGreeting"
                size="small"
                :placeholder="$t('apps.leonStudio.fxClockGreetingPlaceholder')"
              />
              <NButton size="small" type="primary" :loading="savingStudio" @click="persistStudio">
                {{ $t('common.save') }}
              </NButton>
            </div>
          </div>
        </NCard>
      </NTabPane>

      <!-- TAB 3: 桌面小组件 -->
      <NTabPane name="widgets" :tab="$t('apps.leonStudio.tabWidgets')">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span class="text-xs opacity-75">{{ $t('apps.leonStudio.widgetsHint') }}</span>
          <NSpace size="small">
            <NButton size="small" @click="addWidget('clock')">
              + {{ $t('apps.leonStudio.addClockWidget') }}
            </NButton>
            <NButton size="small" @click="addWidget('memo')">
              + {{ $t('apps.leonStudio.addMemoWidget') }}
            </NButton>
            <NButton size="small" type="primary" @click="addWidget('iframe')">
              + {{ $t('apps.leonStudio.addIframeWidget') }}
            </NButton>
          </NSpace>
        </div>

        <div v-if="studioStore.config.widgets.length === 0" class="p-6 text-center text-xs opacity-65 border border-dashed">
          {{ $t('apps.leonStudio.widgetsEmpty') }}
        </div>

        <div class="space-y-3">
          <NCard v-for="(widget, idx) in studioStore.config.widgets" :key="widget.id" size="small">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <NTag size="small" type="info">
                  {{ widget.type.toUpperCase() }}
                </NTag>
                <NInput v-model:value="widget.title" size="tiny" style="width: 160px;" :placeholder="$t('common.title')" />
                <NSwitch v-model:value="widget.enabled" size="small" />
              </div>
              <div class="flex items-center gap-1">
                <NButton size="tiny" :disabled="idx === 0" @click="moveWidget(idx, -1)">
                  ↑
                </NButton>
                <NButton size="tiny" :disabled="idx === studioStore.config.widgets.length - 1" @click="moveWidget(idx, 1)">
                  ↓
                </NButton>
                <NButton size="tiny" @click="widget.colSpan = widget.colSpan === 2 ? 1 : 2">
                  {{ widget.colSpan === 2 ? '2x' : '1x' }}
                </NButton>
                <NPopconfirm @positive-click="removeWidget(idx)">
                  <template #trigger>
                    <NButton size="tiny" type="error" secondary>
                      {{ $t('common.delete') }}
                    </NButton>
                  </template>
                  {{ $t('common.deleteConfirm') }}
                </NPopconfirm>
              </div>
            </div>

            <div v-if="widget.type === 'memo'" class="mt-2">
              <NInput v-model:value="widget.content" type="textarea" :rows="3" :placeholder="$t('apps.leonStudio.widgetMemoPlaceholder')" />
            </div>

            <div v-else-if="widget.type === 'iframe'" class="mt-2 flex flex-wrap gap-2 items-center">
              <NInput
                v-model:value="widget.url"
                size="small"
                class="flex-1 min-w-[200px]"
                placeholder="https://... 或 /custom/widget.html"
                @blur="validateIframeField(widget)"
              />
              <NInputNumber v-model:value="widget.height" size="small" :min="120" :max="720" :step="20" style="width: 110px;">
                <template #suffix>
                  px
                </template>
              </NInputNumber>
            </div>

            <div v-else-if="widget.type === 'clock'" class="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label class="flex items-center gap-1.5">
                <NSwitch v-model:value="widget.showSeconds" size="small" />
                <span>{{ $t('apps.baseSettings.clockSecondShow') }}</span>
              </label>
              <label class="flex items-center gap-1.5">
                <NSwitch v-model:value="widget.use24Hour" size="small" />
                <span>24H</span>
              </label>
              <NInput v-model:value="widget.subtitle" size="tiny" style="width: 180px;" :placeholder="$t('apps.leonStudio.fxClockGreetingPlaceholder')" />
            </div>
          </NCard>

          <div v-if="studioStore.config.widgets.length > 0" class="flex justify-end">
            <NButton type="primary" size="small" :loading="savingStudio" @click="persistStudio">
              {{ $t('common.save') }}
            </NButton>
          </div>
        </div>
      </NTabPane>

      <!-- TAB 4: 管理员自定义 CSS / JS 片段 -->
      <NTabPane v-if="isAdmin" name="customCode" :tab="$t('apps.leonStudio.tabCustomCode')">
        <NAlert type="info" :bordered="true" class="mb-3">
          {{ $t('apps.leonStudio.customCodeNotice') }}
        </NAlert>

        <NCard size="small" class="mb-3">
          <div class="font-bold text-xs mb-2">
            {{ $t('apps.leonStudio.addSnippetTitle') }}
          </div>
          <div class="flex flex-wrap gap-2 mb-2">
            <NInput v-model:value="newSnippetName" size="small" style="flex: 1; min-width: 160px;" :placeholder="$t('apps.leonStudio.snippetNamePlaceholder')" />
            <NSelect
              v-model:value="newSnippetType"
              size="small"
              style="width: 110px;"
              :options="[{ label: 'CSS', value: 'css' }, { label: 'JS', value: 'js' }]"
            />
          </div>
          <NInput
            v-model:value="newSnippetCode"
            type="textarea"
            :rows="5"
            class="font-mono"
            :placeholder="newSnippetType === 'css' ? '/* Custom CSS */' : '// Custom JS'"
          />
          <div class="flex justify-end mt-2">
            <NButton type="primary" size="small" :loading="savingCode" @click="addCustomSnippet">
              {{ $t('common.add') }}
            </NButton>
          </div>
        </NCard>

        <div class="space-y-3">
          <NCard v-for="(snippet, idx) in studioStore.customCode.snippets" :key="snippet.id" size="small">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <NTag size="small" :type="snippet.type === 'css' ? 'info' : 'warning'">
                  {{ snippet.type.toUpperCase() }}
                </NTag>
                <NInput v-model:value="snippet.name" size="tiny" style="width: 180px;" />
                <NSwitch v-model:value="snippet.enabled" size="small" @update:value="persistCustomCode" />
              </div>
              <NPopconfirm @positive-click="removeCustomSnippet(idx)">
                <template #trigger>
                  <NButton size="tiny" type="error" secondary>
                    {{ $t('common.delete') }}
                  </NButton>
                </template>
                {{ $t('common.deleteConfirm') }}
              </NPopconfirm>
            </div>
            <NInput v-model:value="snippet.code" type="textarea" :rows="4" class="font-mono" />
          </NCard>

          <div v-if="studioStore.customCode.snippets.length > 0" class="flex justify-end">
            <NButton type="primary" size="small" :loading="savingCode" @click="persistCustomCode">
              {{ $t('apps.leonStudio.saveAndApplySnippets') }}
            </NButton>
          </div>
        </div>
      </NTabPane>
    </NTabs>

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
.leon-studio-preset-card {
  border: 1px solid var(--leon-ui-border, #d4d4d8);
  border-radius: var(--leon-ui-radius, 4px);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.leon-studio-preset-card.is-selected {
  border-color: var(--leon-ui-primary, #ff4f00);
  box-shadow: 3px 3px 0 0 var(--leon-ui-primary, #ff4f00);
}

.leon-studio-preset-swatch {
  height: 76px;
  padding: 12px;
  display: flex;
  align-items: flex-end;
  border-bottom: 1px solid var(--leon-ui-border, #d4d4d8);
}

.leon-studio-mini-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1.5px solid;
  max-width: 100%;
}

.leon-sandbox-shell {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.leon-sandbox-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.leon-sandbox-inner {
  position: relative;
  z-index: 1;
  padding: 14px 16px;
}

.leon-sandbox-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
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
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s ease, box-shadow 0.2s ease;
}

.leon-demo-icon-inner {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1), filter 0.2s ease;
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
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(148, 163, 184, 0.05);
  transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease, transform 0.14s ease;
  cursor: pointer;
  width: 100%;
}

.leon-mod-tile:hover {
  border-color: var(--leon-accent-color, #0ea5e9);
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 7%, transparent);
}

.leon-mod-tile.is-active {
  border-color: var(--leon-accent-color, #0ea5e9);
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 12%, transparent);
  box-shadow: 0 0 0 1px var(--leon-accent-color, #0ea5e9);
}

.leon-mod-chip {
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.06);
  transition: all 0.15s ease;
  cursor: pointer;
}

.leon-mod-chip:hover:not(:disabled) {
  border-color: var(--leon-accent-color, #0ea5e9);
}

.leon-mod-chip.is-active {
  border-color: var(--leon-accent-color, #0ea5e9);
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 16%, transparent);
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

.leon-cursor-preview-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.leon-cursor-preview-dot.is-system {
  border-radius: 2px;
  border: 1.5px solid currentColor;
  opacity: 0.55;
}

.leon-cursor-preview-dot.is-precision-dot {
  border-radius: 999px;
  border: 1.5px solid var(--leon-accent-color, #0ea5e9);
  box-shadow: inset 0 0 0 3px transparent, inset 0 0 0 5px var(--leon-accent-color, #0ea5e9);
}

.leon-cursor-preview-dot.is-spotlight-aura {
  border-radius: 999px;
  background: radial-gradient(circle, var(--leon-accent-color, #0ea5e9) 0%, transparent 72%);
}

.leon-cursor-preview-dot.is-neon-ring {
  border-radius: 999px;
  border: 2px solid var(--leon-accent-color, #0ea5e9);
  box-shadow: 0 0 6px var(--leon-accent-color, #0ea5e9);
}

.leon-cursor-preview-dot.is-crosshair-tech {
  position: relative;
  border-radius: 999px;
  border: 1.5px dashed var(--leon-accent-color, #0ea5e9);
}

.leon-cursor-preview-dot.is-minimal-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 10px solid currentColor;
  transform: rotate(-32deg);
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
  border-color: var(--leon-accent-color, #0ea5e9);
  transform: translateY(-1px);
}

.leon-swatch-tile.is-active {
  border-color: var(--leon-accent-color, #0ea5e9);
  box-shadow: 0 0 0 1.5px var(--leon-accent-color, #0ea5e9);
}

.leon-surface-swatch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 8px;
  border: 1px solid;
  border-radius: 7px;
  margin: 2px;
}

.leon-wall-swatch {
  height: 48px;
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
  background: rgba(9, 9, 11, 0.62);
  padding: 1px 5px;
  border-radius: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
