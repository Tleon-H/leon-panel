<script setup lang="ts">
import { NButton, NColorPicker, NInput, NModal, NRadio, NUpload } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { computed, defineProps, ref } from 'vue'
import { ItemIcon, SvgIcon } from '@/components/common'
import OwnGallery from '@/components/apps/OwnGallery/index.vue'
import PublicGallery from '@/components/apps/PublicGallery/index.vue'
import { useAuthStore } from '@/store'
import { apiRespErrMsg } from '@/utils/request/apiMessage'
import { type HomelabIconPreset, filterHomelabPresets } from '@/utils/icon/localIcons'

const props = defineProps<{
  itemIcon: Panel.ItemIcon | null
}>()
const emit = defineEmits<{
  (e: 'update:itemIcon', visible: Panel.ItemIcon): void // 定义修改父组件（prop内）的值的事件
}>()
const authStore = useAuthStore()
const showPublicIcons = ref(false)
const showOwnIcons = ref(false)
const presetKeyword = ref('')

// 默认图标背景色（精密中性 + 高对比品牌色板）
const defautSwatchesBackground = [
  '#00000000',
  '#18181B',
  '#334155',
  '#0284C7',
  '#2563EB',
  '#0F766E',
  '#059669',
  '#D97706',
  '#EA580C',
  '#E11D48',
  '#F4F1EA',
  '#FFFFFF',
]

const filteredPresets = computed(() => filterHomelabPresets(presetKeyword.value))

const initData: Panel.ItemIcon = {
  itemType: 2,
  backgroundColor: '#2a2a2a6b',
}

const itemIconInfo = computed({
  get() {
    const v = {
      ...initData,
      ...props.itemIcon,
      backgroundColor: props.itemIcon?.backgroundColor || initData.backgroundColor,
    }
    return v
  },
  set() {
    handleChange()
  },
})

function handleIconTypeRadioChange(type: number) {
  itemIconInfo.value.itemType = type
  handleChange()
}

function handleChange() {
  emit('update:itemIcon', itemIconInfo.value || null)
}

function applyHomelabPreset(preset: HomelabIconPreset) {
  itemIconInfo.value.itemType = 3
  itemIconInfo.value.text = preset.icon
  itemIconInfo.value.backgroundColor = preset.bg
  handleChange()
}

function handleResetBackgroundColor() {
  itemIconInfo.value.backgroundColor = initData.backgroundColor
  handleChange()
}

const handleUploadFinish = ({
  file,
  event,
}: {
  file: UploadFileInfo
  event?: ProgressEvent
}) => {
  const res = JSON.parse((event?.target as XMLHttpRequest).response)
  if (res.code === 0) {
    const imageUrl = res.data.imageUrl
    itemIconInfo.value.src = imageUrl
    emit('update:itemIcon', itemIconInfo.value || null)
  }
  else {
    apiRespErrMsg(res)
  }

  return file
}

function usePublicIcon(src: string) {
  itemIconInfo.value.src = src
  emit('update:itemIcon', itemIconInfo.value || null)
  showPublicIcons.value = false
}

function useOwnIcon(src: string) {
  itemIconInfo.value.src = src
  emit('update:itemIcon', itemIconInfo.value || null)
  showOwnIcons.value = false
}
</script>

