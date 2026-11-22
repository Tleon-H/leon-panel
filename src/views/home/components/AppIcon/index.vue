<script setup lang="ts">
import { computed } from 'vue'
import { NEllipsis } from 'naive-ui'
import { ItemIcon } from '@/components/common'
import { PanelPanelConfigStyleEnum } from '@/enums'
import { usePanelState } from '@/store'
import { resolveCardAppearance, resolveHomepageThemeVars, resolveIconBadgeBackgroundColor, resolveIconForegroundColor, resolveSmallIconBackgroundColor, resolveSmallTitleColor } from '@/utils/panel/appearance'

interface Prop {
  itemInfo?: Panel.ItemInfo
  size?: number // 默认70
  forceBackground?: string // 强制背景色
  iconTextColor?: string
  iconTextInfoHideDescription: boolean
  iconTextIconHideTitle: boolean
  style: PanelPanelConfigStyleEnum
}

const props = withDefaults(defineProps<Prop>(), {
  size: 70,
})

const panelState = usePanelState()

const effectiveConfig = computed(() => ({
  ...panelState.activePanelConfig,
  iconTextColor: props.iconTextColor ?? panelState.activePanelConfig.iconTextColor,
}))

const homepageTheme = computed(() => resolveHomepageThemeVars(effectiveConfig.value))
const cardAppearance = computed(() => resolveCardAppearance(effectiveConfig.value, props.itemInfo?.icon))
const infoIconBackground = computed(() => resolveIconBadgeBackgroundColor(effectiveConfig.value, props.itemInfo?.icon))
const iconForegroundColor = computed(() => resolveIconForegroundColor(infoIconBackground.value, homepageTheme.value.canvasFallback))
const smallIconBackground = computed(() => resolveSmallIconBackgroundColor(effectiveConfig.value, props.itemInfo?.icon, props.forceBackground))
const smallIconForegroundColor = computed(() => resolveIconForegroundColor(smallIconBackground.value, homepageTheme.value.canvasFallback))

const infoCardStyle = computed(() => ({
  background: cardAppearance.value.backgroundColor,
  borderColor: cardAppearance.value.borderColor,
  borderRadius: cardAppearance.value.borderRadius,
  backdropFilter: cardAppearance.value.backdropFilter,
  WebkitBackdropFilter: cardAppearance.value.backdropFilter,
}))

const smallIconTileStyle = computed(() => ({
  borderRadius: cardAppearance.value.borderRadius,
  borderColor: cardAppearance.value.borderColor,
  backdropFilter: cardAppearance.value.backdropFilter,
  WebkitBackdropFilter: cardAppearance.value.backdropFilter,
}))

const smallItemForceBackground = computed(() => {
  if (props.forceBackground)
    return props.forceBackground
  return cardAppearance.value.hasCustomBackground ? undefined : cardAppearance.value.backgroundColor
})

const smallTitleColor = computed(() => resolveSmallTitleColor(effectiveConfig.value))

const iconBadgeClass = computed(() => {
  if (cardAppearance.value.hasCustomBackground)
    return 'leon-icon-badge-default'
  const badge = effectiveConfig.value.iconBadgeStyle || 'default'
  return `leon-icon-badge-${badge}`
})

const isMonochromeIcons = computed(() => !!effectiveConfig.value.iconMonochrome)
const isBauhausBadge = computed(() => !cardAppearance.value.hasCustomBackground && effectiveConfig.value.iconBadgeStyle === 'bauhaus')
</script>

<template>
  <div class="app-icon w-full" :class="{ 'leon-icon-monochrome': isMonochromeIcons }">
    <!-- 详情图标 -->
    <div
      v-if="style === PanelPanelConfigStyleEnum.info"
      class="app-icon-info leon-themed-card relative w-full rounded-2xl transition-all duration-200 flex"
      :class="{
        'leon-card-light': cardAppearance.isLightSurface,
        'leon-card-no-shadow': !cardAppearance.useTextShadow,
      }"
      :style="infoCardStyle"
    >
      <span class="leon-card-corner" aria-hidden="true" />
      <!-- 图标 -->
      <div class="app-icon-info-icon w-[70px] h-[70px] shrink-0">
        <div class="w-[70px] h-full flex items-center justify-center">
          <div class="leon-icon-badge" :class="iconBadgeClass">
            <ItemIcon
              :item-icon="itemInfo?.icon"
              :fallback-text="itemInfo?.title"
              force-background="transparent"
              :foreground-color="iconForegroundColor"
              :size="46"
              :class="isBauhausBadge ? 'overflow-hidden rounded-none' : 'overflow-hidden rounded-xl'"
            />
          </div>
        </div>
      </div>

      <!-- 文字 -->
      <div
        class="flex items-center min-w-0 flex-1 pr-3"
        :style="{ color: cardAppearance.textColor, maxWidth: 'calc(100% - 76px)' }"
      >
        <div class="app-icon-info-text-box w-full min-w-0">
          <div class="app-icon-info-text-box-title font-semibold w-full">
            <NEllipsis>
              {{ itemInfo?.title }}
            </NEllipsis>
          </div>
          <div
            v-if="!iconTextInfoHideDescription"
            class="app-icon-info-text-box-description"
            :style="{ color: cardAppearance.secondaryTextColor }"
          >
            <NEllipsis :line-clamp="2" class="text-xs">
              {{ itemInfo?.description }}
            </NEllipsis>
          </div>
        </div>
      </div>
    </div>

    <!-- 极简(小)图标（APP） -->
    <div v-if="style === PanelPanelConfigStyleEnum.icon" class="app-icon-small min-w-0 w-full">
      <div
        class="app-icon-small-icon leon-themed-small-tile flex items-center justify-center overflow-hidden rounded-2xl w-[70px] h-[70px] mx-auto transition-all duration-200"
        :class="iconBadgeClass"
        :style="smallIconTileStyle"
        :title="itemInfo?.description || itemInfo?.title"
      >
        <ItemIcon
          :item-icon="itemInfo?.icon"
          :fallback-text="itemInfo?.title"
          :force-background="smallItemForceBackground"
          :foreground-color="smallIconForegroundColor"
        />
      </div>
      <div
        v-if="!iconTextIconHideTitle"
        class="app-icon-small-title text-center app-icon-text-shadow cursor-pointer mt-[4px]"
        :style="{ color: smallTitleColor }"
        :title="itemInfo?.title"
      >
        <span>{{ itemInfo?.title }}</span>
      </div>
    </div>
  </div>
</template>
