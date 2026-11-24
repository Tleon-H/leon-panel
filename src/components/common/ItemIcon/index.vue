<script setup lang="ts">
import { Icon, loadIcon } from '@iconify/vue'
import { NAvatar } from 'naive-ui'
import { computed, ref, watch, withDefaults } from 'vue'
import SvgIcon from '../SvgIcon/index.vue'
import { t } from '@/locales'
import {
  computeDynamicVectorSize,
  computeIconImagePadding,
  computeMonogramBackground,
  isBundledLocalIcon,
  normalizeLocalIconKey,
  resolveIconImageFit,
} from '@/utils/icon/localIcons'
import {
  type RemoteIconPhase,
  createRemoteIconController,
  fallbackLabel,
  isRemoteIconType,
  rejectAfter,
} from '@/utils/icon/remoteIcon'
import { isLegacyDefaultCardBackground, resolveIconForegroundColor } from '@/utils/panel/appearance'

interface Prop {
  itemIcon?: Panel.ItemIcon | null
  size?: number // 默认70
  forceBackground?: string // 强制背景色
  foregroundColor?: string // 图标文字 / Iconify / 回退字母前景色
  fallbackText?: string
}

const props = withDefaults(defineProps<Prop>(), { size: 70 })
const defaultBackground = '#2a2a2a6b'
const phase = ref<RemoteIconPhase>('loading')
const requestSerial = ref(0)
const iconController = createRemoteIconController(() => ({
  itemType: props.itemIcon?.itemType,
  src: props.itemIcon?.src,
  text: props.itemIcon?.text,
}))
const defaultStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
const imageFit = computed(() => resolveIconImageFit(props.itemIcon?.imageFit))
const isFullBleedImage = computed(() => imageFit.value === 'cover')
const vectorSizePx = computed(() => `${computeDynamicVectorSize(props.size)}px`)
const imagePaddingPx = computed(() => `${computeIconImagePadding(props.size, imageFit.value)}px`)
const rawBackgroundColor = computed(() => (props.forceBackground ?? props.itemIcon?.backgroundColor) || defaultBackground)
const isBundledLocal = computed(() => props.itemIcon?.itemType === 3 && isBundledLocalIcon(props.itemIcon?.text))
const normalizedLocalIcon = computed(() => normalizeLocalIconKey(props.itemIcon?.text))
const letter = computed(() => fallbackLabel(props.itemIcon?.itemType, props.itemIcon?.text, props.fallbackText))
const monogramFontSizePx = computed(() => `${Math.max(13, Math.round(props.size * 0.42))}px`)
const fallbackAvatarBackground = computed(() => {
  // Always keep a readable solid surface when an image fails to load so the fallback monogram stays legible
  if (props.itemIcon?.itemType === 2) {
    if (!isLegacyDefaultCardBackground(props.itemIcon?.backgroundColor) && props.itemIcon?.backgroundColor !== 'transparent' && props.itemIcon?.backgroundColor !== '#00000000')
      return props.itemIcon?.backgroundColor as string
    return computeMonogramBackground(props.fallbackText || letter.value)
  }
  if (props.forceBackground && props.forceBackground !== 'transparent')
    return props.forceBackground
  if (!isLegacyDefaultCardBackground(props.itemIcon?.backgroundColor))
    return props.itemIcon?.backgroundColor as string
  if (props.forceBackground === 'transparent')
    return 'transparent'
  return computeMonogramBackground(props.fallbackText || letter.value)
})
const avatarStyle = computed(() => ({
  backgroundColor: rawBackgroundColor.value,
  color: props.foregroundColor || resolveIconForegroundColor(rawBackgroundColor.value),
  fontSize: monogramFontSizePx.value,
  fontWeight: 600,
  letterSpacing: '-0.02em',
}))
const fallbackAvatarStyle = computed(() => ({
  backgroundColor: fallbackAvatarBackground.value,
  color: fallbackAvatarBackground.value === 'transparent'
    ? (props.foregroundColor || '#f8fafc')
    : resolveIconForegroundColor(fallbackAvatarBackground.value),
  fontSize: monogramFontSizePx.value,
  fontWeight: 600,
  letterSpacing: '-0.02em',
}))
const imageBoxStyle = computed(() => ({
  ...defaultStyle.value,
  backgroundColor: isFullBleedImage.value ? 'transparent' : rawBackgroundColor.value,
  padding: imagePaddingPx.value,
}))
const remoteKey = computed(() => {
  if (!isRemoteIconType(props.itemIcon?.itemType))
    return ''
  if (props.itemIcon?.itemType === 2)
    return `image:${props.itemIcon.src || ''}`
  return `icon:${props.itemIcon?.text || ''}`
})
const showImage = computed(() => props.itemIcon?.itemType === 2 && phase.value !== 'fallback' && !!props.itemIcon.src)
const showLocalIcon = computed(() => isBundledLocal.value && !!normalizedLocalIcon.value)
const showOnlineIcon = computed(() => props.itemIcon?.itemType === 3 && !isBundledLocal.value && phase.value === 'ready' && !!props.itemIcon.text)

