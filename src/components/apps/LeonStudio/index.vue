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
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  useMessage,
} from 'naive-ui'
import { useAuthStore, usePanelState, useStudioStore } from '@/store'
import {
  APPEARANCE_PRESETS,
  APPEARANCE_PRESET_IDS,
  type AppearancePresetId,
  type PanelLayoutMode,
  applyThemePackJson,
  exportThemePackJson,
} from '@/utils/panel/appearance'
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
})

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

async function persistStudio() {
  savingStudio.value = true
  try {
    const res = await studioStore.saveStudioConfig()
    if (res.code === 0)
      ms.success(t('common.saveSuccess'))
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

    <NTabs type="line" animated>
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
</style>
