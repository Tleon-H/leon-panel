<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore, useStudioStore } from '@/store'
import { VisitMode } from '@/enums/auth'
import { SvgIcon } from '@/components/common'
import { type DesktopWidgetItem, sanitizeWidgetUrl } from '@/utils/studio/studioConfig'

const studioStore = useStudioStore()
const authStore = useAuthStore()

const canEdit = computed(() => authStore.visitMode === VisitMode.VISIT_MODE_LOGIN)
const enabledWidgets = computed(() => studioStore.config.widgets.filter(item => item.enabled))

const now = ref(new Date())
const iframeReloadTick = ref<Record<string, number>>({})
let timer: ReturnType<typeof setInterval> | null = null
let memoSaveTimer: ReturnType<typeof setTimeout> | null = null

function formatWidgetClock(widget: DesktopWidgetItem) {
  const d = now.value
  let hours = d.getHours()
  let suffix = ''
  if (widget.use24Hour === false) {
    suffix = hours >= 12 ? ' PM' : ' AM'
    hours = hours % 12 || 12
  }
  const hh = String(hours).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return widget.showSeconds === false ? `${hh}:${mm}${suffix}` : `${hh}:${mm}:${ss}${suffix}`
}

function formatWidgetDate() {
  const d = now.value
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function secondSegments() {
  const sec = now.value.getSeconds()
  return Math.round((sec / 59) * 12)
}

function handleMemoInput(widget: DesktopWidgetItem, event: Event) {
  if (!canEdit.value)
    return
  const value = (event.target as HTMLTextAreaElement).value
  widget.content = value
  if (memoSaveTimer)
    clearTimeout(memoSaveTimer)
  memoSaveTimer = setTimeout(() => {
    memoSaveTimer = null
    studioStore.saveStudioConfig()
  }, 500)
}

function reloadIframe(id: string) {
  iframeReloadTick.value[id] = (iframeReloadTick.value[id] || 0) + 1
}

function safeIframeSrc(widget: DesktopWidgetItem): string {
  return sanitizeWidgetUrl(widget.url)
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer)
    clearInterval(timer)
  if (memoSaveTimer) {
    clearTimeout(memoSaveTimer)
    if (canEdit.value)
      studioStore.saveStudioConfig()
  }
})
</script>

<template>
  <section
    v-if="enabledWidgets.length > 0"
    class="leon-widgets-grid leon-section"
    data-testid="desktop-widgets"
  >
    <article
      v-for="(widget, idx) in enabledWidgets"
      :key="widget.id"
      class="leon-widget-card leon-themed-card"
      :class="widget.colSpan === 2 ? 'leon-widget-span-2' : ''"
    >
      <header class="leon-widget-header">
        <div class="leon-widget-title-wrap">
          <span class="leon-widget-code">W{{ idx + 1 }}</span>
          <span class="leon-widget-title">{{ widget.title || widget.type.toUpperCase() }}</span>
        </div>
        <div v-if="widget.type === 'iframe' && safeIframeSrc(widget)" class="flex items-center gap-1.5">
          <button
            type="button"
            class="leon-widget-icon-btn"
            :title="$t('common.refresh')"
            @click="reloadIframe(widget.id)"
          >
            <SvgIcon icon="lucide:refresh-cw" />
          </button>
          <a
            :href="safeIframeSrc(widget)"
            target="_blank"
            rel="noopener noreferrer"
            class="leon-widget-icon-btn"
            :title="widget.title"
          >
            <SvgIcon icon="lucide:external-link" />
          </a>
        </div>
      </header>

      <!-- 增强几何时钟小组件 -->
      <div v-if="widget.type === 'clock'" class="leon-widget-clock">
        <div class="leon-widget-clock-time">
          {{ formatWidgetClock(widget) }}
        </div>
        <div class="leon-widget-clock-meta">
          <span>{{ formatWidgetDate() }}</span>
          <span v-if="widget.subtitle">· {{ widget.subtitle }}</span>
        </div>
        <div class="leon-widget-clock-bars" aria-hidden="true">
          <span
            v-for="seg in 12"
            :key="seg"
            class="leon-widget-clock-seg"
            :class="{ 'is-on': seg <= secondSegments() }"
          />
        </div>
      </div>

      <!-- 云端便签小组件 -->
      <div v-else-if="widget.type === 'memo'" class="leon-widget-memo">
        <textarea
          :value="widget.content || ''"
          :readonly="!canEdit"
          :placeholder="$t('apps.leonStudio.widgetMemoPlaceholder')"
          rows="4"
          class="leon-widget-memo-input"
          @input="(e) => handleMemoInput(widget, e)"
        />
      </div>

      <!-- 自由 Iframe / Widget 卡片 -->
      <div v-else-if="widget.type === 'iframe'" class="leon-widget-iframe-wrap">
        <iframe
          v-if="safeIframeSrc(widget)"
          :key="`${widget.id}-${iframeReloadTick[widget.id] || 0}`"
          :src="safeIframeSrc(widget)"
          :title="widget.title || 'Widget'"
          :style="{ height: `${widget.height || 240}px` }"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          loading="lazy"
          class="leon-widget-iframe"
          frameborder="0"
        />
        <div v-else class="leon-widget-empty">
          {{ $t('apps.leonStudio.widgetIframeInvalidUrl') }}
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.leon-widgets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.leon-widget-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: var(--leon-card-bg, #ffffff);
  border-radius: var(--leon-card-radius, 4px);
  backdrop-filter: blur(var(--leon-card-blur, 0px));
  -webkit-backdrop-filter: blur(var(--leon-card-blur, 0px));
  color: var(--leon-card-text, #09090b);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.leon-widget-span-2 {
  grid-column: span 2;
}

@media (max-width: 720px) {
  .leon-widget-span-2 {
    grid-column: span 1;
  }
}

.leon-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--leon-card-border, rgba(148, 163, 184, 0.28));
}

.leon-widget-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.leon-widget-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 6px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 700;
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 18%, transparent);
  color: var(--leon-accent-color, #0ea5e9);
}

.leon-widget-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-widget-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--leon-card-border, rgba(148, 163, 184, 0.25));
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.14s ease, color 0.14s ease, background-color 0.14s ease;
}

.leon-widget-icon-btn:hover {
  border-color: var(--leon-accent-color, #0ea5e9);
  color: var(--leon-accent-color, #0ea5e9);
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 10%, transparent);
}

.leon-widget-clock {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leon-widget-clock-time {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 30px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.leon-widget-clock-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: var(--leon-card-text-secondary, #94a3b8);
}

.leon-widget-clock-bars {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
  margin-top: 4px;
}

.leon-widget-clock-seg {
  height: 5px;
  border-radius: 999px;
  background: var(--leon-card-border, rgba(148, 163, 184, 0.24));
  transition: background-color 0.2s ease;
}

.leon-widget-clock-seg.is-on {
  background: var(--leon-accent-color, #0ea5e9);
}

.leon-widget-memo-input {
  width: 100%;
  resize: vertical;
  min-height: 92px;
  padding: 8px 10px;
  border: 1px solid var(--leon-card-border, rgba(148, 163, 184, 0.22));
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  outline: none;
  transition: border-color 0.14s ease;
}

.leon-widget-memo-input:focus {
  border-color: var(--leon-accent-color, #0ea5e9);
}

.leon-widget-iframe {
  width: 100%;
  border: 1px solid var(--leon-card-border, rgba(148, 163, 184, 0.22));
  border-radius: 8px;
  background: transparent;
}

.leon-widget-empty {
  padding: 18px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--leon-card-text-secondary, #94a3b8);
}
</style>
