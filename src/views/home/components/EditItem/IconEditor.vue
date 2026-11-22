<script setup lang="ts">
import { NButton, NColorPicker, NInput, NModal, NRadio, NUpload } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { computed, defineProps, ref } from 'vue'
import { ItemIcon, SvgIcon } from '@/components/common'
import OwnGallery from '@/components/apps/OwnGallery/index.vue'
import PublicGallery from '@/components/apps/PublicGallery/index.vue'
import { useAuthStore } from '@/store'
import { apiRespErrMsg } from '@/utils/request/apiMessage'

const props = defineProps<{
  itemIcon: Panel.ItemIcon | null
}>()
const emit = defineEmits<{
  (e: 'update:itemIcon', visible: Panel.ItemIcon): void // 定义修改父组件（prop内）的值的事件
}>()
const authStore = useAuthStore()
const showPublicIcons = ref(false)
const showOwnIcons = ref(false)

// 默认图标背景色（内置包豪斯纯平几何色板）
const defautSwatchesBackground = [
  '#00000000',
  '#09090B',
  '#F4F1EA',
  '#FFFFFF',
  '#FF4F00',
  '#2563EB',
  '#EAB308',
  '#00C2A8',
]

// 常用自托管与几何单色扁平图标快捷预设
const bauhausIconPresets = [
  { label: 'Docker', icon: 'simple-icons:docker', bg: '#2563EB' },
  { label: 'Proxmox', icon: 'simple-icons:proxmox', bg: '#FF4F00' },
  { label: 'Jellyfin', icon: 'simple-icons:jellyfin', bg: '#09090B' },
  { label: 'Synology', icon: 'simple-icons:synology', bg: '#2563EB' },
  { label: 'Immich', icon: 'simple-icons:immich', bg: '#FF4F00' },
  { label: 'AdGuard', icon: 'simple-icons:adguard', bg: '#00C2A8' },
  { label: 'Nginx', icon: 'simple-icons:nginx', bg: '#09090B' },
  { label: 'Gitea', icon: 'simple-icons:gitea', bg: '#00C2A8' },
  { label: 'Home', icon: 'simple-icons:homeassistant', bg: '#2563EB' },
  { label: 'Server', icon: 'lucide:server', bg: '#09090B' },
  { label: 'Disk', icon: 'lucide:hard-drive', bg: '#EAB308' },
  { label: 'Terminal', icon: 'lucide:terminal', bg: '#09090B' },
]

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
  // checkedValueRef.value = type
  itemIconInfo.value.itemType = type
  handleChange()
}

function handleChange() {
  emit('update:itemIcon', itemIconInfo.value || null)
}

function applyBauhausPreset(preset: { icon: string; bg: string }) {
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
    // ms.error(`${t('common.uploadFail')}:${res.msg}`)
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
        :checked="itemIconInfo.itemType === 1 "
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
          <div class="border bg-slate-200 overflow-hidden transparent-grid" style="border-radius: var(--leon-ui-radius, 4px);">
            <ItemIcon :item-icon="itemIconInfo" />
          </div>
        </div>
        <!-- 文字 -->
        <div class="ml-[20px] flex-1 min-w-0">
          <!-- <NImage :src="model.icon" preview-disabled /> -->
          <div v-if="itemIconInfo.itemType === 1">
            <NInput v-model:value="itemIconInfo.text" class="mb-[5px]" size="small" type="text" @input="handleChange" />
          </div>

          <div v-if="itemIconInfo.itemType === 3">
            <div>
              <NInput v-model:value="itemIconInfo.text" class="mb-[5px]" size="small" type="text" :placeholder="$t('iconItem.inputIconName')" @input="handleChange" />

              <div class="flex flex-wrap gap-1.5 my-2">
                <button
                  v-for="preset in bauhausIconPresets"
                  :key="preset.icon"
                  type="button"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs border cursor-pointer transition-colors"
                  style="border-color: var(--leon-ui-border, #d4d4d8); border-radius: var(--leon-ui-radius, 2px);"
                  :title="preset.icon"
                  @click="applyBauhausPreset(preset)"
                >
                  <span class="w-2.5 h-2.5 inline-block shrink-0" :style="{ backgroundColor: preset.bg }" />
                  <SvgIcon :icon="preset.icon" class="text-sm" />
                  <span>{{ preset.label }}</span>
                </button>
              </div>

              <NButton quaternary type="info" size="small">
                <a target="_blank" href="https://icon-sets.iconify.design/">{{ $t('iconItem.onlineIconLibrary') }}</a>
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
</style>
