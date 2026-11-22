<script setup lang="ts">
import { computed, ref } from 'vue'
import { PanelPanelConfigStyleEnum } from '@/enums'
import { isLegacyDefaultCardBackground } from '@/utils/panel/appearance'

interface Prop {
  cardTypeStyle: PanelPanelConfigStyleEnum
  class?: string
  backgroundColor?: string
  iconTextIconHideTitle?: boolean // 隐藏小图标标题
  iconTextColor?: string // 小图标文字颜色
  iconText?: string // 小图标文字
}

const props = withDefaults(defineProps<Prop>(), {})

const propClass = ref(props.class)
const surfaceStyle = computed(() => {
  const usesThemeSurface = isLegacyDefaultCardBackground(props.backgroundColor)
  return {
    backgroundColor: usesThemeSurface ? 'var(--leon-card-bg, #2a2a2a6b)' : props.backgroundColor,
    borderRadius: 'var(--leon-card-radius, 16px)',
    borderColor: usesThemeSurface ? 'var(--leon-card-border, transparent)' : 'rgba(255, 255, 255, 0.16)',
    backdropFilter: usesThemeSurface ? 'blur(var(--leon-card-blur, 0px))' : 'none',
    WebkitBackdropFilter: usesThemeSurface ? 'blur(var(--leon-card-blur, 0px))' : 'none',
  }
})
</script>

<template>
  <div class="item-card w-full">
    <!-- 详情图标 -->
    <div
      v-if="cardTypeStyle === PanelPanelConfigStyleEnum.info"
      class="item-card-info leon-themed-card w-full transition-all duration-200 flex"
      :class="propClass"
      :style="surfaceStyle"
    >
      <slot name="info" />
    </div>

    <!-- 极简图标（APP） -->
    <div
      v-if="cardTypeStyle === PanelPanelConfigStyleEnum.icon"
      class="item-card-small min-w-0 w-full"
    >
      <div
        class="item-card-small-icon leon-themed-small-tile overflow-hidden w-[70px] h-[70px] mx-auto transition-all duration-200"
        :class="propClass"
        :style="surfaceStyle"
      >
        <slot name="small" />
      </div>

      <div
        v-if="!iconTextIconHideTitle"
        class="item-card-small-title text-center app-icon-text-shadow cursor-pointer mt-[4px]"
        :style="{ color: iconTextColor }"
        :title="iconText"
      >
        {{ iconText }}
      </div>
    </div>
  </div>
</template>
