<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { SvgIcon } from '@/components/common'
import { VisitMode } from '@/enums/auth'
import { t } from '@/locales'
import { useAuthStore, useStudioStore } from '@/store'
import {
  type DesktopCountdownEntry,
  type DesktopWidgetItem,
  type DesktopWidgetType,
  MAX_TODO_ITEMS,
  computeCountdownDays,
  sanitizeWidgetUrl,
} from '@/utils/studio/studioConfig'

const props = withDefaults(defineProps<{
  editMode?: boolean
}>(), {
  editMode: false,
})

const studioStore = useStudioStore()
const authStore = useAuthStore()

const canEdit = computed(() => authStore.visitMode === VisitMode.VISIT_MODE_LOGIN)

const enabledWidgets = computed<DesktopWidgetItem[]>({
  get: () => studioStore.config.widgets.filter(item => item.enabled),
  set: (reorderedEnabled) => {
    const disabled = studioStore.config.widgets.filter(item => !item.enabled)
    studioStore.config.widgets = [...reorderedEnabled, ...disabled]
  },
})

const now = ref(new Date())
const iframeReloadTick = ref<Record<string, number>>({})
const todoDrafts = ref<Record<string, string>>({})
const memoSyncing = ref<Record<string, boolean>>({})
let timer: ReturnType<typeof setInterval> | null = null
let syncSaveTimer: ReturnType<typeof setTimeout> | null = null

const WEEKDAY_KEYS = [
  'deskModule.clock.sun',
  'deskModule.clock.mon',
  'deskModule.clock.tue',
  'deskModule.clock.wed',
  'deskModule.clock.thu',
  'deskModule.clock.fri',
  'deskModule.clock.sat',
] as const

const WIDGET_META: Record<DesktopWidgetType, { icon: string; accent: string }> = {
  todo: { icon: 'lucide:check', accent: '#10b981' },
  countdown: { icon: 'lucide:calendar', accent: '#f59e0b' },
  clock: { icon: 'lucide:gauge', accent: '#0ea5e9' },
  memo: { icon: 'lucide:notebook-pen', accent: '#6366f1' },
  iframe: { icon: 'lucide:code-2', accent: '#06b6d4' },
}

function widgetMeta(type: DesktopWidgetType) {
  return WIDGET_META[type] || WIDGET_META.clock
}

function scheduleCloudSync(delayMs = 450, widgetId?: string) {
  if (!canEdit.value || props.editMode)
    return
  if (widgetId)
    memoSyncing.value = { ...memoSyncing.value, [widgetId]: true }
  if (syncSaveTimer)
    clearTimeout(syncSaveTimer)
  syncSaveTimer = setTimeout(() => {
    syncSaveTimer = null
    studioStore.saveStudioConfig().finally(() => {
      if (widgetId)
        memoSyncing.value = { ...memoSyncing.value, [widgetId]: false }
    })
  }, delayMs)
}

function toggleWidgetSpan(widget: DesktopWidgetItem) {
  widget.colSpan = widget.colSpan === 2 ? 1 : 2
}

function removeWidgetById(widgetId: string) {
  studioStore.config.widgets = studioStore.config.widgets.filter(item => item.id !== widgetId)
}

function moveWidgetStep(index: number, delta: number) {
  const list = [...enabledWidgets.value]
  const target = index + delta
  if (target < 0 || target >= list.length)
    return
  const [moved] = list.splice(index, 1)
  list.splice(target, 0, moved)
  enabledWidgets.value = list
}

function clockParts(widget: DesktopWidgetItem) {
  const d = now.value
  let hours = d.getHours()
  let period = ''
  if (widget.use24Hour === false) {
    period = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
  }
  const hh = String(hours).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return {
    hm: `${hh}:${mm}`,
    ss,
    period,
    showSeconds: widget.showSeconds !== false,
  }
}

function analogAngles() {
  const d = now.value
  const seconds = d.getSeconds()
  const minutes = d.getMinutes() + seconds / 60
  const hours = (d.getHours() % 12) + minutes / 60
  return {
    hourDeg: hours * 30,
    minuteDeg: minutes * 6,
    secondDeg: seconds * 6,
  }
}

function dayProgressPct(): number {
  const d = now.value
  const totalSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
  return Math.min(100, Math.max(0, Math.round((totalSec / 86400) * 100)))
}

