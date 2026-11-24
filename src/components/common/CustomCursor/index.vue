<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStudioStore } from '@/store'
import type { CursorPresetId } from '@/utils/studio/modularStyle'

const studioStore = useStudioStore()

const isCoarsePointer = ref(false)
const visible = ref(false)
const isInteractive = ref(false)
const isPressed = ref(false)

const dotRef = ref<HTMLElement | null>(null)
const ringRef = ref<HTMLElement | null>(null)

let targetX = -200
let targetY = -200
let ringX = -200
let ringY = -200
let rafId: number | null = null
let activeListeners = false

const activePreset = computed<CursorPresetId>(() => {
  if (studioStore.safeMode || studioStore.config.effects.reduceMotion || isCoarsePointer.value)
    return 'system'
  return studioStore.config.modular?.cursorPreset || 'system'
})

const needsOverlay = computed(() =>
  activePreset.value === 'precision-dot'
  || activePreset.value === 'spotlight-aura'
  || activePreset.value === 'neon-ring',
)

const INTERACTIVE_SELECTOR = 'a, button, [role="link"], [role="button"], input, textarea, select, label, .leon-card-item, .leon-themed-card, .leon-themed-small-tile, .leon-hover-demo-card'

function tick() {
  ringX += (targetX - ringX) * 0.22
  ringY += (targetY - ringY) * 0.22

  if (dotRef.value)
    dotRef.value.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`
  if (ringRef.value)
    ringRef.value.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`

  const dist = Math.hypot(targetX - ringX, targetY - ringY)
  if (dist > 0.35 && visible.value)
    rafId = requestAnimationFrame(tick)
  else
    rafId = null
}

function scheduleTick() {
  if (rafId === null)
    rafId = requestAnimationFrame(tick)
}

function handlePointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch')
    return
  if (!visible.value) {
    ringX = e.clientX
    ringY = e.clientY
  }
  targetX = e.clientX
  targetY = e.clientY
  visible.value = true
  const target = e.target as Element | null
  isInteractive.value = Boolean(target?.closest(INTERACTIVE_SELECTOR))
  scheduleTick()
}

function handlePointerDown(e: PointerEvent) {
  if (e.pointerType === 'touch')
    return
  isPressed.value = true
}

function handlePointerUp() {
  isPressed.value = false
}

function handlePointerLeave() {
  visible.value = false
  isPressed.value = false
}

function attach() {
  if (activeListeners || typeof window === 'undefined')
    return
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointerdown', handlePointerDown, { passive: true })
  window.addEventListener('pointerup', handlePointerUp, { passive: true })
  document.addEventListener('mouseleave', handlePointerLeave)
  window.addEventListener('blur', handlePointerLeave)
  activeListeners = true
}

function detach() {
  if (!activeListeners || typeof window === 'undefined')
    return
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointerup', handlePointerUp)
  document.removeEventListener('mouseleave', handlePointerLeave)
  window.removeEventListener('blur', handlePointerLeave)
  activeListeners = false
  visible.value = false
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

watch(needsOverlay, (enabled) => {
  if (enabled)
    attach()
  else
    detach()
}, { immediate: true })

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
    isCoarsePointer.value = window.matchMedia('(hover: none), (pointer: coarse)').matches
  studioStore.applyRuntimeModularStyle()
})

onBeforeUnmount(() => {
  detach()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="needsOverlay"
      class="leon-cursor-layer"
      :class="[
        `is-${activePreset}`,
        {
          'is-visible': visible,
          'is-hovering': isInteractive,
          'is-pressed': isPressed,
        },
      ]"
      aria-hidden="true"
    >
      <div ref="ringRef" class="leon-cursor-ring" />
      <div v-if="activePreset !== 'spotlight-aura'" ref="dotRef" class="leon-cursor-dot" />
    </div>
  </Teleport>
</template>

<style scoped>
.leon-cursor-layer {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.leon-cursor-layer.is-visible {
  opacity: 1;
}

.leon-cursor-dot,
.leon-cursor-ring {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  will-change: transform;
}

/* Precision Dot + Subtle Magnetic Ring */
.is-precision-dot .leon-cursor-dot {
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 999px;
  background: var(--leon-ui-primary, var(--leon-accent-color, #0ea5e9));
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.8);
  transition: width 0.14s ease, height 0.14s ease, margin 0.14s ease, opacity 0.14s ease;
}

.is-precision-dot .leon-cursor-ring {
  width: 28px;
  height: 28px;
  margin: -14px 0 0 -14px;
  border-radius: 999px;
  border: 1.5px solid color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 55%, transparent);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 8%, transparent);
  transition: width 0.18s ease, height 0.18s ease, margin 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.is-precision-dot.is-hovering .leon-cursor-ring {
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 14%, transparent);
}

.is-precision-dot.is-pressed .leon-cursor-ring {
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
}

/* Spotlight Ambient Aura */
.is-spotlight-aura .leon-cursor-ring {
  width: 240px;
  height: 240px;
  margin: -120px 0 0 -120px;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 18%, transparent) 0%,
    color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 6%, transparent) 38%,
    transparent 70%
  );
  transition: width 0.24s ease, height 0.24s ease, margin 0.24s ease;
}

.is-spotlight-aura.is-hovering .leon-cursor-ring {
  width: 290px;
  height: 290px;
  margin: -145px 0 0 -145px;
}

/* Neon Precision Ring */
.is-neon-ring .leon-cursor-dot {
  width: 5px;
  height: 5px;
  margin: -2.5px 0 0 -2.5px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 0 8px var(--leon-ui-primary, #0ea5e9);
}

.is-neon-ring .leon-cursor-ring {
  width: 32px;
  height: 32px;
  margin: -16px 0 0 -16px;
  border-radius: 999px;
  border: 1.5px solid var(--leon-ui-primary, #0ea5e9);
  box-shadow: 0 0 14px color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 55%, transparent);
  transition: width 0.18s ease, height 0.18s ease, margin 0.18s ease, box-shadow 0.18s ease;
}

.is-neon-ring.is-hovering .leon-cursor-ring {
  width: 44px;
  height: 44px;
  margin: -22px 0 0 -22px;
  box-shadow: 0 0 22px color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 75%, transparent);
}

.is-neon-ring.is-pressed .leon-cursor-ring {
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
}

@media (hover: none), (pointer: coarse) {
  .leon-cursor-layer {
    display: none !important;
  }
}
</style>
