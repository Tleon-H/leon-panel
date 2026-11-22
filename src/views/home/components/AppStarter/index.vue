<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
import { useAuthStore } from '@/store'
import { AppLoader, RoundCardModal, SvgIcon } from '@/components/common'
import { t } from '@/locales'
import brandLogoSvg from '@/assets/logo.svg'

interface App {
  name: string
  componentName: string
  icon: string
  auth?: number
}
const props = defineProps<{
  visible: boolean
  initialApp?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void
}>()

const componentName = ref('UserInfo')
const collapsed = ref(false)
const screenWidth = ref(0)
const isSmallScreen = ref(false)
const defaultTitle = t('appLauncher.title')
const title = ref('')
const height = ref('min(72vh, 620px)')

watch(
  () => [props.visible, props.initialApp] as const,
  ([visible, initial]) => {
    if (visible && initial)
      componentName.value = initial
  },
)

const apps = ref<App[]>([
  {
    name: t('apps.userInfo.appName'),
    componentName: 'UserInfo',
    icon: 'material-symbols-person-edit-outline-rounded',
  },
  {
    name: t('apps.accountSwitch.appName'),
    componentName: 'AccountSwitch',
    icon: 'lucide:arrow-left-right',
  },
  {
    name: t('apps.baseSettings.appName'),
    componentName: 'Style',
    icon: 'ion-color-palette-outline',
  },
  {
    name: t('apps.leonStudio.appName'),
    componentName: 'LeonStudio',
    icon: 'lucide:sparkles',
  },
  {
    name: t('apps.itemGroupManage.appName'),
    componentName: 'ItemGroupManage',
    icon: 'material-symbols-ad-group-outline-rounded',
  },
  {
    name: t('apps.uploadsFileManager.appName'),
    componentName: 'UploadFileManager',
    icon: 'tabler:file-upload',
  },
  {
    name: t('apps.publicGallery.appName'),
    componentName: 'PublicGallery',
    icon: 'lucide:images',
  },
  {
    name: t('apps.exportImport.appName'),
    componentName: 'ImportExport',
    icon: 'icon-park-outline-import-and-export',
  },
  {
    name: t('apps.about.appName'),
    componentName: 'About',
    icon: 'lucide-info',
  },
])

const authStore = useAuthStore()

const show = computed({
  get: () => props.visible,
  set: (visible: boolean) => {
    emit('update:visible', visible)
  },
})

const activeAppName = computed(() => {
  return apps.value.find(item => item.componentName === componentName.value)?.name || defaultTitle
})

function handleClickApp(item: App) {
  componentName.value = item.componentName
  if (isSmallScreen.value)
    collapsed.value = true
}

function getScreenWidth() {
  return window.innerWidth
}

function handleResize() {
  screenWidth.value = getScreenWidth()
  if (screenWidth.value < 640) {
    collapsed.value = true
    isSmallScreen.value = true
  }
  else {
    collapsed.value = false
    isSmallScreen.value = false
  }
}