function formatWidgetDateLine() {
  const d = now.value
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekday = t(WEEKDAY_KEYS[d.getDay()])
  return `${y}-${m}-${day} · ${weekday}`
}

function handleMemoInput(widget: DesktopWidgetItem, event: Event) {
  if (!canEdit.value)
    return
  widget.content = (event.target as HTMLTextAreaElement).value
  scheduleCloudSync(500, widget.id)
}

function todoStats(widget: DesktopWidgetItem) {
  const items = widget.todoItems || []
  const done = items.filter(i => i.done).length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0
  const circumference = 2 * Math.PI * 10
  const dashOffset = circumference * (1 - pct / 100)
  return { done, total: items.length, pct, circumference, dashOffset }
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
      gaugePct: 0,
    }
  }
  if (days < 0) {
    return {
      days,
      tone: 'danger',
      badge: t('apps.leonStudio.countdownOverdue', { days: Math.abs(days) }),
      gaugePct: 100,
    }
  }
  if (days === 0) {
    return {
      days,
      tone: 'danger',
      badge: t('apps.leonStudio.countdownToday'),
      gaugePct: 100,
    }
  }
  if (days <= 7) {
    return {
      days,
      tone: 'warn',
      badge: t('apps.leonStudio.countdownDaysLeft', { days }),
      gaugePct: Math.max(70, Math.round(((30 - days) / 30) * 100)),
    }
  }
  const pct = Math.min(92, Math.max(12, Math.round(((90 - Math.min(90, days)) / 90) * 100)))
  return {
    days,
    tone: 'ok',
    badge: t('apps.leonStudio.countdownDaysLeft', { days }),
    gaugePct: pct,
  }
}

function extractIframeHost(raw?: string): string {
  const safe = sanitizeWidgetUrl(raw)
  if (!safe)
    return ''
  if (safe.startsWith('/'))
    return safe
  try {
    return new URL(safe).host
  }
  catch {
    return safe
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
    if (canEdit.value && !props.editMode)
      studioStore.saveStudioConfig()
  }
})
</script>

