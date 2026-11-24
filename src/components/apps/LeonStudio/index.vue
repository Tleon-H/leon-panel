<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NInput,
  NInputGroup,
  NInputNumber,
  NPopconfirm,
  NSelect,
  NSlider,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  useMessage,
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { t } from '@/locales'
import { useAuthStore, usePanelState, useStudioStore } from '@/store'
import { type PanelLayoutMode, shouldAutoSavePanelConfig } from '@/utils/panel/appearance'
import { maxWidthControlValue, maxWidthFromControl } from '@/utils/panel/maxWidth'
import {
  type CustomCodeSnippet,
  type CustomSnippetType,
} from '@/utils/studio/customCode'
import {
  type DesktopWidgetItem,
  type DesktopWidgetType,
  MAX_COUNTDOWN_ENTRIES,
  WIDGET_CATALOG,
  createDesktopWidget,
  formatIsoDateLocal,
  sanitizeWidgetUrl,
} from '@/utils/studio/studioConfig'

const ms = useMessage()
const authStore = useAuthStore()
const panelState = usePanelState()
const studioStore = useStudioStore()
const switchStarterApp = inject<((target: string) => void) | undefined>('leonSwitchStarterApp', undefined)

const isAdmin = computed(() => authStore.userInfo?.role === 1)
const isEditable = computed(() => panelState.isCloudConfigReady)
const activeTab = ref((studioStore.safeMode && isAdmin.value) ? 'customCode' : 'layout')

const layoutModeOptions: Array<{ label: string; value: PanelLayoutMode }> = [
  { label: t('apps.leonStudio.layoutStandard'), value: 'standard' },
  { label: t('apps.leonStudio.layoutCompact'), value: 'compact' },
  { label: t('apps.leonStudio.layoutDock'), value: 'dock' },
]

const maxWidthUnitOption = [
  { label: 'px', value: 'px' },
  { label: '%', value: '%' },
]

// Custom CSS/JS snippet editor
const newSnippetName = ref('')
const newSnippetType = ref<CustomSnippetType>('css')
const newSnippetCode = ref('')
const savingCode = ref(false)
const savingStudio = ref(false)

let saveTimer: ReturnType<typeof setTimeout> | null = null
const mountedToken = authStore.token || ''

function clearSaveTimer() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

function syncPanelConfigToCloud(silent = true) {
  clearSaveTimer()
  panelState.savePanelConfigToCloud().then((res) => {
    if (res.ok && !silent)
      ms.success(t('common.saveSuccess'))
    else if (!res.ok && !res.stale && !res.blocked && res.msg)
      ms.error(res.msg)
  })
}

watch(
  () => panelState.panelConfig,
  (config) => {
    if (!panelState.isCloudConfigReady)
      return
    if (!shouldAutoSavePanelConfig(config, panelState.lastSyncedPanelJson ?? null))
      return
    panelState.recordState()
    clearSaveTimer()
    saveTimer = setTimeout(() => {
      saveTimer = null
      if (!panelState.isCloudConfigReady || !shouldAutoSavePanelConfig(panelState.panelConfig, panelState.lastSyncedPanelJson ?? null))
        return
      syncPanelConfigToCloud(true)
    }, 450)
  },
  { deep: true },
)

onMounted(() => {
  if (authStore.token && panelState.cloudConfigState === 'idle')
    panelState.updatePanelConfigByCloud()
  if (!studioStore.loaded)
    studioStore.loadFromCloud()
  if (studioStore.safeMode && isAdmin.value)
    activeTab.value = 'customCode'
})

onBeforeUnmount(() => {
  const hadTimer = saveTimer !== null
  clearSaveTimer()
  if (
    hadTimer
    && panelState.isCloudConfigReady
    && (authStore.token || '') === mountedToken
    && shouldAutoSavePanelConfig(panelState.panelConfig, panelState.lastSyncedPanelJson ?? null)
  )
    syncPanelConfigToCloud(true)
})

function handleLayoutModeChange(mode: PanelLayoutMode) {
  if (!isEditable.value)
    return
  panelState.panelConfig.layoutMode = mode
}

