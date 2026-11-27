<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NCheckbox } from 'naive-ui'
import { decideSearchConfirm, decideSearchKey } from '@/utils/search/filterIcons'
import { addCustomEngine, buildSearchUrl, currentSearchEngine, moveEngine, normalizeSearchConfig, removeCustomEngine, resolveBuiltinEngineIconKey, resolveEngineLetter, selectEngine, toPersistedSearchConfig, updateCustomEngine, type SearchConfig, type SearchConfigError, type SearchEngineRecord } from '@/utils/search/engines'
import { contextNewTabFeatures } from '@/utils/panel/contextMenu'
import { SvgIcon } from '@/components/common'
import { useModuleConfig } from '@/store/modules'
import { useAuthStore } from '@/store'
import { VisitMode } from '@/enums/auth'
import { t } from '@/locales'

import SvgSrcBaidu from '@/assets/search_engine_svg/baidu.svg'
import SvgSrcBing from '@/assets/search_engine_svg/bing.svg'
import SvgSrcGoogle from '@/assets/search_engine_svg/google.svg'

const props = withDefaults(defineProps<{
  background?: string
  textColor?: string
  localSearchEnabled?: boolean
  matchCount?: number
}>(), {
  background: '#2a2a2a6b',
  textColor: 'white',
  localSearchEnabled: false,
  matchCount: 0,
})

const emits = defineEmits(['itemSearch', 'moveMatch', 'openLocal'])

const builtinIcons: Record<string, string> = {
  google: SvgSrcGoogle,
  baidu: SvgSrcBaidu,
  bing: SvgSrcBing,
}