watch(remoteKey, () => {
  const next = iconController.sync()
  phase.value = next.phase
  requestSerial.value = next.requestId
  if (!next.shouldLoadIcon)
    return
  if (isBundledLocal.value) {
    phase.value = iconController.onIconLoad('success', next.requestId)
    return
  }
  const name = props.itemIcon?.text?.trim()
  if (name)
    loadOnlineIcon(name, next.requestId)
}, { immediate: true })

async function loadOnlineIcon(name: string, serial: number) {
  try {
    await Promise.race([
      loadIcon(name),
      rejectAfter(8000),
    ])
    phase.value = iconController.onIconLoad('success', serial)
  }
  catch {
    phase.value = iconController.onIconLoad('error', serial)
  }
}

function eventRequestId(event: Event): number {
  const raw = (event.currentTarget as HTMLElement | null)?.dataset.request
  const id = Number(raw)
  return Number.isFinite(id) ? id : -1
}

function onImgLoad(event: Event) {
  phase.value = iconController.onImageEvent('success', eventRequestId(event))
}

function onImgError(event: Event) {
  phase.value = iconController.onImageEvent('error', eventRequestId(event))
}
</script>

<template>
  <div class="item-icon" :style="defaultStyle" :data-image-fit="itemIcon?.itemType === 2 ? imageFit : undefined">
    <slot>
      <template v-if="itemIcon">
        <template v-if="itemIcon.itemType === 1">
          <NAvatar :size="props.size" :style="avatarStyle">
            {{ itemIcon.text }}
          </NAvatar>
        </template>

        <template v-else-if="showImage">
          <div
            :style="imageBoxStyle"
            class="leon-icon-img-box flex justify-center items-center overflow-hidden box-border"
          >
            <img
              :key="requestSerial"
              :data-request="requestSerial"
              :src="itemIcon.src"
              :alt="fallbackText || letter"
              :class="isFullBleedImage ? 'w-full h-full object-cover block' : 'w-full h-full object-contain block'"
              @load="onImgLoad"
              @error="onImgError"
            >
          </div>
        </template>

        <template v-else-if="showLocalIcon">
          <NAvatar :size="props.size" :style="avatarStyle">
            <SvgIcon :icon="normalizedLocalIcon" :style="{ width: vectorSizePx, height: vectorSizePx }" />
          </NAvatar>
        </template>

        <template v-else-if="showOnlineIcon">
          <NAvatar :size="props.size" :style="avatarStyle">
            <Icon :style="{ fontSize: vectorSizePx }" :icon="itemIcon.text || ''" />
          </NAvatar>
        </template>

        <template v-else>
          <NAvatar :size="props.size" :title="t('iconItem.iconLoadFailed')" :style="fallbackAvatarStyle">
            {{ letter }}
          </NAvatar>
        </template>
      </template>

      <template v-else>
        <NAvatar :size="props.size" :style="avatarStyle" />
      </template>
    </slot>
  </div>
</template>