<template>
  <div>
    <div class="mb-[10px]">
      <NRadio
        :checked="itemIconInfo.itemType === 1"
        :value="1"
        name="iconType"
        @change="handleIconTypeRadioChange(1)"
      >
        {{ $t('common.text') }}
      </NRadio>

      <NRadio
        :checked="itemIconInfo.itemType === 2"
        :value="2"
        name="iconType"
        @change="handleIconTypeRadioChange(2)"
      >
        {{ $t('common.image') }}
      </NRadio>

      <NRadio
        :checked="itemIconInfo.itemType === 3"
        :value="3"
        name="iconType"
        @change="handleIconTypeRadioChange(3)"
      >
        {{ $t('iconItem.onlineIcon') }}
      </NRadio>
    </div>

    <div class="min-h-[100px]">
      <div class="flex">
        <div>
          <div class="border bg-slate-200 overflow-hidden transparent-grid" style="border-radius: var(--leon-ui-radius, 10px);">
            <ItemIcon :item-icon="itemIconInfo" />
          </div>
        </div>
        <!-- 文字 -->
        <div class="ml-[20px] flex-1 min-w-0">
          <div v-if="itemIconInfo.itemType === 1">
            <NInput v-model:value="itemIconInfo.text" class="mb-[5px]" size="small" type="text" @input="handleChange" />
          </div>

          <div v-if="itemIconInfo.itemType === 3">
            <div>
              <NInput v-model:value="itemIconInfo.text" class="mb-[6px]" size="small" type="text" :placeholder="$t('iconItem.inputIconName')" @input="handleChange" />

              <NInput
                v-model:value="presetKeyword"
                size="tiny"
                clearable
                class="mb-[6px]"
                :placeholder="$t('iconItem.searchBuiltinIcons')"
              >
                <template #prefix>
                  <SvgIcon icon="lucide:search" class="text-xs opacity-60" />
                </template>
              </NInput>

              <div class="leon-icon-preset-grid my-1.5">
                <button
                  v-for="preset in filteredPresets"
                  :key="preset.id"
                  type="button"
                  class="leon-icon-preset-btn"
                  :class="{ 'is-selected': itemIconInfo.text === preset.icon && itemIconInfo.backgroundColor === preset.bg }"
                  :title="`${preset.label} (${preset.icon})`"
                  @click="applyHomelabPreset(preset)"
                >
                  <span class="leon-icon-preset-swatch" :style="{ backgroundColor: preset.bg }">
                    <SvgIcon :icon="preset.icon" class="text-[13px] text-white" />
                  </span>
                  <span class="leon-icon-preset-label">{{ preset.label }}</span>
                </button>
              </div>

              <NButton quaternary type="info" size="small">
                <a target="_blank" rel="noopener noreferrer" href="https://icon-sets.iconify.design/">{{ $t('iconItem.onlineIconLibrary') }}</a>
              </NButton>
            </div>
          </div>

          <!-- 图片 -->
          <div v-if="itemIconInfo.itemType === 2">
            <NInput v-model:value="itemIconInfo.src" class="mb-[5px] w-full" size="small" type="text" :placeholder="$t('iconItem.inputIconUrlOrUpload')" @input="handleChange" />
            <NUpload
              action="/api/file/uploadImg"
              :show-file-list="false"
              name="imgfile"
              :data="{ category: 'icon' }"
              :headers="{
                token: authStore.token as string,
              }"
              @finish="handleUploadFinish"
            >
              <NButton size="small">
                {{ $t('iconItem.selectUpload') }}
              </NButton>
            </NUpload>
            <div class="mt-1 flex flex-wrap gap-2">
              <NButton size="small" data-testid="open-own-icons" @click="showOwnIcons = true">
                {{ $t('apps.ownGallery.open') }}
              </NButton>
              <NButton size="small" data-testid="open-public-icons" @click="showPublicIcons = true">
                {{ $t('apps.publicGallery.open') }}
              </NButton>
            </div>
            <NModal v-model:show="showOwnIcons" preset="card" :title="$t('apps.ownGallery.title')" style="width: min(720px, 96vw);">
              <OwnGallery selectable @select="useOwnIcon" />
            </NModal>
            <NModal v-model:show="showPublicIcons" preset="card" :title="$t('apps.publicGallery.appName')" style="width: min(720px, 96vw);">
              <PublicGallery locked-category="icon" selectable @select="usePublicIcon" />
            </NModal>
          </div>
        </div>
      </div>

      <div class="flex items-center mt-[10px]">
        <div class="w-auto text-slate-500 mr-[10px]">
          {{ $t('common.backgroundColor') }}
        </div>
        <div class="w-[150px] flex items-center mr-[10px]">
          <NColorPicker
            v-model:value="itemIconInfo.backgroundColor"
            size="small"
            :modes="['hex']"
            :swatches="defautSwatchesBackground"
            @complete="handleChange"
            @update-value="handleChange"
          />
        </div>
        <div v-if="itemIconInfo.backgroundColor !== initData.backgroundColor" class="w-auto text-slate-500 mr-[10px] cursor-pointer">
          <NButton quaternary type="info" @click="handleResetBackgroundColor">
            {{ $t('common.reset') }}
          </NButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transparent-grid {
  background-image: linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%),
                    linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}

.leon-icon-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 6px;
  max-height: 156px;
  overflow-y: auto;
  padding-right: 2px;
}

.leon-icon-preset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 7px;
  border: 1px solid var(--leon-ui-border, #d4d4d8);
  border-radius: var(--leon-ui-radius, 6px);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.14s ease, background-color 0.14s ease;
}

.leon-icon-preset-btn:hover,
.leon-icon-preset-btn.is-selected {
  border-color: var(--leon-ui-primary, #0ea5e9);
  background: color-mix(in srgb, var(--leon-ui-primary, #0ea5e9) 10%, transparent);
}

.leon-icon-preset-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  flex-shrink: 0;
}

.leon-icon-preset-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