onMounted(() => {
  const adminApp: App = {
    name: t('adminSettingUsers.appName'),
    componentName: 'Users',
    icon: 'lucide-users',
    auth: 1,
  }
  // 初始化
  if (authStore.userInfo?.role === 1) {
    apps.value.push(adminApp)
    apps.value.push({
      name: t('apps.backup.appName'),
      componentName: 'Backup',
      icon: 'lucide:download',
      auth: 1,
    })
  }

  window.addEventListener('resize', handleResize)
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div>
    <RoundCardModal
      v-model:show="show"
      style="max-width: 980px; width: min(980px, 96vw);"
      size="small"
    >
      <template #header>
        <div class="leon-starter-header select-none">
          <button
            type="button"
            class="leon-starter-collapse-btn"
            :title="defaultTitle"
            @click="collapsed = !collapsed"
          >
            <SvgIcon class="transition-all duration-300" :icon="collapsed ? 'tabler-layout-sidebar-right-collapse-filled' : 'tabler-layout-sidebar-left-collapse-filled'" />
          </button>
          <img :src="brandLogoSvg" width="22" height="22" alt="Leon Panel" class="shrink-0">
          <div class="leon-starter-title">
            <span>{{ title === '' ? defaultTitle : title }}</span>
            <span class="leon-starter-sep">//</span>
            <span class="leon-starter-active-label">{{ activeAppName }}</span>
          </div>
        </div>
      </template>

      <div class="w-full h-full app-starter-modal-content">
        <NLayout has-sider class="leon-starter-layout">
          <NLayoutSider
            v-model:collapsed="collapsed"
            collapse-mode="width"
            :collapsed-width="0"
            :width="isSmallScreen ? '100%' : 228"
            bordered
            style="height: 100%;"
            content-style="overflow: hidden"
          >
            <nav
              class="leon-starter-nav"
              :style="{
                width: isSmallScreen ? '100%' : '228px',
                height,
              }"
            >
              <button
                v-for="(item, index) in apps"
                :key="item.componentName"
                type="button"
                class="leon-starter-nav-item"
                :class="{ 'is-active': componentName === item.componentName }"
                @click="handleClickApp(item)"
              >
                <span class="leon-starter-nav-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <SvgIcon class="leon-starter-nav-icon" :icon="item.icon" />
                <span class="leon-starter-nav-text">{{ item.name }}</span>
              </button>
            </nav>
          </NLayoutSider>

          <NLayoutContent :content-style="{ height }">
            <div
              class="leon-starter-pane"
              :class="(isSmallScreen && !collapsed) ? 'opacity-0 pointer-events-none' : 'opacity-100'"
            >
              <AppLoader :component-name="componentName" class="h-full" />
            </div>
          </NLayoutContent>
        </NLayout>
      </div>
    </RoundCardModal>
  </div>
</template>

<style scoped>
.leon-starter-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.leon-starter-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--leon-ui-border, #d4d4d8);
  border-radius: var(--leon-ui-radius, 0px);
  background: transparent;
  color: var(--leon-ui-primary, #ff4f00);
  font-size: 20px;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.leon-starter-collapse-btn:hover {
  border-color: var(--leon-ui-primary, #ff4f00);
}

.leon-starter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.leon-starter-sep {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  opacity: 0.45;
}

.leon-starter-active-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--leon-ui-primary, #ff4f00);
}

.leon-starter-layout {
  border: 1px solid var(--leon-ui-border, #e4e4e7);
  border-radius: var(--leon-ui-radius, 0px);
}

.leon-starter-nav {
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--leon-ui-canvas, #f5f5f3);
}

.leon-starter-nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-left: 3px solid transparent;
  border-radius: var(--leon-ui-radius, 0px);
  background: transparent;
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.leon-starter-nav-item:hover {
  background: var(--leon-ui-surface, #ffffff);
  border-color: var(--leon-ui-border, #d4d4d8);
}

.leon-starter-nav-item.is-active {
  background: var(--leon-ui-surface, #ffffff);
  border-color: var(--leon-ui-border, #18181b);
  border-left-color: var(--leon-ui-primary, #ff4f00);
  color: var(--leon-ui-primary, #ff4f00);
}

.leon-starter-nav-index {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  opacity: 0.55;
  width: 18px;
  shrink: 0;
}

.leon-starter-nav-icon {
  font-size: 17px;
  flex-shrink: 0;
}

.leon-starter-nav-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-starter-pane {
  height: 100%;
  overflow-y: auto;
  padding: 4px 12px 12px;
  min-width: 280px;
  transition: opacity 0.2s ease;
}
</style>

<style>
.dark .app-starter-modal-content .n-layout {
  background-color: #121215;
}

.dark .leon-starter-nav {
  background-color: #09090b;
}

.dark .leon-starter-nav-item:hover,
.dark .leon-starter-nav-item.is-active {
  background-color: #18181b;
}
</style>
