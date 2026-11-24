<script setup lang="ts">
import { computed } from 'vue'
import { MonitorType } from '../typings'
import type { CardStyle } from '../typings'
import GenericMonitorCard from '../components/GenericMonitorCard/index.vue'
import CardCPU from './CPU.vue'
import Memory from './Memory.vue'
import Disk from './Disk.vue'
import { SvgIcon } from '@/components/common'
import { PanelPanelConfigStyleEnum } from '@/enums'
import { usePanelState } from '@/store'
import { isLegacyDefaultCardBackground, resolveHomepageThemeVars } from '@/utils/panel/appearance'

interface Prop {
  extendParam?: any
  iconTextColor?: string
  iconTextIconHideTitle: boolean
  cardTypeStyle: PanelPanelConfigStyleEnum
  monitorType: string
  cardStyle: CardStyle
}

const props = withDefaults(defineProps<Prop>(), {})
const panelState = usePanelState()
const homepageTheme = computed(() => resolveHomepageThemeVars(panelState.activePanelConfig))

const usesThemeSurface = computed(() => isLegacyDefaultCardBackground(props.extendParam?.backgroundColor))
const isDefaultLightInk = computed(() => {
  const c = props.extendParam?.color?.trim().toLowerCase()
  return !c || c === '#fff' || c === '#ffffff'
})
const effectiveTextColor = computed(() => {
  if (usesThemeSurface.value && isDefaultLightInk.value)
    return homepageTheme.value.card.defaultTextColor
  return props.extendParam?.color || homepageTheme.value.card.defaultTextColor
})
const effectiveProgressColor = computed(() => {
  const c = props.extendParam?.progressColor?.trim().toLowerCase()
  if (usesThemeSurface.value && (!c || c === '#fff' || c === '#ffffff'))
    return homepageTheme.value.card.accentColor
  return props.extendParam?.progressColor || homepageTheme.value.card.accentColor
})
const effectiveRailColor = computed(() => {
  const c = props.extendParam?.progressRailColor?.trim().toLowerCase()
  if (usesThemeSurface.value && (!c || c === '#cfcfcfa8'))
    return homepageTheme.value.isLightCard ? 'rgba(9, 9, 11, 0.14)' : 'rgba(255, 255, 255, 0.18)'
  return props.extendParam?.progressRailColor || 'rgba(207, 207, 207, 0.5)'
})

const iconText = computed(() => {
  switch (props.monitorType) {
    case MonitorType.cpu:
      return 'CPU'
    case MonitorType.disk:
      return props.extendParam.path
    case MonitorType.memory:
      return 'RAM'
  }
  return ''
})
const refreshInterval = 5000
</script>

<template>
  <div class="w-full">
    <GenericMonitorCard
      :icon-text-icon-hide-title="false"
      :card-type-style="cardTypeStyle"
      :icon-text="iconText"
      :icon-text-color="iconTextColor"
      :background-color="extendParam.backgroundColor"
    >
      <template #icon>
        <!-- 图标 -->
        <div class="app-icon w-full h-full flex items-center justify-center">
          <SvgIcon v-if="monitorType === MonitorType.cpu" icon="lucide:cpu" class="text-[22px] sm:text-[26px]" :style="{ color: effectiveTextColor }" />
          <SvgIcon v-if="monitorType === MonitorType.memory" icon="lucide:memory-stick" class="text-[22px] sm:text-[26px]" :style="{ color: effectiveTextColor }" />
          <SvgIcon v-if="monitorType === MonitorType.disk" icon="lucide:hard-drive" class="text-[22px] sm:text-[26px]" :style="{ color: effectiveTextColor }" />
        </div>
      </template>
      <template #info>
        <div class="w-full min-w-0 flex items-center" :style="{ color: effectiveTextColor }">
          <CardCPU
            v-if="monitorType === MonitorType.cpu"
            :card-type-style="PanelPanelConfigStyleEnum.info"
            :progress-color="effectiveProgressColor"
            :progress-rail-color="effectiveRailColor"
            :text-color="effectiveTextColor"
            :refresh-interval="refreshInterval"
          />
          <Memory
            v-else-if="monitorType === MonitorType.memory"
            :card-type-style="PanelPanelConfigStyleEnum.info"
            :progress-color="effectiveProgressColor"
            :progress-rail-color="effectiveRailColor"
            :text-color="effectiveTextColor"
            :refresh-interval="refreshInterval"
          />
          <Disk
            v-else-if="monitorType === MonitorType.disk"
            :card-type-style="PanelPanelConfigStyleEnum.info"
            :progress-color="effectiveProgressColor"
            :progress-rail-color="effectiveRailColor"
            :text-color="effectiveTextColor"
            :path="extendParam?.path"
            :refresh-interval="refreshInterval"
          />
        </div>
      </template>
      <template #small>
        <CardCPU
          v-if="monitorType === MonitorType.cpu"
          :card-type-style="PanelPanelConfigStyleEnum.icon"
          :progress-color="effectiveProgressColor"
          :progress-rail-color="effectiveRailColor"
          :text-color="effectiveTextColor"
          :refresh-interval="refreshInterval"
        />
        <Memory
          v-else-if="monitorType === MonitorType.memory"
          :card-type-style="PanelPanelConfigStyleEnum.icon"
          :progress-color="effectiveProgressColor"
          :progress-rail-color="effectiveRailColor"
          :text-color="effectiveTextColor"
          :refresh-interval="refreshInterval"
        />
        <Disk
          v-else-if="monitorType === MonitorType.disk"
          :card-type-style="PanelPanelConfigStyleEnum.icon"
          :progress-color="effectiveProgressColor"
          :progress-rail-color="effectiveRailColor"
          :text-color="effectiveTextColor"
          :path="extendParam?.path"
          :refresh-interval="refreshInterval"
        />
      </template>
    </GenericMonitorCard>
  </div>
</template>