<template>
  <section
    v-if="enabledWidgets.length > 0"
    class="leon-section"
    :class="{ 'leon-widgets-editing': editMode }"
    data-testid="desktop-widgets"
  >
    <VueDraggable
      v-model="enabledWidgets"
      item-key="id"
      :animation="260"
      :disabled="!editMode"
      filter=".leon-widget-edit-ctl"
      :prevent-on-filter="false"
      ghost-class="leon-drag-ghost"
      chosen-class="leon-drag-chosen"
      class="leon-widgets-grid"
    >
      <article
        v-for="(widget, widgetIdx) in enabledWidgets"
        :key="widget.id"
        class="leon-widget-card leon-themed-card"
        :class="[
          widget.colSpan === 2 ? 'leon-widget-span-2' : '',
          editMode ? 'is-edit-mode cursor-move' : '',
        ]"
        :style="{ '--w-accent': widgetMeta(widget.type).accent }"
        :data-widget-id="widget.id"
        :data-widget-type="widget.type"
      >
        <!-- 桌面编辑模式角标（删除、前后排序 & 切换 1x/2x 宽度） -->
        <div v-if="editMode" class="leon-widget-edit-overlay">
          <button
            type="button"
            class="leon-edit-badge-del leon-widget-edit-ctl"
            data-testid="desktop-widget-delete"
            :title="$t('common.delete')"
            :aria-label="$t('common.delete')"
            @click.stop="removeWidgetById(widget.id)"
          >
            <SvgIcon icon="lucide:x" class="text-[11px]" />
          </button>
          <div class="leon-widget-edit-right">
            <button
              type="button"
              class="leon-widget-span-btn leon-widget-edit-ctl"
              :disabled="widgetIdx === 0"
              data-testid="desktop-widget-move-prev"
              :title="$t('deskModule.searchBox.engineUp')"
              @click.stop="moveWidgetStep(widgetIdx, -1)"
            >
              <SvgIcon icon="lucide:chevron-up" class="text-[11px]" />
            </button>
            <button
              type="button"
              class="leon-widget-span-btn leon-widget-edit-ctl"
              :disabled="widgetIdx === enabledWidgets.length - 1"
              data-testid="desktop-widget-move-next"
              :title="$t('deskModule.searchBox.engineDown')"
              @click.stop="moveWidgetStep(widgetIdx, 1)"
            >
              <SvgIcon icon="lucide:chevron-down" class="text-[11px]" />
            </button>
            <button
              type="button"
              class="leon-widget-span-btn leon-widget-edit-ctl"
              data-testid="desktop-widget-span"
              :title="$t('panelHome.editModeToggleWidth')"
              @click.stop="toggleWidgetSpan(widget)"
            >
              {{ widget.colSpan === 2 ? '2×' : '1×' }}
            </button>
            <span class="leon-widget-drag-pill" aria-hidden="true">
              <SvgIcon icon="lucide:grip-vertical" class="text-[12px]" />
            </span>
          </div>
        </div>

        <header class="leon-widget-header">
          <div class="leon-widget-title-wrap">
            <span class="leon-widget-emblem" aria-hidden="true">
              <SvgIcon :icon="widgetMeta(widget.type).icon" class="text-[13px]" />
            </span>
            <span class="leon-widget-title">{{ widget.title || widget.type.toUpperCase() }}</span>
          </div>

          <!-- Todo 环形完成度 -->
          <div v-if="widget.type === 'todo'" class="leon-todo-ring-wrap">
            <svg class="leon-todo-ring" viewBox="0 0 26 26" aria-hidden="true">
              <circle class="leon-todo-ring-track" cx="13" cy="13" r="10" />
              <circle
                class="leon-todo-ring-fill"
                cx="13"
                cy="13"
                r="10"
                :stroke-dasharray="todoStats(widget).circumference"
                :stroke-dashoffset="todoStats(widget).dashOffset"
              />
            </svg>
            <span class="leon-widget-stat-text">
              {{ todoStats(widget).done }}/{{ todoStats(widget).total }}
            </span>
          </div>

          <!-- Clock 日进度徽章 -->
          <span v-else-if="widget.type === 'clock'" class="leon-widget-subtle-pill">
            DAY {{ dayProgressPct() }}%
          </span>

          <!-- Countdown 条目计数 -->
          <span v-else-if="widget.type === 'countdown' && (widget.countdownEntries || []).length > 1" class="leon-widget-subtle-pill">
            {{ widget.countdownEntries!.length }}
          </span>

          <!-- Memo 字数 & 状态 -->
          <span v-else-if="widget.type === 'memo'" class="leon-widget-subtle-pill">
            <span class="leon-status-dot" :class="{ 'is-syncing': memoSyncing[widget.id] }" />
            {{ (widget.content || '').length }}
          </span>

          <!-- Iframe 工具栏 -->
          <div v-else-if="widget.type === 'iframe' && safeIframeSrc(widget)" class="flex items-center gap-1.5 min-w-0">
            <span class="leon-iframe-host">
              <span class="leon-status-dot" />
              {{ extractIframeHost(widget.url) }}
            </span>
            <button
              type="button"
              class="leon-widget-icon-btn"
              :title="$t('common.refresh')"
              @click.stop="reloadIframe(widget.id)"
            >
              <SvgIcon icon="lucide:refresh-cw" />
            </button>
            <a
              :href="safeIframeSrc(widget)"
              target="_blank"
              rel="noopener noreferrer"
              class="leon-widget-icon-btn"
              :title="widget.title"
              @click.stop
            >
              <SvgIcon icon="lucide:external-link" />
            </a>
          </div>
        </header>

        <!-- ==================== 待办清单小组件 ==================== -->
        <div v-if="widget.type === 'todo'" class="leon-widget-todo">
          <div v-if="canEdit && !editMode" class="leon-todo-add-row">
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
              :class="{ 'has-text': Boolean((todoDrafts[widget.id] || '').trim()) }"
              :title="$t('common.add')"
              @click="addTodoItem(widget)"
            >
              <SvgIcon icon="lucide:plus" />
            </button>
          </div>

          <div v-if="(widget.todoItems || []).length === 0" class="leon-widget-empty">
            <SvgIcon icon="lucide:check" class="text-base opacity-40 mb-1" />
            <span>{{ $t('apps.leonStudio.todoEmpty') }}</span>
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
                :disabled="!canEdit || editMode"
                data-testid="todo-item-toggle"
                @click="toggleTodoItem(widget, item.id)"
              >
                <SvgIcon v-if="item.done" icon="lucide:check" class="text-[11px]" />
              </button>
              <span class="leon-todo-text">{{ item.text }}</span>
              <button
                v-if="canEdit && !editMode"
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

        <!-- ==================== 续期倒计时小组件 ==================== -->
        <div v-else-if="widget.type === 'countdown'" class="leon-widget-countdown">
          <div v-if="(widget.countdownEntries || []).length === 0" class="leon-widget-empty">
            <SvgIcon icon="lucide:calendar" class="text-base opacity-40 mb-1" />
            <span>{{ $t('apps.leonStudio.countdownEmpty') }}</span>
          </div>

          <!-- 单条聚焦卡片视图 -->
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

            <div class="leon-countdown-hero-body">
              <div class="leon-countdown-hero-num">
                {{ countdownMeta(widget.countdownEntries![0]).days === null ? '--' : Math.abs(countdownMeta(widget.countdownEntries![0]).days!) }}
                <span class="leon-countdown-hero-unit">{{ $t('apps.leonStudio.countdownDayUnit') }}</span>
              </div>
              <div class="leon-countdown-date">
                <SvgIcon icon="lucide:calendar" class="text-[12px] opacity-70" />
                <span>{{ widget.countdownEntries![0].targetDate || '--' }}</span>
              </div>
            </div>

            <div class="leon-countdown-meter" aria-hidden="true">
              <div
                class="leon-countdown-meter-fill"
                :class="`is-${countdownMeta(widget.countdownEntries![0]).tone}`"
                :style="{ width: `${countdownMeta(widget.countdownEntries![0]).gaugePct}%` }"
              />
            </div>
          </div>

          <!-- 多条续期清单视图 -->
          <ul v-else class="leon-countdown-list">
            <li
              v-for="entry in widget.countdownEntries"
              :key="entry.id"
              class="leon-countdown-row"
              :class="`is-${countdownMeta(entry).tone}`"
              data-testid="countdown-entry"
            >
              <span class="leon-countdown-row-bar" aria-hidden="true" />
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

        <!-- ==================== 精工表盘 + 数字时钟小组件 ==================== -->
        <div v-else-if="widget.type === 'clock'" class="leon-widget-clock">
          <div class="leon-clock-stage">
            <!-- 极简瑞士表盘 SVG -->
            <div class="leon-analog-dial" aria-hidden="true">
              <svg viewBox="0 0 64 64" class="leon-analog-svg">
                <circle cx="32" cy="32" r="29" class="leon-dial-face" />
                <line
                  v-for="tick in 12"
                  :key="tick"
                  x1="32"
                  :y1="tick % 3 === 0 ? 5.5 : 7"
                  x2="32"
                  y2="10.5"
                  :class="tick % 3 === 0 ? 'leon-dial-tick-major' : 'leon-dial-tick'"
                  :transform="`rotate(${tick * 30} 32 32)`"
                />
                <line
                  x1="32"
                  y1="32"
                  x2="32"
                  y2="17"
                  class="leon-dial-hour"
                  :transform="`rotate(${analogAngles().hourDeg} 32 32)`"
                />
                <line
                  x1="32"
                  y1="32"
                  x2="32"
                  y2="11.5"
                  class="leon-dial-minute"
                  :transform="`rotate(${analogAngles().minuteDeg} 32 32)`"
                />
                <line
                  v-if="clockParts(widget).showSeconds"
                  x1="32"
                  y1="36"
                  x2="32"
                  y2="9.5"
                  class="leon-dial-second"
                  :transform="`rotate(${analogAngles().secondDeg} 32 32)`"
                />
                <circle cx="32" cy="32" r="2.2" class="leon-dial-pivot" />
              </svg>
            </div>

            <div class="leon-clock-digital">
              <div class="leon-widget-clock-time">
                <span class="leon-clock-hm">{{ clockParts(widget).hm }}</span>
                <span v-if="clockParts(widget).showSeconds" class="leon-clock-sec">:{{ clockParts(widget).ss }}</span>
                <span v-if="clockParts(widget).period" class="leon-clock-period">{{ clockParts(widget).period }}</span>
              </div>
              <div class="leon-widget-clock-meta">
                <span>{{ formatWidgetDateLine() }}</span>
              </div>
              <div v-if="widget.subtitle" class="leon-clock-subtitle">
                {{ widget.subtitle }}
              </div>
            </div>
          </div>

          <div class="leon-clock-daybar" aria-hidden="true">
            <div class="leon-clock-daybar-fill" :style="{ width: `${dayProgressPct()}%` }" />
          </div>
        </div>

        <!-- ==================== 工作室云端便签小组件 ==================== -->
        <div v-else-if="widget.type === 'memo'" class="leon-widget-memo">
          <div class="leon-memo-paper">
            <textarea
              :value="widget.content || ''"
              :readonly="!canEdit || editMode"
              :placeholder="$t('apps.leonStudio.widgetMemoPlaceholder')"
              rows="4"
              class="leon-widget-memo-input"
              @input="(e) => handleMemoInput(widget, e)"
            />
          </div>
        </div>

        <!-- ==================== 自由 Iframe 视口小组件 ==================== -->
        <div v-else-if="widget.type === 'iframe'" class="leon-widget-iframe-wrap">
          <iframe
            v-if="safeIframeSrc(widget)"
            :key="`${widget.id}-${iframeReloadTick[widget.id] || 0}`"
            :src="safeIframeSrc(widget)"
            :title="widget.title || 'Widget'"
            :style="{ height: `${widget.height || 240}px`, pointerEvents: editMode ? 'none' : 'auto' }"
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
    </VueDraggable>
  </section>
