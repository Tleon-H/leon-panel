<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
import { useAuthStore } from '@/store'
import { AppLoader, RoundCardModal, SvgIcon } from '@/components/common'
import { t } from '@/locales'
import brandLogoSvg from '@/assets/logo.svg'

interface App {
  name: string
  componentName: string
  icon: string
  section: 'account' | 'appearance' | 'resources' | 'system'
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

provide('leonSwitchStarterApp', (target: string) => {
  componentName.value = target
})

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
    icon: 'lucide:user-cog',
    section: 'account',
  },
  {
    name: t('apps.accountSwitch.appName'),
    componentName: 'AccountSwitch',
    icon: 'lucide:arrow-left-right',
    section: 'account',
  },
  {
    name: t('apps.baseSettings.appName'),
    componentName: 'Style',
    icon: 'lucide:palette',
    section: 'appearance',
  },
  {
    name: t('apps.leonStudio.appName'),
    componentName: 'LeonStudio',
    icon: 'lucide:layout-grid',
    section: 'appearance',
  },
  {
    name: t('apps.itemGroupManage.appName'),
    componentName: 'ItemGroupManage',
    icon: 'lucide:folder-kanban',
    section: 'resources',
  },
  {
    name: t('apps.uploadsFileManager.appName'),
    componentName: 'UploadFileManager',
    icon: 'lucide:upload',
    section: 'resources',
  },
  {
    name: t('apps.publicGallery.appName'),
    componentName: 'PublicGallery',
    icon: 'lucide:images',
    section: 'resources',
  },
  {
    name: t('apps.exportImport.appName'),
    componentName: 'ImportExport',
    icon: 'lucide:arrow-up-down',
    section: 'resources',
  },
  {
    name: t('apps.about.appName'),
    componentName: 'About',
    icon: 'lucide:info',
    section: 'system',
  },
])

const authStore = useAuthStore()

const sectionLabels: Record<App['section'], string> = {
  account: t('appLauncher.sectionAccount'),
  appearance: t('appLauncher.sectionAppearance'),
  resources: t('appLauncher.sectionResources'),
  system: t('appLauncher.sectionSystem'),
}

const groupedApps = computed(() => {
  const order: App['section'][] = ['account', 'appearance', 'resources', 'system']
  return order
    .map(section => ({
      section,
      label: sectionLabels[section],
      items: apps.value.filter(item => item.section === section),
    }))
    .filter(group => group.items.length > 0)
})

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
    icon: 'lucide:users',
    section: 'system',
    auth: 1,
  }
  // 初始化
  if (authStore.userInfo?.role === 1) {
    apps.value.push(adminApp)
    apps.value.push({
      name: t('apps.backup.appName'),
      componentName: 'Backup',
      icon: 'lucide:download',
      section: 'system',
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
            <SvgIcon class="transition-all duration-200" :icon="collapsed ? 'lucide:panel-left-open' : 'lucide:panel-left-close'" />
          </button>
          <img :src="brandLogoSvg" width="22" height="22" alt="Leon Panel" class="shrink-0 rounded-[5px]">
          <div class="leon-starter-title">
            <span>{{ title === '' ? defaultTitle : title }}</span>
            <span class="leon-starter-sep">/</span>
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
              <div
                v-for="group in groupedApps"
                :key="group.section"
                class="leon-starter-group"
              >
                <div class="leon-starter-group-label">
                  {{ group.label }}
                </div>
                <button
                  v-for="item in group.items"
                  :key="item.componentName"
                  type="button"
                  class="leon-starter-nav-item"
                  :class="{ 'is-active': componentName === item.componentName }"
                  @click="handleClickApp(item)"
                >
                  <SvgIcon class="leon-starter-nav-icon" :icon="item.icon" />
                  <span class="leon-starter-nav-text">{{ item.name }}</span>
                </button>
              </div>
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
  border-radius: var(--leon-ui-radius, 8px);
  background: transparent;
  color: inherit;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.leon-starter-collapse-btn:hover {
  border-color: var(--leon-ui-primary, #0ea5e9);
  color: var(--leon-ui-primary, #0ea5e9);
}

.leon-starter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.leon-starter-sep {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  opacity: 0.35;
}

.leon-starter-active-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--leon-ui-primary, #0ea5e9);
}

.leon-starter-layout {
  border: 1px solid var(--leon-ui-border, #e4e4e7);
  border-radius: var(--leon-ui-radius, 8px);
}

.leon-starter-nav {
  padding: 10px 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--leon-ui-canvas, #f5f5f3);
}

.leon-starter-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.leon-starter-group-label {
  padding: 2px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.52;
}

.leon-starter-nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--leon-ui-radius, 8px);
  background: transparent;
  color: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.leon-starter-nav-item:hover {
  background: var(--leon-ui-surface, #ffffff);
  border-color: var(--leon-ui-border, #e2e8f0);
}

.leon-starter-nav-item.is-active {
  background: var(--leon-ui-surface, #ffffff);
  border-color: var(--leon-ui-border, #cbd5e1);
  color: var(--leon-ui-primary, #0ea5e9);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.leon-starter-nav-icon {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.85;
}

.leon-starter-nav-item.is-active .leon-starter-nav-icon {
  opacity: 1;
}

.leon-starter-nav-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leon-starter-pane {
  height: 100%;
  overflow-y: auto;
  padding: 8px 14px 14px;
  min-width: 280px;
  transition: opacity 0.2s ease;
}
</style>

<style>
.dark .app-starter-modal-content .n-layout {
  background-color: #14171f;
}

.dark .leon-starter-nav {
  background-color: #0b0d11;
}

.dark .leon-starter-nav-item:hover,
.dark .leon-starter-nav-item.is-active {
  background-color: #191d27;
}
</style>