function updateMaxWidth(value: number | null) {
  if (!isEditable.value)
    return
  panelState.panelConfig.maxWidth = maxWidthFromControl(value)
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

function addCountdownEntry(widget: DesktopWidgetItem) {
  if (!Array.isArray(widget.countdownEntries))
    widget.countdownEntries = []
  if (widget.countdownEntries.length >= MAX_COUNTDOWN_ENTRIES)
    return
  const nextMonth = new Date()
  nextMonth.setDate(nextMonth.getDate() + 30)
  widget.countdownEntries.push({
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    label: t('apps.leonStudio.countdownDefaultLabel'),
    targetDate: formatIsoDateLocal(nextMonth),
  })
  persistStudio()
}

function removeCountdownEntry(widget: DesktopWidgetItem, entryIdx: number) {
  if (!Array.isArray(widget.countdownEntries))
    return
  widget.countdownEntries.splice(entryIdx, 1)
  persistStudio()
}

function clearCompletedTodos(widget: DesktopWidgetItem) {
  if (!Array.isArray(widget.todoItems))
    return
  widget.todoItems = widget.todoItems.filter(item => !item.done)
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
  <div class="leon-studio-root p-1 space-y-3">
    <NAlert v-if="studioStore.safeMode" type="warning" :bordered="true" data-testid="studio-safe-mode-alert">
      {{ $t('apps.leonStudio.safeModeActiveNotice') }}
    </NAlert>

    <div
      v-if="switchStarterApp"
      class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-300/50 dark:border-zinc-700/70 bg-slate-100/60 dark:bg-zinc-800/50 text-xs"
    >
      <span class="opacity-80">{{ $t('apps.leonStudio.layoutRedirectTip') }}</span>
      <NButton size="tiny" type="primary" secondary @click="switchStarterApp?.('Style')">
        <template #icon>
          <SvgIcon icon="lucide:palette" class="text-[12px]" />
        </template>
        {{ $t('apps.leonStudio.gotoVisualStudio') }}
      </NButton>
    </div>

    <NTabs v-model:value="activeTab" type="line">
      <!-- TAB 1: 页面布局、间距与顶栏模块 -->
      <NTabPane name="layout" :tab="$t('apps.leonStudio.tabLayout')">
        <div class="space-y-3">
          <NCard size="small">
            <div class="mb-3">
              <div class="font-bold text-sm">
                {{ $t('apps.leonStudio.layoutModeTitle') }}
              </div>
              <div class="text-xs opacity-70 mt-0.5">
                {{ $t('apps.leonStudio.layoutModeDesc') }}
              </div>
            </div>

            <div class="space-y-3">
              <NSelect
                :value="panelState.panelConfig.layoutMode || 'standard'"
                :options="layoutModeOptions"
                :disabled="!isEditable"
                data-testid="layout-mode-select"
                @update:value="handleLayoutModeChange"
              />

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.maxWidth') }}</span>
                  <NInputGroup class="w-auto">
                    <NInputNumber
                      :value="maxWidthControlValue(panelState.panelConfig.maxWidth)"
                      size="small"
                      :disabled="!isEditable"
                      :show-button="false"
                      style="width: 96px;"
                      placeholder="1200"
                      @update:value="updateMaxWidth"
                    />
                    <NSelect
                      v-model:value="panelState.panelConfig.maxWidthUnit"
                      :disabled="!isEditable"
                      style="width: 72px;"
                      :options="maxWidthUnitOption"
                      size="small"
                    />
                  </NInputGroup>
                </div>

                <div class="flex items-center gap-2.5">
                  <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.leftRightMargin') }}</span>
                  <NSlider v-model:value="panelState.panelConfig.marginX" :disabled="!isEditable" class="flex-1" :step="1" :max="100" />
                  <span class="text-xs font-mono opacity-75 w-8 text-right">{{ panelState.panelConfig.marginX ?? 10 }}</span>
                </div>

                <div class="flex items-center gap-2.5">
                  <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.topMargin') }} (%)</span>
                  <NSlider v-model:value="panelState.panelConfig.marginTop" :disabled="!isEditable" class="flex-1" :step="1" :max="50" />
                  <span class="text-xs font-mono opacity-75 w-8 text-right">{{ panelState.panelConfig.marginTop ?? 0 }}%</span>
                </div>

                <div class="flex items-center gap-2.5">
                  <span class="text-xs opacity-80 shrink-0">{{ $t('apps.baseSettings.bottomMargin') }} (%)</span>
                  <NSlider v-model:value="panelState.panelConfig.marginBottom" :disabled="!isEditable" class="flex-1" :step="1" :max="50" />
                  <span class="text-xs font-mono opacity-75 w-8 text-right">{{ panelState.panelConfig.marginBottom ?? 0 }}%</span>
                </div>
              </div>
            </div>
          </NCard>

          <NCard size="small">
            <div class="mb-3">
              <div class="font-bold text-sm">
                {{ $t('apps.leonStudio.headerModulesTitle') }}
              </div>
              <div class="text-xs opacity-70 mt-0.5">
                {{ $t('apps.leonStudio.headerModulesDesc') }}
              </div>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <div class="font-semibold mb-1 opacity-85">
                  LOGO · {{ $t('apps.baseSettings.textContent') }}
                </div>
                <NInput
                  v-model:value="panelState.panelConfig.logoText"
                  :disabled="!isEditable"
                  size="small"
                  show-count
                  :maxlength="20"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div class="leon-toggle-row">
                  <span>{{ $t('apps.baseSettings.clock') }} · {{ $t('apps.baseSettings.clockSecondShow') }}</span>
                  <NSwitch v-model:value="panelState.panelConfig.clockShowSecond" :disabled="!isEditable" size="small" />
                </div>

                <div class="leon-toggle-row">
                  <span>{{ $t('apps.leonStudio.fxEnhancedClock') }}</span>
                  <NSwitch v-model:value="studioStore.config.effects.enhancedClock" size="small" @update:value="persistStudio" />
                </div>

                <div class="leon-toggle-row">
                  <span>{{ $t('apps.baseSettings.searchBar') }} · {{ $t('common.show') }}</span>
                  <NSwitch v-model:value="panelState.panelConfig.searchBoxShow" :disabled="!isEditable" size="small" />
                </div>

                <div v-if="panelState.panelConfig.searchBoxShow" class="leon-toggle-row">
                  <span>{{ $t('apps.baseSettings.searchBarSearchItem') }}</span>
                  <NSwitch v-model:value="panelState.panelConfig.searchBoxSearchIcon" :disabled="!isEditable" size="small" />
                </div>

                <div class="leon-toggle-row">
                  <span>{{ $t('apps.baseSettings.systemMonitorStatus') }} · {{ $t('common.show') }}</span>
                  <NSwitch v-model:value="panelState.panelConfig.systemMonitorShow" :disabled="!isEditable" size="small" />
                </div>

                <div v-if="panelState.panelConfig.systemMonitorShow" class="leon-toggle-row">
                  <span>{{ $t('apps.baseSettings.systemMonitorStatus') }} · {{ $t('apps.baseSettings.showTitle') }}</span>
                  <NSwitch v-model:value="panelState.panelConfig.systemMonitorShowTitle" :disabled="!isEditable" size="small" />
                </div>

                <div v-if="panelState.panelConfig.systemMonitorShow" class="leon-toggle-row">
                  <span>{{ $t('apps.baseSettings.publicVisitModeShow') }}</span>
                  <NSwitch v-model:value="panelState.panelConfig.systemMonitorPublicVisitModeShow" :disabled="!isEditable" size="small" />
                </div>

                <div class="leon-toggle-row">
                  <span>{{ $t('apps.baseSettings.netModeChangeButtonShow') }}</span>
                  <NSwitch v-model:value="panelState.panelConfig.netModeChangeButtonShow" :disabled="!isEditable" size="small" />
                </div>
              </div>

              <div v-if="studioStore.config.effects.enhancedClock" class="pt-1 space-y-1.5">
                <div class="font-semibold opacity-85">
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

              <div class="pt-1">
                <div class="font-semibold mb-1 opacity-85">
                  {{ $t('apps.baseSettings.customFooter') }}
                </div>
                <NInput
                  v-model:value="panelState.panelConfig.footerHtml"
                  :disabled="!isEditable"
                  type="textarea"
                  :rows="2"
                  clearable
                />
              </div>
            </div>
          </NCard>
        </div>
      </NTabPane>

      <!-- TAB 2: 桌面小组件（可视化组件选择器 + 列表） -->
      <NTabPane name="widgets" :tab="$t('apps.leonStudio.tabWidgets')">
        <div class="mb-3">
          <div class="text-xs font-semibold mb-2 opacity-80">
            {{ $t('apps.leonStudio.widgetPickerTitle') }}
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="visual-widget-picker">
            <button
              v-for="item in WIDGET_CATALOG"
              :key="item.type"
              type="button"
              class="leon-widget-picker-card"
              :data-testid="`widget-picker-${item.type}`"
              @click="addWidget(item.type)"
            >
              <div class="flex items-center justify-between gap-1 w-full">
                <span class="leon-widget-picker-icon" :style="{ backgroundColor: item.accent }">
                  <SvgIcon :icon="item.icon" class="text-[15px] text-white" />
                </span>
                <span v-if="item.isNew" class="leon-widget-new-badge">NEW</span>
                <SvgIcon v-else icon="lucide:plus" class="text-[13px] opacity-50" />
              </div>
              <div class="font-semibold text-xs truncate mt-2">
                {{ $t(item.nameKey) }}
              </div>
              <div class="text-[11px] opacity-60 truncate mt-0.5">
                {{ $t(item.tagKey) }}
              </div>
            </button>
          </div>
        </div>

        <div v-if="studioStore.config.widgets.length === 0" class="p-6 text-center text-xs opacity-65 border border-dashed rounded-lg">
          {{ $t('apps.leonStudio.widgetsEmpty') }}
        </div>

        <div class="space-y-3">
          <NCard v-for="(widget, idx) in studioStore.config.widgets" :key="widget.id" size="small">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <NTag size="small" type="info">
                  {{ widget.type.toUpperCase() }}
                </NTag>
                <NInput v-model:value="widget.title" size="tiny" style="width: 150px;" :placeholder="$t('common.title')" />
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

            <div v-if="widget.type === 'todo'" class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span class="opacity-75">
                {{ $t('apps.leonStudio.todoEditorSummary', {
                  done: (widget.todoItems || []).filter(i => i.done).length,
                  total: (widget.todoItems || []).length,
                }) }}
              </span>
              <NButton
                size="tiny"
                secondary
                :disabled="!(widget.todoItems || []).some(i => i.done)"
                @click="clearCompletedTodos(widget)"
              >
                {{ $t('apps.leonStudio.todoClearDone') }}
              </NButton>
            </div>

            <div v-else-if="widget.type === 'countdown'" class="mt-2 space-y-2">
              <div
                v-for="(entry, eIdx) in (widget.countdownEntries || [])"
                :key="entry.id"
                class="flex flex-wrap items-center gap-2"
              >
                <NInput
                  v-model:value="entry.label"
                  size="small"
                  class="flex-1 min-w-[130px]"
                  :placeholder="$t('apps.leonStudio.countdownLabelPlaceholder')"
                />
                <input
                  v-model="entry.targetDate"
                  type="date"
                  class="leon-date-input"
                >
                <NButton size="tiny" type="error" secondary @click="removeCountdownEntry(widget, eIdx)">
                  ×
                </NButton>
              </div>
              <div>
                <NButton
                  size="tiny"
                  secondary
                  :disabled="(widget.countdownEntries || []).length >= MAX_COUNTDOWN_ENTRIES"
                  @click="addCountdownEntry(widget)"
                >
                  + {{ $t('apps.leonStudio.countdownAddEntry') }}
                </NButton>
              </div>
            </div>

            <div v-else-if="widget.type === 'memo'" class="mt-2">
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

      <!-- TAB 3: 管理员自定义 CSS / JS 片段 -->
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
  </div>
</template>

<style scoped>
.leon-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(148, 163, 184, 0.04);
}

.leon-widget-picker-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.05);
  color: inherit;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.14s ease;
}

.leon-widget-picker-card:hover,
.leon-widget-picker-card:focus-visible {
  outline: none;
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 9%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px var(--leon-ui-primary, #0ea5e9);
}

.leon-widget-picker-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.leon-widget-new-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 18%, transparent);
  color: var(--leon-ui-primary, #0ea5e9);
}

.leon-date-input {
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
</style>