const moduleConfigName = 'deskModuleSearchBox'
const moduleConfig = useModuleConfig()
const authStore = useAuthStore()
const searchInput = ref<HTMLInputElement | null>(null)
function focusSearch(event: KeyboardEvent) {
  const target = event.target
  if (event.key !== '/' || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
    return
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [role="dialog"]')))
    return
  if (document.querySelector('[role="dialog"]'))
    return
  event.preventDefault()
  searchInput.value?.focus()
}
onMounted(() => window.addEventListener('keydown', focusSearch))
onUnmounted(() => window.removeEventListener('keydown', focusSearch))
const searchTerm = ref('')
const isFocused = ref(false)
const searchSelectListShow = ref(false)
const config = ref<SearchConfig>(normalizeSearchConfig(null))
const draftTitle = ref('')
const draftUrl = ref('')
const editingId = ref<string | null>(null)
const formError = ref<SearchConfigError | ''>('')

const canEdit = computed(() => authStore.visitMode !== VisitMode.VISIT_MODE_PUBLIC)
const current = computed(() => currentSearchEngine(config.value))

const onFocus = (): void => {
  isFocused.value = true
}

const onBlur = (): void => {
  isFocused.value = false
}

function engineIcon(engine: SearchEngineRecord): string {
  const key = resolveBuiltinEngineIconKey(engine)
  return key ? (builtinIcons[key] || '') : ''
}

function engineLetter(engine: SearchEngineRecord): string {
  return resolveEngineLetter(engine.title)
}

function handleEngineClick() {
  if (!canEdit.value)
    return
  searchSelectListShow.value = !searchSelectListShow.value
}

async function persist(next: SearchConfig) {
  if (!canEdit.value)
    return
  config.value = next
  await moduleConfig.saveToCloud(moduleConfigName, toPersistedSearchConfig(next))
}

function handleEngineUpdate(engine: SearchEngineRecord) {
  void persist(selectEngine(config.value, engine.id))
  searchSelectListShow.value = false
}

function handleSearchClick() {
  const fullUrl = buildSearchUrl(current.value.url, searchTerm.value)
  if (!fullUrl)
    return
  handleClearSearchTerm()
  if (config.value.newWindowOpen) {
    const opened = window.open(fullUrl, '_blank', contextNewTabFeatures)
    if (opened)
      opened.opener = null
  }
  else {
    window.location.href = fullUrl
  }
}

function handleConfirm() {
  const decision = decideSearchConfirm({
    keyword: searchTerm.value,
    localSearchEnabled: props.localSearchEnabled,
    matchCount: props.matchCount,
  })
  if (decision === 'open-local')
    emits('openLocal')
  else
    handleSearchClick()
}

function handleKeydown(event: KeyboardEvent) {
  const decision = decideSearchKey({
    key: event.key,
    isComposing: event.isComposing,
    keyCode: event.keyCode,
    localSearchEnabled: props.localSearchEnabled,
    matchCount: props.matchCount,
  })
  if (decision.type === 'ignore')
    return
  event.preventDefault()
  if (decision.type === 'move')
    emits('moveMatch', decision.delta)
  else if (decision.type === 'confirm')
    handleConfirm()
  else
    handleClearSearchTerm()
}

function handleItemSearch(event?: Event) {
  const value = event?.target instanceof HTMLInputElement ? event.target.value : searchTerm.value
  searchTerm.value = value
  emits('itemSearch', value)
}

function handleClearSearchTerm() {
  searchTerm.value = ''
  emits('itemSearch', searchTerm.value)
}

function formMessage(error: SearchConfigError | ''): string {
  if (error === 'title')
    return t('deskModule.searchBox.engineErrorTitle')
  if (error === 'protocol')
    return t('deskModule.searchBox.engineErrorProtocol')
  if (error === 'duplicate' || error === 'limit')
    return t('deskModule.searchBox.engineErrorDuplicate')
  if (error === 'builtin')
    return t('deskModule.searchBox.engineErrorBuiltin')
  return ''
}

function beginEdit(engine: SearchEngineRecord) {
  if (engine.builtin)
    return
  editingId.value = engine.id
  draftTitle.value = engine.title
  draftUrl.value = engine.url
  formError.value = ''
}

function cancelEdit() {
  editingId.value = null
  draftTitle.value = ''
  draftUrl.value = ''
  formError.value = ''
}

function submitDraft() {
  const result = editingId.value
    ? updateCustomEngine(config.value, editingId.value, draftTitle.value, draftUrl.value)
    : addCustomEngine(config.value, draftTitle.value, draftUrl.value)
  if (!result.ok) {
    formError.value = result.error
    return
  }
  cancelEdit()
  void persist(result.config)
}

function moveAt(index: number, delta: number) {
  void persist(moveEngine(config.value, index, delta))
}

function removeAt(engine: SearchEngineRecord) {
  const result = removeCustomEngine(config.value, engine.id)
  if (!result.ok) {
    formError.value = result.error
    return
  }
  if (editingId.value === engine.id)
    cancelEdit()
  void persist(result.config)
}

function onNewWindow(checked: boolean) {
  void persist({ ...config.value, newWindowOpen: checked })
}

onMounted(() => {
  moduleConfig.getValueByNameFromCloud<unknown>(moduleConfigName).then(({ code, data }) => {
    config.value = normalizeSearchConfig(code === 0 ? data : null)
  }).catch(() => {
    config.value = normalizeSearchConfig(null)
  })
})
</script>

<template>
  <div class="search-box w-full">
    <div class="search-container flex rounded-2xl items-center justify-center w-full" :style="{ background, color: textColor }" :class="{ focused: isFocused }">
      <button
        type="button"
        class="search-box-btn-engine flex items-center justify-center gap-1"
        :class="canEdit ? 'cursor-pointer' : 'cursor-default'"
        :title="current.title"
        :aria-label="current.title"
        :aria-expanded="canEdit ? searchSelectListShow : undefined"
        @click="handleEngineClick"
      >
        <img v-if="engineIcon(current)" class="engine-mark" :src="engineIcon(current)" alt="">
        <span v-else class="engine-letter">{{ engineLetter(current) }}</span>
        <SvgIcon
          v-if="canEdit"
          class="engine-chevron"
          :class="{ 'is-open': searchSelectListShow }"
          icon="lucide:chevron-down"
        />
      </button>

      <input ref="searchInput" v-model="searchTerm" :placeholder="$t('deskModule.searchBox.inputPlaceholder')" :aria-keyshortcuts="localSearchEnabled ? 'ArrowUp ArrowDown Enter Escape' : 'Enter Escape'" @focus="onFocus" @blur="onBlur" @input="handleItemSearch" @keydown="handleKeydown">

      <button
        v-if="searchTerm !== ''"
        type="button"
        class="search-box-btn-clear"
        :aria-label="$t('common.clear')"
        @click="handleClearSearchTerm"
      >
        <SvgIcon class="w-[17px] h-[17px]" icon="lucide:x" />
      </button>
      <kbd v-else-if="!isFocused" class="leon-search-kbd" aria-hidden="true">/</kbd>
      <button
        type="button"
        class="search-box-btn-search"
        :aria-label="$t('common.search')"
        @click="handleSearchClick"
      >
        <SvgIcon class="w-[18px] h-[18px]" icon="lucide:search" />
      </button>
    </div>

    <div v-if="searchSelectListShow" class="leon-search-popover w-full mt-[10px] p-[12px]" :style="{ background, color: textColor }">
      <div
        v-for="(item, index) in config.engines"
        :key="item.id"
        class="engine-row"
        :class="{ 'is-current': item.id === current.id }"
      >
        <button type="button" class="engine-pick" :title="item.title" @click="handleEngineUpdate(item)">
          <img v-if="engineIcon(item)" class="engine-mark" :src="engineIcon(item)" alt="">
          <span v-else class="engine-letter">{{ engineLetter(item) }}</span>
          <span class="engine-title">{{ item.title }}</span>
        </button>
        <button type="button" class="engine-icon-btn" :disabled="index === 0" :title="$t('deskModule.searchBox.engineUp')" :aria-label="$t('deskModule.searchBox.engineUp')" @click="moveAt(index, -1)">
          <SvgIcon icon="lucide:chevron-up" />
        </button>
        <button type="button" class="engine-icon-btn" :disabled="index === config.engines.length - 1" :title="$t('deskModule.searchBox.engineDown')" :aria-label="$t('deskModule.searchBox.engineDown')" @click="moveAt(index, 1)">
          <SvgIcon icon="lucide:chevron-down" />
        </button>
        <button v-if="!item.builtin" type="button" class="engine-icon-btn" :title="$t('deskModule.searchBox.engineEdit')" :aria-label="$t('deskModule.searchBox.engineEdit')" @click="beginEdit(item)">
          <SvgIcon icon="lucide:pencil" />
        </button>
        <button v-if="!item.builtin" type="button" class="engine-icon-btn is-danger" :title="$t('deskModule.searchBox.engineDelete')" :aria-label="$t('deskModule.searchBox.engineDelete')" @click="removeAt(item)">
          <SvgIcon icon="lucide:trash-2" />
        </button>
      </div>

      <div class="engine-form">
        <div class="engine-form-fields">
          <input v-model="draftTitle" :placeholder="$t('deskModule.searchBox.engineTitle')">
          <input v-model="draftUrl" placeholder="https://example.com/search?q=%s" spellcheck="false">
        </div>
        <div class="engine-form-actions mt-2">
          <button type="button" class="engine-action is-primary" @click="submitDraft">
            {{ editingId ? $t('deskModule.searchBox.engineSave') : $t('deskModule.searchBox.engineAdd') }}
          </button>
          <button v-if="editingId" type="button" class="engine-action" @click="cancelEdit">
            {{ $t('deskModule.searchBox.engineCancel') }}
          </button>
        </div>
        <p v-if="formError" class="engine-error">
          {{ formMessage(formError) }}
        </p>
        <p class="engine-help">
          {{ $t('deskModule.searchBox.engineHelp') }}
        </p>
      </div>

      <div class="mt-[10px] pt-[10px] border-t border-white/10">
        <NCheckbox :checked="config.newWindowOpen" @update:checked="onNewWindow">
          <span :style="{ color: textColor }">
            {{ $t('deskModule.searchBox.openWithNewOpen') }}
          </span>
        </NCheckbox>
      </div>
    </div>
    <p v-if="isFocused && localSearchEnabled" class="leon-search-hint">
      {{ $t('deskModule.searchBox.keyboardHint') }}
    </p>
  </div>
</template>

<style scoped>
.search-container {
  border: var(--leon-card-border-width, 1px) solid var(--leon-search-border, #ccc);
  border-radius: var(--leon-card-radius, 12px);
  box-shadow: var(--leon-card-shadow, none);
  transition: box-shadow 0.18s ease, backdrop-filter 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
  padding: 2px 10px 2px 12px;
  backdrop-filter: blur(var(--leon-card-blur, 8px));
  flex-wrap: nowrap;
}

.focused, .search-container:hover {
  border-color: var(--leon-accent-color, #0ea5e9);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 18%, transparent);
}

.search-box-btn-engine {
  min-width: 44px;
  height: 32px;
  padding: 0 6px 0 2px;
  margin-right: 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  flex-shrink: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.search-box-btn-engine:hover {
  background: rgba(148, 163, 184, 0.12);
}

.search-box-btn-clear,
.search-box-btn-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.search-box-btn-clear {
  margin-right: 4px;
}

.search-box-btn-clear:hover,
.search-box-btn-search:hover {
  opacity: 1;
  background: rgba(148, 163, 184, 0.14);
}

.engine-chevron {
  width: 14px;
  height: 14px;
  opacity: 0.65;
  flex-shrink: 0;
  transition: transform 0.18s ease, opacity 0.15s ease;
}

.search-box-btn-engine:hover .engine-chevron {
  opacity: 1;
}

.engine-chevron.is-open {
  transform: rotate(180deg);
  opacity: 1;
}

.leon-search-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  margin-right: 6px;
  padding: 0 6px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--leon-search-border, rgba(148, 163, 184, 0.4));
  border-radius: 6px;
  opacity: 0.6;
  pointer-events: none;
}

@media (max-width: 640px), (hover: none) {
  .leon-search-kbd {
    display: none;
  }
}

.leon-search-popover {
  border: var(--leon-card-border-width, 1px) solid var(--leon-search-border, #ccc);
  border-radius: var(--leon-card-radius, 12px);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(var(--leon-card-blur, 8px));
}

input {
  background-color: transparent;
  box-sizing: border-box;
  width: auto;
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 8px 6px;
  border: none;
  outline: none;
  font-size: 15px;
  color: inherit;
}

input::placeholder {
  color: var(--leon-search-placeholder, rgba(255, 255, 255, 0.72));
}

.engine-row,
.engine-form-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.engine-row {
  padding: 5px 6px;
  margin-bottom: 4px;
  border-radius: 8px;
  transition: background-color 0.14s ease;
}

.engine-row:hover,
.engine-row.is-current {
  background: rgba(148, 163, 184, 0.12);
}

.engine-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
}

.engine-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engine-mark,
.engine-letter {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.engine-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--leon-search-badge-bg, #f4f4f5);
  border: 1px solid var(--leon-search-border, rgba(148, 163, 184, 0.55));
  color: var(--leon-search-text, #0f172a);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.engine-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.14s ease, background-color 0.14s ease, border-color 0.14s ease;
}

.engine-icon-btn:hover:not(:disabled) {
  opacity: 1;
  background: rgba(148, 163, 184, 0.16);
  border-color: var(--leon-search-border, rgba(148, 163, 184, 0.3));
}

.engine-icon-btn.is-danger:hover:not(:disabled) {
  color: #ef4444;
}

.engine-icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.engine-action {
  border: 1px solid var(--leon-search-border, rgba(148, 163, 184, 0.38));
  background: transparent;
  color: inherit;
  border-radius: 7px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.engine-action.is-primary {
  background: var(--leon-accent-color, #0ea5e9);
  border-color: var(--leon-accent-color, #0ea5e9);
  color: #ffffff;
}

.engine-action:disabled {
  opacity: 0.4;
  cursor: default;
}

.engine-form {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.engine-form-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.engine-form input {
  display: block;
  width: 100%;
  height: 34px;
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid var(--leon-search-border, rgba(148, 163, 184, 0.38));
  border-radius: 8px;
}

.engine-form input:focus {
  border-color: var(--leon-accent-color, #0ea5e9);
}

.engine-help,
.engine-error {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.78;
}

.engine-error {
  opacity: 1;
  color: #f87171;
}
</style>
