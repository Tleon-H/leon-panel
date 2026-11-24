<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import { NAlert, NButton, NCard, NCheckbox, NColorPicker, NGrid, NGridItem, NInput, NInputGroup, NInputNumber, NModal, NPopconfirm, NSelect, NSlider, NSpin, NSwitch, NUpload, NUploadDragger, useMessage } from 'naive-ui'
import { useAuthStore, usePanelState } from '@/store'
import { PanelPanelConfigStyleEnum } from '@/enums/panel'
import { t } from '@/locales'
import OwnGallery from '@/components/apps/OwnGallery/index.vue'
import PublicGallery from '@/components/apps/PublicGallery/index.vue'
import { maxWidthControlValue, maxWidthFromControl } from '@/utils/panel/maxWidth'
import {
  APPEARANCE_PRESETS,
  APPEARANCE_PRESET_IDS,
  DEFAULT_APPEARANCE_SCOPES,
  hasSelectedScope,
  inferWallpaperToneFromSrc,
  shouldAutoSavePanelConfig,
} from '@/utils/panel/appearance'
import type { AppearancePresetId, AppearancePresetScopes, CardSurfacePresetId } from '@/utils/panel/appearance'

const authStore = useAuthStore()
const panelState = usePanelState()
const ms = useMessage()
const showWallpaperInput = ref(false)
const showPublicWallpapers = ref(false)
const showOwnWallpapers = ref(false)

