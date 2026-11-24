<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SvgIcon } from '@/components/common'
import { VisitMode } from '@/enums/auth'
import { t } from '@/locales'
import { useAuthStore, useStudioStore } from '@/store'
import {
  type DesktopCountdownEntry,
  type DesktopWidgetItem,
  MAX_TODO_ITEMS,
  computeCountdownDays,
  sanitizeWidgetUrl,
} from '@/utils/studio/studioConfig'

const studioStore = useStudioStore()
const authStore = useAuthStore()

const canEdit = computed(() => authStore.visitMode === VisitMode.VISIT_MODE_LOGIN)
const enabledWidgets = computed(() => studioStore.config.widgets.filter(item => item.enabled))

const now = ref(new Date())
const iframeReloadTick = ref<Record<string, number>>({})
const todoDrafts = ref<Record<string, string>>({})
let timer: ReturnType<typeof setInterval> | null = null
let syncSaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleCloudSync(delayMs = 450) {
  if (!canEdit.value)
    return
  if (syncSaveTimer)
    clearTimeout(syncSaveTimer)
  syncSaveTimer = setTimeout(() => {
    syncSaveTimer = null
    studioStore.saveStudioConfig()
  }, delayMs)
}

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
  widget.content = (event.target as HTMLTextAreaElement).value
  scheduleCloudSync(500)
}

function todoStats(widget: DesktopWidgetItem) {
  const items = widget.todoItems || []
  const done = items.filter(i => i.done).length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0
  return { done, total: items.length, pct }
}

function addTodoItem(widget: DesktopWidgetItem) {
  if (!canEdit.value)
    return
  const text = (todoDrafts.value[widget.id] || '').trim().slice(0, 140)
  if (!text)
    return
  if (!Array.isArray(widget.todoItems))
    widget.todoItems = []
  if (widget.todoItems.length >= MAX_TODO_ITEMS)
    return
  widget.todoItems.push({
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    done: false,
  })
  todoDrafts.value[widget.id] = ''
  scheduleCloudSync(200)
}

function toggleTodoItem(widget: DesktopWidgetItem, itemId: string) {
  if (!canEdit.value || !widget.todoItems)
    return
  const item = widget.todoItems.find(i => i.id === itemId)
  if (!item)
    return
  item.done = !item.done
  scheduleCloudSync(200)
}

function removeTodoItem(widget: DesktopWidgetItem, itemId: string) {
  if (!canEdit.value || !widget.todoItems)
    return
  widget.todoItems = widget.todoItems.filter(i => i.id !== itemId)
  scheduleCloudSync(200)
}

