<script setup lang="ts">
// -------------------
// 系统监控图标临时使用（与 AppIcon/index.vue 一致）
// 如果确定这种方案将 AppIcon/index.vue 封装成通用组件
// -------------------

import { ref } from 'vue'
import { ItemCard, SvgIcon } from '@/components/common'
import type { PanelPanelConfigStyleEnum } from '@/enums'

interface Prop {
//   size?: number // 默认70
  extendParam?: any
  iconTextColor?: string
  iconTextIconHideTitle?: boolean
  iconText?: string
  textColor?: string
  cardTypeStyle: PanelPanelConfigStyleEnum
  // monitorType: string
  icon?: string
  class?: string
  backgroundColor?: string
}

const props = withDefaults(defineProps<Prop>(), {})
const propClass = ref(props.class)
</script>

<template>
  <div class="generic-monitor-card w-full">
    <ItemCard
      :card-type-style="cardTypeStyle"
      :icon-text="iconText"
      :icon-text-color="iconTextColor"
      :class="propClass"
      :background-color="backgroundColor"
      :icon-text-icon-hide-title="iconTextIconHideTitle"
    >
      <template #info>
        <!-- 图标 -->
        <div class="w-[42px] sm:w-[60px] h-[70px] shrink-0">
          <div class="w-full h-full flex items-center justify-center text-white">
            <slot name="icon">
              <SvgIcon :icon="icon ?? ''" class="text-[24px] sm:text-[30px]" :style="{ color: textColor }" />
            </slot>
          </div>
        </div>

        <div class="flex-1 min-w-0 pr-2.5 sm:pr-3 text-white flex items-center">
          <slot name="info" />
        </div>
      </template>
      <template #small>
        <slot name="small" />
      </template>
    </ItemCard>
  </div>
</template>
