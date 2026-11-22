<script setup lang="ts">
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

defineProps<Prop>()
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
          class="leon-monitor-progress-value shrink-0 whitespace-nowrap tabular-nums text-[10px] sm:text-[11px]"
          :title="infoCardRightText"
        >
          {{ infoCardRightText }}
        </span>
      </div>
      <div class="leon-monitor-progress-bar w-full">
        <NProgress
          type="line"
          :color="progressColor"
          :rail-color="progressRailColor"
          :height="progressHeight"
          :percentage="percentage"
          :show-indicator="false"
          :stroke-width="15"
          class="w-full"
        />
      </div>
    </div>
  </template>
  <template v-else>
    <div class="w-full flex justify-center h-full w-full mt-3">
      <NProgress
        :color="progressColor"
        :rail-color="progressRailColor"
        type="dashboard"
        :percentage="percentage" :stroke-width="15"
        style="width: 50px;"
      >
        <div class="text-white" style="font-size: 8px;" :style="{ color: textColor }">
          {{ percentage }}%
        </div>
      </NProgress>
    </div>
  </template>
</template>