</template>

<style scoped>
.leon-widgets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(278px, 1fr));
  gap: 18px;
}

.leon-widget-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  min-height: 172px;
  background: var(--leon-card-bg, #ffffff);
  border-radius: var(--leon-card-radius, 16px);
  backdrop-filter: blur(var(--leon-card-blur, 10px));
  -webkit-backdrop-filter: blur(var(--leon-card-blur, 10px));
  color: var(--leon-card-text, #09090b);
  box-shadow:
    var(--leon-card-shadow, 0 4px 20px rgba(15, 23, 42, 0.08)),
    inset 0 1px 0 rgba(255, 255, 255, 0.09);
  background-image: radial-gradient(
    180px circle at 96% 4%,
    color-mix(in srgb, var(--w-accent, var(--leon-accent-color, #0ea5e9)) 11%, transparent) 0%,
    transparent 74%
  );
  transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.18s ease, border-color 0.18s ease;
}

.leon-widget-card.is-edit-mode {
  border-style: dashed !important;
  border-color: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 62%, transparent) !important;
  overflow: visible !important;
}

.leon-widget-span-2 {
  grid-column: span 2;
}

@media (max-width: 720px) {
  .leon-widget-span-2 {
    grid-column: span 1;
  }
}

.leon-widget-edit-overlay {
  position: absolute;
  top: -10px;
  left: -8px;
  right: -8px;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.leon-widget-edit-right {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  pointer-events: auto;
}

.leon-edit-badge-del {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid var(--leon-card-bg, #ffffff);
  background: #ef4444;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(239, 68, 68, 0.35);
  transition: transform 0.14s ease;
}

.leon-edit-badge-del:hover {
  transform: scale(1.1);
}

.leon-widget-span-btn,
.leon-widget-drag-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.36);
  background: rgba(15, 23, 42, 0.88);
  color: #f8fafc;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(2, 6, 23, 0.28);
}

.leon-widget-span-btn:hover:not(:disabled) {
  background: var(--leon-accent-color, #0ea5e9);
  border-color: var(--leon-accent-color, #0ea5e9);
}

.leon-widget-span-btn:disabled {
  opacity: 0.36;
  cursor: not-allowed;
}

.leon-widget-drag-pill {
  padding: 0 6px;
  cursor: grab;
}

.leon-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.leon-widget-title-wrap {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.leon-widget-emblem {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--w-accent, var(--leon-accent-color, #0ea5e9)) 16%, transparent);
  color: var(--w-accent, var(--leon-accent-color, #0ea5e9));
}

.leon-widget-title {
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
  opacity: 0.88;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-widget-subtle-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: rgba(148, 163, 184, 0.13);
  color: var(--leon-card-text-secondary, #94a3b8);
  flex-shrink: 0;
}

.leon-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #10b981;
  flex-shrink: 0;
}

.leon-status-dot.is-syncing {
  background: #f59e0b;
}

.leon-iframe-host {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 150px;
  padding: 2px 8px;
  border-radius: 999px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10.5px;
  background: rgba(148, 163, 184, 0.12);
  color: var(--leon-card-text-secondary, #94a3b8);
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
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.07);
  color: inherit;
  cursor: pointer;
  font-size: 12.5px;
  transition: border-color 0.14s ease, color 0.14s ease, background-color 0.14s ease;
}

.leon-widget-icon-btn:hover {
  border-color: var(--w-accent, var(--leon-accent-color, #0ea5e9));
  color: var(--w-accent, var(--leon-accent-color, #0ea5e9));
  background: color-mix(in srgb, var(--w-accent, #0ea5e9) 12%, transparent);
}

/* ==================== Todo Widget ==================== */
.leon-todo-ring-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.leon-todo-ring {
  width: 22px;
  height: 22px;
  transform: rotate(-90deg);
}

.leon-todo-ring-track {
  fill: none;
  stroke: rgba(148, 163, 184, 0.22);
  stroke-width: 2.6;
}

.leon-todo-ring-fill {
  fill: none;
  stroke: var(--w-accent, #10b981);
  stroke-width: 2.6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.leon-widget-stat-text {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 600;
  color: var(--leon-card-text-secondary, #94a3b8);
}

.leon-widget-todo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.leon-todo-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px 3px 11px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.09);
  border: 1px solid rgba(148, 163, 184, 0.16);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.leon-todo-add-row:focus-within {
  border-color: color-mix(in srgb, var(--w-accent, #10b981) 65%, transparent);
  background: rgba(148, 163, 184, 0.05);
}

.leon-todo-add-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 12.5px;
  outline: none;
}

.leon-todo-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 7px;
  border: 0;
  background: rgba(148, 163, 184, 0.16);
  color: inherit;
  opacity: 0.72;
  cursor: pointer;
  transition: all 0.16s ease;
}

.leon-todo-add-btn.has-text,
.leon-todo-add-btn:hover {
  opacity: 1;
  background: var(--w-accent, #10b981);
  color: #ffffff;
}

.leon-todo-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 176px;
  overflow-y: auto;
}

.leon-todo-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 8px;
  border-radius: 9px;
  transition: background-color 0.14s ease;
}

.leon-todo-item:hover {
  background: rgba(148, 163, 184, 0.09);
}

.leon-todo-check {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1.6px solid rgba(148, 163, 184, 0.5);
  background: transparent;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}

.leon-todo-check:hover:not(:disabled) {
  border-color: var(--w-accent, #10b981);
}

.leon-todo-check.is-done {
  border-color: var(--w-accent, #10b981);
  background: var(--w-accent, #10b981);
  transform: scale(1.04);
}

.leon-todo-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
  transition: opacity 0.16s ease;
}

.leon-todo-item.is-done .leon-todo-text {
  text-decoration: line-through;
  opacity: 0.45;
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
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.14s ease, background-color 0.14s ease, color 0.14s ease;
}

.leon-todo-item:hover .leon-todo-del,
.leon-todo-del:focus-visible {
  opacity: 0.65;
}

.leon-todo-del:hover {
  opacity: 1 !important;
  background: rgba(239, 68, 68, 0.14);
  color: #ef4444;
}

/* ==================== Countdown Widget ==================== */
.leon-widget-countdown {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  flex: 1;
}

.leon-countdown-hero {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
}

.leon-countdown-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.leon-countdown-hero-label {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-countdown-hero-body {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.leon-countdown-hero-num {
  font-family: var(--leon-font-display, var(--leon-font-mono, ui-monospace, monospace));
  font-size: 42px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  line-height: 0.96;
  letter-spacing: -0.04em;
}

.leon-countdown-hero-unit {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.62;
  margin-left: 3px;
}

.leon-countdown-date {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.1);
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  color: var(--leon-card-text-secondary, #94a3b8);
}

.leon-countdown-meter {
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  overflow: hidden;
}

.leon-countdown-meter-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.leon-countdown-meter-fill.is-ok {
  background: var(--leon-accent-color, #0ea5e9);
}

.leon-countdown-meter-fill.is-warn {
  background: #f59e0b;
}

.leon-countdown-meter-fill.is-danger {
  background: #ef4444;
}

.leon-countdown-meter-fill.is-muted {
  background: rgba(148, 163, 184, 0.4);
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.08);
  transition: background-color 0.14s ease;
}

.leon-countdown-row:hover {
  background: rgba(148, 163, 184, 0.13);
}

.leon-countdown-row-bar {
  width: 3px;
  height: 26px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--leon-accent-color, #0ea5e9);
}

.leon-countdown-row.is-warn .leon-countdown-row-bar {
  background: #f59e0b;
}

.leon-countdown-row.is-danger .leon-countdown-row-bar {
  background: #ef4444;
}

.leon-countdown-row.is-muted .leon-countdown-row-bar {
  background: rgba(148, 163, 184, 0.4);
}

.leon-countdown-row-label {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-countdown-row-date {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  opacity: 0.62;
}

.leon-countdown-badge {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}

.leon-countdown-badge.is-ok {
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 15%, transparent);
  color: var(--leon-accent-color, #0ea5e9);
}

.leon-countdown-badge.is-warn {
  background: rgba(245, 158, 11, 0.16);
  color: #d97706;
}

.leon-countdown-badge.is-danger {
  background: rgba(239, 68, 68, 0.16);
  color: #ef4444;
}

.leon-countdown-badge.is-muted {
  background: rgba(148, 163, 184, 0.16);
  opacity: 0.7;
}

/* ==================== Clock Widget (Dial + Editorial Digital) ==================== */
.leon-widget-clock {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  flex: 1;
}

.leon-clock-stage {
  display: flex;
  align-items: center;
  gap: 16px;
}

.leon-analog-dial {
  width: 68px;
  height: 68px;
  flex-shrink: 0;
}

.leon-analog-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.leon-dial-face {
  fill: rgba(148, 163, 184, 0.08);
  stroke: rgba(148, 163, 184, 0.26);
  stroke-width: 1.4;
}

.leon-dial-tick {
  stroke: currentColor;
  stroke-opacity: 0.28;
  stroke-width: 1.1;
  stroke-linecap: round;
}

.leon-dial-tick-major {
  stroke: currentColor;
  stroke-opacity: 0.72;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.leon-dial-hour {
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
}

.leon-dial-minute {
  stroke: currentColor;
  stroke-opacity: 0.86;
  stroke-width: 1.9;
  stroke-linecap: round;
}

.leon-dial-second {
  stroke: var(--leon-accent-color, #0ea5e9);
  stroke-width: 1.3;
  stroke-linecap: round;
}

.leon-dial-pivot {
  fill: var(--leon-accent-color, #0ea5e9);
}

.leon-clock-digital {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.leon-widget-clock-time {
  display: flex;
  align-items: baseline;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.leon-clock-hm {
  font-size: 34px;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.leon-clock-sec {
  font-size: 16px;
  font-weight: 600;
  color: var(--leon-accent-color, #0ea5e9);
  margin-left: 2px;
}

.leon-clock-period {
  font-size: 11px;
  font-weight: 700;
  margin-left: 5px;
  padding: 2px 5px;
  border-radius: 5px;
  background: rgba(148, 163, 184, 0.15);
  opacity: 0.85;
}

.leon-widget-clock-meta {
  font-size: 12px;
  font-weight: 500;
  color: var(--leon-card-text-secondary, #94a3b8);
}

.leon-clock-subtitle {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 2px;
  padding: 1px 7px;
  border-radius: 5px;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 12%, transparent);
  color: var(--leon-accent-color, #0ea5e9);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-clock-daybar {
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  overflow: hidden;
}

.leon-clock-daybar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--leon-accent-color, #0ea5e9) 55%, transparent),
    var(--leon-accent-color, #0ea5e9)
  );
  transition: width 0.4s ease;
}

/* ==================== Studio Memo Widget ==================== */
.leon-widget-memo {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.leon-memo-paper {
  flex: 1;
  display: flex;
  border-radius: 11px;
  background: rgba(148, 163, 184, 0.07);
  border: 1px solid rgba(148, 163, 184, 0.14);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.leon-memo-paper:focus-within {
  border-color: color-mix(in srgb, var(--w-accent, var(--leon-accent-color, #0ea5e9)) 58%, transparent);
  background: rgba(148, 163, 184, 0.04);
}

.leon-widget-memo-input {
  width: 100%;
  resize: vertical;
  min-height: 104px;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.62;
  outline: none;
}

/* ==================== Iframe Widget ==================== */
.leon-widget-iframe-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.leon-widget-iframe {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 11px;
  background: rgba(15, 23, 42, 0.08);
}

.leon-widget-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 18px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--leon-card-text-secondary, #94a3b8);
}
</style>