const selectedScopes = ref<AppearancePresetScopes>({
  ...(panelState.previewScopes ?? DEFAULT_APPEARANCE_SCOPES),
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
let skipNextAutoSave = false
const saveFailedMessage = ref('')
const mountedToken = authStore.token || ''
const isEditable = computed(() => panelState.isCloudConfigReady)
const displayedWallpaperTone = computed(() => panelState.panelConfig.wallpaperTone ?? inferWallpaperToneFromSrc(panelState.panelConfig.backgroundImageSrc))

onMounted(() => {
  if (authStore.token && panelState.cloudConfigState === 'idle')
    panelState.updatePanelConfigByCloud()
})

const presetList = computed(() => APPEARANCE_PRESET_IDS.map(id => APPEARANCE_PRESETS[id]))

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

const iconBadgeStyleOptions = [
  {
    label: t('apps.baseSettings.iconBadgePrecision'),
    value: 'precision',
  },
  {
    label: t('apps.baseSettings.iconBadgeDefault'),
    value: 'default',
  },
  {
    label: t('apps.baseSettings.iconBadgeBauhaus'),
    value: 'bauhaus',
  },
  {
    label: t('apps.baseSettings.iconBadgeGlass'),
    value: 'glass',
  },
  {
    label: t('apps.baseSettings.iconBadgeSoft'),
    value: 'soft',
  },
  {
    label: t('apps.baseSettings.iconBadgeOutline'),
    value: 'outline',
  },
]

const cardSurfaceOptions = [
  {
    label: t('apps.baseSettings.presets.obsidianSlate.name'),
    value: 'obsidian-slate',
  },
  {
    label: t('apps.baseSettings.presets.alabasterPaper.name'),
    value: 'alabaster-paper',
  },
  {
    label: t('apps.baseSettings.cardSurfaceDefault'),
    value: 'default',
  },
  {
    label: t('apps.baseSettings.presets.bauhausGrid.name'),
    value: 'bauhaus-grid',
  },
  {
    label: t('apps.baseSettings.presets.swissPaper.name'),
    value: 'swiss-paper',
  },
  {
    label: t('apps.baseSettings.presets.monoInk.name'),
    value: 'mono-ink',
  },
  {
    label: t('apps.baseSettings.presets.blueprintSlate.name'),
    value: 'blueprint-slate',
  },
  {
    label: t('apps.baseSettings.presets.nordicStone.name'),
    value: 'nordic-stone',
  },
  {
    label: t('apps.baseSettings.presets.oceanGlass.name'),
    value: 'ocean-glass',
  },
  {
    label: t('apps.baseSettings.presets.mistPaper.name'),
    value: 'mist-paper',
  },
  {
    label: t('apps.baseSettings.presets.midnightGraphite.name'),
    value: 'midnight-graphite',
  },
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

const maxWidthUnitOption = [
  {
    label: 'px',
    value: 'px',
  },
  {
    label: '%',
    value: '%',
  },
]

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
      uploadCloud()
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

function handleCardSurfaceChange(surface: CardSurfacePresetId) {
  panelState.setCardSurface(surface)
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

function updateMaxWidth(value: number | null) {
  if (!panelState.isCloudConfigReady)
    return
  panelState.panelConfig.maxWidth = maxWidthFromControl(value)
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

function resetPanelConfig() {
  if (!panelState.isCloudConfigReady)
    return
  clearSaveTimer()
  skipNextAutoSave = true
  if (!panelState.restoreDefaultPanelConfig()) {
    skipNextAutoSave = false
    return
  }
  uploadCloud()
}
</script>

<template>
  <div class="bg-slate-200 dark:bg-zinc-900 rounded-[10px] p-[8px] overflow-auto">
    <NAlert
      v-if="panelState.cloudConfigState === 'loading' || panelState.cloudConfigState === 'idle'"
      type="info"
      class="mb-[10px]"
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
      class="mb-[10px]"
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
      class="mb-[10px]"
      data-testid="panel-config-save-error"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ saveFailedMessage }}</span>
        <NButton size="tiny" type="warning" secondary data-testid="panel-config-save-retry" @click="uploadCloud()">
          {{ $t('apps.baseSettings.configSaveRetry') }}
        </NButton>
      </div>
    </NAlert>

    <fieldset :disabled="!isEditable" class="leon-style-fieldset">
      <NCard style="border-radius:10px" size="small" data-testid="appearance-presets-card">
        <div class="text-slate-500 mb-[5px] font-bold">
          {{ $t('apps.baseSettings.presets.title') }}
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-300 leading-5 mb-2">
          {{ $t('apps.baseSettings.presets.hint') }}
        </p>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-300">
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
              <div class="font-semibold text-sm">
                {{ $t(preset.nameKey) }}
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-300 mt-0.5 leading-4">
                {{ $t(preset.descKey) }}
              </div>
            </div>

            <div class="flex flex-wrap gap-2 mt-2">
              <NButton
                size="small"
                secondary
                :disabled="!isEditable"
                :data-testid="`preset-preview-${preset.id}`"
                @click="previewPreset(preset.id)"
              >
                {{ $t('apps.baseSettings.presets.preview') }}
              </NButton>
              <NButton
                size="small"
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

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        LOGO
      </div>

      <div>
        <div>
          {{ $t('apps.baseSettings.textContent') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NInput v-model:value="panelState.panelConfig.logoText" type="text" show-count :maxlength="20" placeholder="请输入文字" />
        </div>
      </div>
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('apps.baseSettings.clock') }}
      </div>
      <div class="flex items-center mt-[5px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.clockSecondShow') }}</span>
        <NSwitch v-model:value="panelState.panelConfig.clockShowSecond" />
      </div>
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('apps.baseSettings.searchBar') }}
      </div>
      <div class="flex items-center mt-[5px]">
        <span class="mr-[10px]">{{ $t('common.show') }}</span>
        <NSwitch v-model:value="panelState.panelConfig.searchBoxShow" />
      </div>
      <div v-if="panelState.panelConfig.searchBoxShow" class="flex items-center mt-[5px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.searchBarSearchItem') }}</span>
        <NSwitch v-model:value="panelState.panelConfig.searchBoxSearchIcon" />
      </div>
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('apps.baseSettings.systemMonitorStatus') }}
      </div>
      <div class="flex items-center mt-[5px]">
        <span class="mr-[10px]">{{ $t('common.show') }}</span>
        <NSwitch v-model:value="panelState.panelConfig.systemMonitorShow" />
      </div>
      <div v-if="panelState.panelConfig.systemMonitorShow" class="flex items-center mt-[5px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.showTitle') }}</span>
        <NSwitch v-model:value="panelState.panelConfig.systemMonitorShowTitle" />
      </div>
      <div v-if="panelState.panelConfig.systemMonitorShow" class="flex items-center mt-[5px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.publicVisitModeShow') }}</span>
        <NSwitch v-model:value="panelState.panelConfig.systemMonitorPublicVisitModeShow" />
      </div>
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small" data-testid="card-style-settings">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('apps.baseSettings.cardStyleSection') }}
      </div>

      <div class="mt-[5px]">
        <div>
          {{ $t('apps.baseSettings.cardSurface') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NSelect
            :value="panelState.panelConfig.cardSurface || 'default'"
            :options="cardSurfaceOptions"
            data-testid="card-surface-select"
            @update:value="handleCardSurfaceChange"
          />
        </div>
      </div>

      <div class="mt-[8px]">
        <div>
          {{ $t('apps.baseSettings.cardBackgroundColor') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NColorPicker
            v-model:value="panelState.panelConfig.cardBackgroundColor"
            :show-alpha="true"
            size="small"
            :modes="['rgb', 'hex']"
            :swatches="[
              '#2a2a2a6b',
              'rgba(15, 42, 74, 0.56)',
              'rgba(255, 252, 246, 0.92)',
              'rgba(17, 21, 28, 0.88)',
            ]"
          />
        </div>
      </div>

      <div class="flex items-center mt-[10px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.cardBlur') }}</span>
        <NSlider v-model:value="panelState.panelConfig.cardBlur" class="max-w-[200px]" :step="2" :min="0" :max="24" />
      </div>

      <div class="flex items-center mt-[10px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.cardRadius') }}</span>
        <NSlider v-model:value="panelState.panelConfig.cardBorderRadius" class="max-w-[200px]" :step="2" :min="0" :max="24" />
      </div>

      <div class="mt-[8px]">
        <div>
          {{ $t('apps.baseSettings.cardAccentColor') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NColorPicker
            v-model:value="panelState.panelConfig.cardAccentColor"
            :show-alpha="false"
            size="small"
            :modes="['hex']"
            :swatches="[
              '#ff4f00',
              '#2563eb',
              '#eab308',
              '#00c2a8',
              '#09090b',
              '#38bdf8',
              '#0284c7',
              '#22d3ee',
            ]"
          />
        </div>
      </div>
    </NCard>

    <NCard style="border-radius:var(--leon-ui-radius, 6px)" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('common.icon') }}
      </div>
      <div class="mt-[5px]">
        <div>
          {{ $t('common.style') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NSelect v-model:value="panelState.panelConfig.iconStyle" :options="iconTypeOptions" data-testid="icon-style-select" />
        </div>
      </div>

      <div class="mt-[8px]">
        <div>
          {{ $t('apps.baseSettings.iconBadgeStyle') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NSelect v-model:value="panelState.panelConfig.iconBadgeStyle" :options="iconBadgeStyleOptions" data-testid="icon-badge-select" />
        </div>
      </div>

      <div class="mt-[8px]">
        <div>
          {{ $t('apps.baseSettings.iconMonochrome') }}
        </div>
        <div class="flex items-center gap-2 mt-[5px]">
          <NSwitch v-model:value="panelState.panelConfig.iconMonochrome" data-testid="icon-monochrome-switch" />
          <span class="text-xs opacity-70">{{ $t('apps.baseSettings.iconMonochromeTip') }}</span>
        </div>
      </div>

      <div v-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.info" class="mt-[5px]">
        <div>
          {{ $t('apps.baseSettings.hideDescription') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NSwitch v-model:value="panelState.panelConfig.iconTextInfoHideDescription" />
        </div>
      </div>

      <div v-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.icon" class="mt-[5px]">
        <div>
          {{ $t('apps.baseSettings.hideTitle') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NSwitch v-model:value="panelState.panelConfig.iconTextIconHideTitle" />
        </div>
      </div>

      <div class="mt-[5px]">
        <div>
          {{ $t('common.textColor') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NColorPicker
            v-model:value="panelState.panelConfig.iconTextColor"
            :show-alpha="false"
            size="small"
            :modes="['hex']"
            :swatches="[
              '#000000',
              '#1e293b',
              '#ffffff',
              '#f1f5f9',
              '#18A058',
              '#2080F0',
              '#F0A020',
            ]"
          />
        </div>
      </div>
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('apps.baseSettings.wallpaper') }}
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
            class="h-[200px] w-full border bg-slate-100 flex justify-center items-center cursor-pointer rounded-[10px]"
            :style="{ background: `url(${panelState.panelConfig.backgroundImageSrc}) no-repeat`, backgroundSize: 'cover', backgroundPosition: 'center' }"
          >
            <div class="text-shadow text-white">
              {{ $t('apps.baseSettings.uploadOrDragText') }}
            </div>
          </div>
        </NUploadDragger>
      </NUpload>
      <div class="mt-2 flex flex-wrap gap-2">
        <NButton size="small" :disabled="!isEditable" data-testid="open-own-wallpapers" @click="showOwnWallpapers = true">
          {{ $t('apps.ownGallery.open') }}
        </NButton>
        <NButton size="small" :disabled="!isEditable" data-testid="open-public-wallpapers" @click="showPublicWallpapers = true">
          {{ $t('apps.publicGallery.open') }}
        </NButton>
      </div>
      <NModal v-model:show="showOwnWallpapers" preset="card" :title="$t('apps.ownGallery.title')" style="width: min(720px, 96vw);">
        <OwnGallery selectable @select="useOwnWallpaper" />
      </NModal>
      <NModal v-model:show="showPublicWallpapers" preset="card" :title="$t('apps.publicGallery.appName')" style="width: min(720px, 96vw);">
        <PublicGallery locked-category="wallpaper" selectable @select="usePublicWallpaper" />
      </NModal>

      <div class="mt-[8px]">
        <div>
          {{ $t('apps.baseSettings.wallpaperTone') }}
        </div>
        <div class="flex items-center mt-[5px]">
          <NSelect
            :value="displayedWallpaperTone"
            :options="wallpaperToneOptions"
            :disabled="!isEditable"
            data-testid="wallpaper-tone-select"
            @update:value="(val: 'dark' | 'light') => (panelState.panelConfig.wallpaperTone = val)"
          />
        </div>
      </div>

      <div class="flex items-center mt-[5px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.customImageAddress') }}</span>
        <NSwitch v-model:value="showWallpaperInput" :disabled="!isEditable" />
      </div>
      <div v-if="showWallpaperInput" class="mt-1">
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

      <div class="flex items-center mt-[10px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.vague') }}</span>
        <NSlider v-model:value="panelState.panelConfig.backgroundBlur" class="max-w-[200px]" :step="2" :max="20" />
      </div>

      <div class="flex items-center mt-[10px]">
        <span class="mr-[10px]">{{ $t('apps.baseSettings.mask') }}</span>
        <NSlider v-model:value="panelState.panelConfig.backgroundMaskNumber" class="max-w-[200px]" :step="0.1" :max="1" />
      </div>
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('apps.baseSettings.contentArea') }}
      </div>

      <NGrid cols="2">
        <NGridItem span="12 400:12">
          <div class="flex items-center mt-[5px]">
            <span class="mr-[10px]">{{ $t('apps.baseSettings.netModeChangeButtonShow') }}</span>
            <NSwitch v-model:value="panelState.panelConfig.netModeChangeButtonShow" />
          </div>
        </NGridItem>

        <NGridItem span="12 400:12">
          <div class="flex items-center mt-[10px]">
            <span class="mr-[10px]">{{ $t('apps.baseSettings.maxWidth') }}</span>
            <div class="flex">
              <NInputGroup>
                <NInputNumber :value="maxWidthControlValue(panelState.panelConfig.maxWidth)" size="small" :show-button="false" :style="{ width: '100px' }" placeholder="1200" @update:value="updateMaxWidth" />
                <NSelect v-model:value="panelState.panelConfig.maxWidthUnit" :style="{ width: '80px' }" :options="maxWidthUnitOption" size="small" />
              </NInputGroup>
            </div>
          </div>
        </NGridItem>
        <NGridItem span="12 400:12">
          <div class="flex items-center mt-[10px]">
            <span class="mr-[10px]">{{ $t('apps.baseSettings.leftRightMargin') }}</span>
            <NSlider v-model:value="panelState.panelConfig.marginX" class="max-w-[200px]" :step="1" :max="100" />
          </div>
        </NGridItem>
        <NGridItem span="12 400:12">
          <div class="flex items-center mt-[10px]">
            <span class="mr-[10px]">{{ $t('apps.baseSettings.topMargin') }} (%)</span>
            <NSlider v-model:value="panelState.panelConfig.marginTop" class="max-w-[200px]" :step="1" :max="50" />
          </div>
        </NGridItem>
        <NGridItem span="12 400:6">
          <div class="flex items-center mt-[10px]">
            <span class="mr-[10px]">{{ $t('apps.baseSettings.bottomMargin') }} (%)</span>
            <NSlider v-model:value="panelState.panelConfig.marginBottom" class="max-w-[200px]" :step="1" :max="50" />
          </div>
        </NGridItem>
      </NGrid>
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <div class="text-slate-500 mb-[5px] font-bold">
        {{ $t('apps.baseSettings.customFooter') }}
      </div>

      <NInput
        v-model:value="panelState.panelConfig.footerHtml"
        type="textarea"
        clearable
      />
    </NCard>

    <NCard style="border-radius:10px" class="mt-[10px]" size="small">
      <NPopconfirm
        @positive-click="resetPanelConfig"
      >
        <template #trigger>
          <NButton size="small" quaternary type="error" :disabled="!isEditable">
            {{ $t('common.reset') }}
          </NButton>
        </template>
        {{ $t('apps.baseSettings.resetWarnText') }}
      </NPopconfirm>

      <NButton size="small" quaternary type="success" class="ml-[10px]" :disabled="!isEditable" @click="uploadCloud()">
        {{ $t('common.save') }}
      </NButton>
    </NCard>
    </fieldset>
  </div>
</template>

<style scoped>
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
  text-shadow: 0px 0px 5px gray;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
}

.preset-option {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(248, 250, 252, 0.65);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  min-width: 0;
}

.dark .preset-option {
  background: rgba(39, 39, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.25);
}

.preset-option.is-active {
  border-color: #0284c7;
  box-shadow: 0 0 0 1px rgba(2, 132, 199, 0.35);
}

.preset-swatch {
  height: 64px;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.preset-swatch-card {
  width: 100%;
  height: 40px;
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-swatch-dot {
  width: 16px;
  height: 16px;
  border-radius: 6px;
  flex: 0 0 16px;
}

.preset-swatch-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.preset-swatch-line {
  height: 5px;
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
</style>