function countdownMeta(entry: DesktopCountdownEntry) {
  const days = computeCountdownDays(entry.targetDate, now.value)
  if (days === null) {
    return {
      days: null,
      tone: 'muted',
      badge: '--',
    }
  }
  if (days < 0) {
    return {
      days,
      tone: 'danger',
      badge: t('apps.leonStudio.countdownOverdue', { days: Math.abs(days) }),
    }
  }
  if (days === 0) {
    return {
      days,
      tone: 'danger',
      badge: t('apps.leonStudio.countdownToday'),
    }
  }
  if (days <= 7) {
    return {
      days,
      tone: 'warn',
      badge: t('apps.leonStudio.countdownDaysLeft', { days }),
    }
  }
  return {
    days,
    tone: 'ok',
    badge: t('apps.leonStudio.countdownDaysLeft', { days }),
  }
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
  if (syncSaveTimer) {
    clearTimeout(syncSaveTimer)
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
      :data-widget-type="widget.type"
    >
      <header class="leon-widget-header">
        <div class="leon-widget-title-wrap">
          <span class="leon-widget-code">W{{ idx + 1 }}</span>
          <span class="leon-widget-title">{{ widget.title || widget.type.toUpperCase() }}</span>
        </div>

        <span
          v-if="widget.type === 'todo'"
          class="leon-widget-stat-pill"
        >
          {{ todoStats(widget).done }}/{{ todoStats(widget).total }}
        </span>

        <div v-else-if="widget.type === 'iframe' && safeIframeSrc(widget)" class="flex items-center gap-1.5">
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

      <!-- 待办清单小组件 -->
      <div v-if="widget.type === 'todo'" class="leon-widget-todo">
        <div class="leon-todo-progress" aria-hidden="true">
          <div class="leon-todo-progress-fill" :style="{ width: `${todoStats(widget).pct}%` }" />
        </div>

        <div v-if="canEdit" class="leon-todo-add-row">
          <input
            v-model="todoDrafts[widget.id]"
            type="text"
            class="leon-todo-add-input"
            data-testid="todo-add-input"
            :placeholder="$t('apps.leonStudio.todoAddPlaceholder')"
            @keydown.enter.prevent="addTodoItem(widget)"
          >
          <button
            type="button"
            class="leon-todo-add-btn"
            :title="$t('common.add')"
            @click="addTodoItem(widget)"
          >
            <SvgIcon icon="lucide:plus" />
          </button>
        </div>

        <div v-if="(widget.todoItems || []).length === 0" class="leon-widget-empty">
          {{ $t('apps.leonStudio.todoEmpty') }}
        </div>

        <ul v-else class="leon-todo-list">
          <li
            v-for="item in widget.todoItems"
            :key="item.id"
            class="leon-todo-item"
            :class="{ 'is-done': item.done }"
          >
            <button
              type="button"
              class="leon-todo-check"
              :class="{ 'is-done': item.done }"
              :disabled="!canEdit"
              data-testid="todo-item-toggle"
              @click="toggleTodoItem(widget, item.id)"
            >
              <SvgIcon v-if="item.done" icon="lucide:check" class="text-[11px]" />
            </button>
            <span class="leon-todo-text">{{ item.text }}</span>
            <button
              v-if="canEdit"
              type="button"
              class="leon-todo-del"
              :title="$t('common.delete')"
              @click="removeTodoItem(widget, item.id)"
            >
              <SvgIcon icon="lucide:x" class="text-[12px]" />
            </button>
          </li>
        </ul>
      </div>

      <!-- 续期倒计时小组件 -->
      <div v-else-if="widget.type === 'countdown'" class="leon-widget-countdown">
        <div v-if="(widget.countdownEntries || []).length === 0" class="leon-widget-empty">
          {{ $t('apps.leonStudio.countdownEmpty') }}
        </div>

        <!-- 单条聚焦视图 -->
        <div
          v-else-if="(widget.countdownEntries || []).length === 1"
          class="leon-countdown-hero"
          data-testid="countdown-entry"
        >
          <div class="leon-countdown-hero-top">
            <span class="leon-countdown-hero-label">{{ widget.countdownEntries![0].label }}</span>
            <span
              class="leon-countdown-badge"
              :class="`is-${countdownMeta(widget.countdownEntries![0]).tone}`"
            >
              {{ countdownMeta(widget.countdownEntries![0]).badge }}
            </span>
          </div>
          <div class="leon-countdown-hero-num">
            {{ countdownMeta(widget.countdownEntries![0]).days === null ? '--' : Math.abs(countdownMeta(widget.countdownEntries![0]).days!) }}
            <span class="leon-countdown-hero-unit">{{ $t('apps.leonStudio.countdownDayUnit') }}</span>
          </div>
          <div class="leon-countdown-date">
            <SvgIcon icon="lucide:calendar" class="text-[12px] opacity-75" />
            <span>{{ widget.countdownEntries![0].targetDate || '--' }}</span>
          </div>
        </div>

        <!-- 多条续期列表视图 -->
        <ul v-else class="leon-countdown-list">
          <li
            v-for="entry in widget.countdownEntries"
            :key="entry.id"
            class="leon-countdown-row"
            data-testid="countdown-entry"
          >
            <div class="min-w-0 flex-1">
              <div class="leon-countdown-row-label">
                {{ entry.label }}
              </div>
              <div class="leon-countdown-row-date">
                {{ entry.targetDate || '--' }}
              </div>
            </div>
            <span
              class="leon-countdown-badge shrink-0"
              :class="`is-${countdownMeta(entry).tone}`"
            >
              {{ countdownMeta(entry).badge }}
            </span>
          </li>
        </ul>
      </div>

      <!-- 增强几何时钟小组件 -->
      <div v-else-if="widget.type === 'clock'" class="leon-widget-clock">
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
  border-radius: var(--leon-card-radius, 12px);
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

.leon-widget-stat-pill {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 14%, transparent);
  color: var(--leon-accent-color, #0ea5e9);
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

/* Todo Widget */
.leon-widget-todo {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leon-todo-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--leon-card-border, rgba(148, 163, 184, 0.22));
  overflow: hidden;
}

.leon-todo-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--leon-accent-color, #10b981);
  transition: width 0.24s ease;
}

.leon-todo-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.leon-todo-add-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 9px;
  border-radius: 8px;
  border: 1px solid var(--leon-card-border, rgba(148, 163, 184, 0.28));
  background: transparent;
  color: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.14s ease;
}

.leon-todo-add-input:focus {
  border-color: var(--leon-accent-color, #0ea5e9);
}

.leon-todo-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid var(--leon-card-border, rgba(148, 163, 184, 0.28));
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 12%, transparent);
  color: var(--leon-accent-color, #0ea5e9);
  cursor: pointer;
}

.leon-todo-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 168px;
  overflow-y: auto;
}

.leon-todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 7px;
  transition: background-color 0.14s ease;
}

.leon-todo-item:hover {
  background: rgba(148, 163, 184, 0.08);
}

.leon-todo-check {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 5px;
  border: 1.5px solid var(--leon-card-border, rgba(148, 163, 184, 0.48));
  background: transparent;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.14s ease;
}

.leon-todo-check.is-done {
  border-color: var(--leon-accent-color, #10b981);
  background: var(--leon-accent-color, #10b981);
}

.leon-todo-text {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  line-height: 1.35;
  word-break: break-word;
}

.leon-todo-item.is-done .leon-todo-text {
  text-decoration: line-through;
  opacity: 0.52;
}

.leon-todo-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.45;
  cursor: pointer;
  transition: opacity 0.14s ease, background-color 0.14s ease;
}

.leon-todo-del:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.14);
  color: #ef4444;
}

/* Countdown Widget */
.leon-widget-countdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leon-countdown-hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.leon-countdown-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.leon-countdown-hero-label {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-countdown-hero-num {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.leon-countdown-hero-unit {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.72;
  margin-left: 2px;
}

.leon-countdown-date {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11.5px;
  color: var(--leon-card-text-secondary, #94a3b8);
}

.leon-countdown-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.leon-countdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.08);
}

.leon-countdown-row-label {
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-countdown-row-date {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  opacity: 0.65;
}

.leon-countdown-badge {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.leon-countdown-badge.is-ok {
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 16%, transparent);
  color: var(--leon-accent-color, #0ea5e9);
}

.leon-countdown-badge.is-warn {
  background: rgba(245, 158, 11, 0.18);
  color: #d97706;
}

.leon-countdown-badge.is-danger {
  background: rgba(239, 68, 68, 0.18);
  color: #ef4444;
}

.leon-countdown-badge.is-muted {
  background: rgba(148, 163, 184, 0.18);
  opacity: 0.7;
}

/* Clock Widget */
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
  padding: 14px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--leon-card-text-secondary, #94a3b8);
}
</style>
