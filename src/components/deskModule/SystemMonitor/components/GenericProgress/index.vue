<script setup lang="ts">
import { computed } from 'vue'
import { NProgress } from 'naive-ui'
import { PanelPanelConfigStyleEnum } from '@/enums'

interface Prop {
  textColor: string
  progressColor: string
  progressRailColor: string
  progressHeight?: number
  percentage: number
  cardTypeStyle: PanelPanelConfigStyleEnum
  infoCardLeftText?: string
  infoCardRightText?: string
}

const props = defineProps<Prop>()

const resolvedProgressColor = computed(() => {
  if (props.percentage >= 85)
    return '#ef4444'
  if (props.percentage >= 65)
    return '#f59e0b'
  return props.progressColor
})
</script>

<template>
  <template v-if="cardTypeStyle === PanelPanelConfigStyleEnum.info">
    <div class="leon-monitor-progress w-full min-w-0 flex flex-col gap-1.5">
      <div
        class="leon-monitor-progress-header flex items-baseline justify-between gap-1 min-w-0 text-xs leading-tight"
        :style="{ color: textColor }"
      >
        <span class="leon-monitor-progress-label font-semibold truncate min-w-0" :title="infoCardLeftText">
          {{ infoCardLeftText }}
        </span>
        <span
          class="leon-monitor-progress-value shrink-0 whitespace-nowrap font-mono tabular-nums text-[10px] sm:text-[11px] opacity-85"
          :title="infoCardRightText"
        >
          {{ infoCardRightText }}
        </span>
      </div>
      <div class="leon-monitor-progress-bar w-full">
        <NProgress
          type="line"
          :color="resolvedProgressColor"
          :rail-color="progressRailColor"
          :height="progressHeight || 6"
          :percentage="percentage"
          :show-indicator="false"
          :stroke-width="15"
          class="w-full"
        />
      </div>
    </div>
  </template>
  <template v-else>
    <div class="w-full flex justify-center h-full mt-3">
      <NProgress
        :color="resolvedProgressColor"
        :rail-color="progressRailColor"
        type="dashboard"
        :percentage="percentage"
        :stroke-width="14"
        style="width: 50px;"
      >
        <div class="font-mono tabular-nums font-semibold" style="font-size: 9px;" :style="{ color: textColor }">
          {{ percentage }}%
        </div>
      </NProgress>
    </div>
  </template>
</template>
