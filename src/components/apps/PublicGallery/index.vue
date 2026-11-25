<script setup lang="ts">
import { NAlert, NButton, NButtonGroup, NCard, NEllipsis, NGrid, NGridItem, NImage, NImageGroup, NInput, NPagination, NSpin, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSiteFavicon } from '@/api/panel/itemIcon'
import { getPublicList } from '@/api/system/file'
import { SvgIcon } from '@/components/common'
import { copyToClipboard } from '@/utils/cmn'
import { type FileCategory, displayFileCategory, fileCategories, pageAfterListChange, publicFileQuery } from '@/utils/file/category'
import {
  CURATED_WEBSITE_ICONS,
  type DomainFaviconCandidate,
  type OnlineIconCategory,
  type OnlineIconEntry,
  type OnlineIconFormat,
  type OnlineWallpaperCategory,
  buildDomainFaviconCandidates,
  extractDomainFromInput,
  filterOnlineIcons,
  filterOnlineWallpapers,
  loadFullDashboardIconsCatalog,
  resolveOnlineIconUrl,
  searchIconifyIcons,
} from '@/utils/gallery/onlineGallery'
import { t } from '@/locales'
import { usePanelState } from '@/store'

type GalleryTab = 'onlineIcons' | 'favicon' | 'onlineWallpapers' | 'local'
type OnlineIconProvider = 'dashboard' | 'iconify'

const props = withDefaults(defineProps<{
  lockedCategory?: '' | FileCategory
  selectable?: boolean
}>(), {
  lockedCategory: '',
  selectable: false,
})

const emit = defineEmits<{
  (e: 'select', src: string): void
}>()

const ms = useMessage()
const panelStore = usePanelState()

// Active gallery tab
const defaultTab: GalleryTab = props.lockedCategory === 'wallpaper' ? 'onlineWallpapers' : 'onlineIcons'
const activeTab = ref<GalleryTab>(defaultTab)

const availableTabs = computed<Array<{ id: GalleryTab; icon: string; label: string }>>(() => {
  if (props.lockedCategory === 'icon') {
    return [
      { id: 'onlineIcons', icon: 'lucide:sparkles', label: t('apps.publicGallery.tabOnlineIcons') },
      { id: 'favicon', icon: 'lucide:globe', label: t('apps.publicGallery.tabFavicon') },
      { id: 'local', icon: 'lucide:images', label: t('apps.publicGallery.tabLocalShared') },
    ]
  }
  if (props.lockedCategory === 'wallpaper') {
    return [
      { id: 'onlineWallpapers', icon: 'lucide:wallpaper', label: t('apps.publicGallery.tabOnlineWallpapers') },
      { id: 'local', icon: 'lucide:images', label: t('apps.publicGallery.tabLocalShared') },
    ]
  }
  return [
    { id: 'onlineIcons', icon: 'lucide:sparkles', label: t('apps.publicGallery.tabOnlineIcons') },
    { id: 'favicon', icon: 'lucide:globe', label: t('apps.publicGallery.tabFavicon') },
    { id: 'onlineWallpapers', icon: 'lucide:wallpaper', label: t('apps.publicGallery.tabOnlineWallpapers') },
    { id: 'local', icon: 'lucide:images', label: t('apps.publicGallery.tabLocalShared') },
  ]
})

// ==================== 1. Online HD Icons (Dashboard Icons + Iconify) ====================
const iconProvider = ref<OnlineIconProvider>('dashboard')
const iconFormat = ref<OnlineIconFormat>('svg')
const iconCategory = ref<OnlineIconCategory>('all')
const iconKeyword = ref('')
const dashboardCatalog = ref<OnlineIconEntry[]>([...CURATED_WEBSITE_ICONS])
const dashboardCatalogLoaded = ref(false)
const dashboardCatalogLoading = ref(false)

const iconifyScope = ref<'brands' | 'all'>('brands')
const iconifyResults = ref<OnlineIconEntry[]>([])
const iconifyLoading = ref(false)
let iconifyTimer: ReturnType<typeof setTimeout> | null = null
let iconifySerial = 0

const iconCategoryOptions = computed<Array<{ value: OnlineIconCategory; label: string }>>(() => [
  { value: 'all', label: t('apps.uploadsFileManager.category.all') },
  { value: 'popular', label: t('apps.publicGallery.iconCatPopular') },
  { value: 'homelab', label: t('apps.publicGallery.iconCatHomelab') },
  { value: 'ai', label: t('apps.publicGallery.iconCatAi') },
  { value: 'dev', label: t('apps.publicGallery.iconCatDev') },
  { value: 'media', label: t('apps.publicGallery.iconCatMedia') },
  { value: 'cloud', label: t('apps.publicGallery.iconCatCloud') },
])

const visibleOnlineIcons = computed<OnlineIconEntry[]>(() => {
  if (iconProvider.value === 'iconify')
    return iconifyResults.value
  return filterOnlineIcons(dashboardCatalog.value, iconKeyword.value, iconCategory.value, 72)
})

const failedIconIds = ref<Record<string, boolean>>({})

function markIconFailed(id: string) {
  failedIconIds.value = { ...failedIconIds.value, [id]: true }
}

async function ensureDashboardCatalog() {
  if (dashboardCatalogLoaded.value || dashboardCatalogLoading.value)
    return
  dashboardCatalogLoading.value = true
  try {
    const res = await loadFullDashboardIconsCatalog()
    dashboardCatalog.value = res.entries
    dashboardCatalogLoaded.value = res.remoteLoaded
  }
  finally {
    dashboardCatalogLoading.value = false
  }
}

async function triggerIconifySearch() {
  const q = iconKeyword.value.trim() || 'docker'
  const serial = ++iconifySerial
  iconifyLoading.value = true
  try {
    const list = await searchIconifyIcons(q, iconifyScope.value, 48)
    if (serial === iconifySerial)
      iconifyResults.value = list
  }
  finally {
    if (serial === iconifySerial)
      iconifyLoading.value = false
  }
}

function handleOnlineIconSearchInput() {
  if (iconProvider.value !== 'iconify')
    return
  if (iconifyTimer)
    clearTimeout(iconifyTimer)
  iconifyTimer = setTimeout(() => {
    triggerIconifySearch()
  }, 300)
}

watch([iconProvider, iconifyScope], ([provider]) => {
  if (provider === 'iconify')
    triggerIconifySearch()
})

// ==================== 2. Website HD Favicon Extractor ====================
const faviconInput = ref('')
const serverFaviconUrl = ref('')
const serverFaviconLoading = ref(false)
const quickDomainExamples = ['github.com', 'bilibili.com', 'youtube.com', 'notion.so', 'cloudflare.com', 'openai.com']

const normalizedFaviconHost = computed(() => extractDomainFromInput(faviconInput.value))
const faviconCandidates = computed<DomainFaviconCandidate[]>(() => buildDomainFaviconCandidates(faviconInput.value))

function applyQuickDomain(domain: string) {
  faviconInput.value = domain
  serverFaviconUrl.value = ''
}

async function fetchFaviconViaServer() {
  const raw = faviconInput.value.trim()
  if (!raw)
    return
  const fullUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  serverFaviconLoading.value = true
  try {
    const { code, data, msg } = await getSiteFavicon<{ iconUrl: string }>(fullUrl)
    if (code === 0 && data?.iconUrl) {
      serverFaviconUrl.value = data.iconUrl
      ms.success(t('apps.publicGallery.faviconServerSuccess'))
    }
    else {
      ms.error(msg || t('iconItem.geticonFail'))
    }
  }
  catch {
    ms.error(t('iconItem.geticonFail'))
  }
  finally {
    serverFaviconLoading.value = false
  }
}

// ==================== 3. Online HD Wallpapers ====================
const wallpaperCategory = ref<OnlineWallpaperCategory>('all')
const wallpaperKeyword = ref('')

const wallpaperCategoryOptions = computed<Array<{ value: OnlineWallpaperCategory; label: string }>>(() => [
  { value: 'all', label: t('apps.uploadsFileManager.category.all') },
  { value: 'dark', label: t('apps.publicGallery.wallCatDark') },
  { value: 'nature', label: t('apps.publicGallery.wallCatNature') },
  { value: 'minimal', label: t('apps.publicGallery.wallCatMinimal') },
  { value: 'light', label: t('apps.publicGallery.wallCatLight') },
])

const visibleOnlineWallpapers = computed(() => filterOnlineWallpapers(wallpaperKeyword.value, wallpaperCategory.value))

// ==================== 4. Local Admin-Shared Public Gallery ====================
const images = ref<File.Info[]>([])
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const keyword = ref('')
const category = ref<'' | FileCategory>(props.lockedCategory || '')
let keywordTimer: ReturnType<typeof setTimeout> | null = null
let listSerial = 0
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 12)))

const categoryOptions = computed(() => [
  { label: t('apps.uploadsFileManager.category.all'), value: '' as const },
  ...fileCategories.map(value => ({
    label: t(`apps.uploadsFileManager.category.${value}`),
    value,
  })),
])

async function load() {
  const serial = ++listSerial
  loading.value = true
  try {
    const query = publicFileQuery({
      page: page.value,
      category: props.lockedCategory || category.value,
      keyword: keyword.value,
    })
    const { data } = await getPublicList<Common.ListResponse<File.Info[]>>(query)
    if (serial !== listSerial)
      return
    images.value = (data.list ?? []).map(item => ({
      ...item,
      category: displayFileCategory(item.category),
      public: true,
    }))
    total.value = data.count ?? 0
    const nextPage = pageAfterListChange(page.value, total.value, query.limit)
    if (nextPage !== page.value) {
      page.value = nextPage
      await load()
    }
  }
  finally {
    if (serial === listSerial)
      loading.value = false
  }
}

function changePage(next: number) {
  page.value = next
  load()
}

function selectCategory(value: '' | FileCategory) {
  category.value = value
  page.value = 1
  load()
}

function onKeywordInput() {
  page.value = 1
  if (keywordTimer)
    clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    load()
  }, 250)
}

async function copyImageUrl(text: string) {
  const copied = await copyToClipboard(text)
  if (copied)
    ms.success(t('apps.uploadsFileManager.copySuccess'))
  else
    ms.error(t('apps.uploadsFileManager.copyFailed'))
}

function useImage(src: string) {
  emit('select', src)
}

function setWallpaper(src: string) {
  if (!panelStore.setWallpaperSource(src))
    return
  panelStore.savePanelConfigToCloud().then((result) => {
    if (result.stale || result.blocked)
      return
    if (result.ok)
      ms.success(t('apps.baseSettings.configSaved'))
    else if (result.msg)
      ms.error(t('apps.baseSettings.configFailed', { message: result.msg }))
    else
      ms.error(t('common.networkError'))
  })
}

onMounted(() => {
  load()
  ensureDashboardCatalog()
})

onBeforeUnmount(() => {
  if (keywordTimer)
    clearTimeout(keywordTimer)
  if (iconifyTimer)
    clearTimeout(iconifyTimer)
})
</script>

<template>
  <div class="public-gallery" data-testid="public-gallery">
    <!-- 顶部图库来源切换栏 -->
    <div class="pg-tabs" role="tablist">
      <button
        v-for="tab in availableTabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        class="pg-tab"
        :class="{ 'is-active': activeTab === tab.id }"
        :data-testid="`public-gallery-tab-${tab.id}`"
        @click="activeTab = tab.id"
      >
        <SvgIcon :icon="tab.icon" class="text-[14px]" />
        <span>{{ tab.label }}</span>
        <span v-if="tab.id === 'local' && total > 0" class="pg-tab-count">{{ total }}</span>
        <span v-else-if="tab.id === 'onlineIcons'" class="pg-tab-count">
          {{ dashboardCatalogLoaded ? `${dashboardCatalog.length}+` : `${CURATED_WEBSITE_ICONS.length}+` }}
        </span>
      </button>
    </div>

    <!-- ==================== TAB 1: 在线高清图标库 ==================== -->
    <div v-if="activeTab === 'onlineIcons'" class="pg-pane" data-testid="public-gallery-online-icons">
      <div class="pg-toolbar">
        <div class="pg-source-switch">
          <button
            type="button"
            class="pg-pill"
            :class="{ 'is-active': iconProvider === 'dashboard' }"
            @click="iconProvider = 'dashboard'"
          >
            Dashboard Icons
          </button>
          <button
            type="button"
            class="pg-pill"
            :class="{ 'is-active': iconProvider === 'iconify' }"
            @click="iconProvider = 'iconify'"
          >
            Iconify (200k+)
          </button>
        </div>

        <div v-if="iconProvider === 'dashboard'" class="pg-format-switch">
          <button
            type="button"
            class="pg-pill is-compact"
            :class="{ 'is-active': iconFormat === 'svg' }"
            @click="iconFormat = 'svg'"
          >
            SVG
          </button>
          <button
            type="button"
            class="pg-pill is-compact"
            :class="{ 'is-active': iconFormat === 'png' }"
            @click="iconFormat = 'png'"
          >
            PNG HD
          </button>
        </div>

        <div v-else class="pg-format-switch">
          <button
            type="button"
            class="pg-pill is-compact"
            :class="{ 'is-active': iconifyScope === 'brands' }"
            @click="iconifyScope = 'brands'"
          >
            {{ $t('apps.publicGallery.iconifyBrands') }}
          </button>
          <button
            type="button"
            class="pg-pill is-compact"
            :class="{ 'is-active': iconifyScope === 'all' }"
            @click="iconifyScope = 'all'"
          >
            {{ $t('apps.publicGallery.iconifyAll') }}
          </button>
        </div>
      </div>

      <NInput
        v-model:value="iconKeyword"
        class="mt-2"
        clearable
        data-testid="online-icon-search"
        :placeholder="iconProvider === 'dashboard' ? $t('apps.publicGallery.onlineIconSearchPlaceholder') : $t('apps.publicGallery.iconifySearchPlaceholder')"
        @update:value="handleOnlineIconSearchInput"
      >
        <template #prefix>
          <SvgIcon icon="lucide:search" class="text-sm opacity-65" />
        </template>
      </NInput>

      <div v-if="iconProvider === 'dashboard'" class="public-filters">
        <button
          v-for="cat in iconCategoryOptions"
          :key="cat.value"
          type="button"
          class="public-filter"
          :class="{ active: iconCategory === cat.value }"
          @click="iconCategory = cat.value"
        >
          {{ cat.label }}
        </button>
        <span v-if="dashboardCatalogLoading" class="pg-sync-hint">
          <NSpin :size="12" />
          {{ $t('apps.publicGallery.loadingFullIndex') }}
        </span>
      </div>

      <div v-if="iconProvider === 'iconify' && iconifyLoading" class="pg-loading-box">
        <NSpin size="small" />
      </div>

      <div v-else-if="visibleOnlineIcons.length === 0" class="public-empty">
        {{ $t('apps.uploadsFileManager.noMatch') }}
      </div>

      <div v-else class="pg-icon-grid mt-3">
        <div
          v-for="item in visibleOnlineIcons"
          :key="item.id"
          class="pg-icon-card"
          :data-icon-slug="item.slug"
        >
          <div class="pg-icon-stage" @click="selectable ? useImage(resolveOnlineIconUrl(item, iconFormat)) : copyImageUrl(resolveOnlineIconUrl(item, iconFormat))">
            <img
              v-if="!failedIconIds[item.id]"
              :src="resolveOnlineIconUrl(item, iconFormat)"
              :alt="item.name"
              loading="lazy"
              class="pg-icon-img"
              @error="markIconFailed(item.id)"
            >
            <SvgIcon v-else icon="lucide:image" class="text-xl opacity-40" />
          </div>
          <div class="pg-icon-meta">
            <NEllipsis class="pg-icon-name">
              {{ item.name }}
            </NEllipsis>
            <div class="pg-icon-btns">
              <NButton
                v-if="selectable"
                size="tiny"
                type="primary"
                data-testid="online-icon-pick"
                @click="useImage(resolveOnlineIconUrl(item, iconFormat))"
              >
                {{ $t('apps.publicGallery.pick') }}
              </NButton>
              <NButton
                size="tiny"
                tertiary
                :title="$t('apps.uploadsFileManager.copyLink')"
                @click="copyImageUrl(resolveOnlineIconUrl(item, iconFormat))"
              >
                <template #icon>
                  <SvgIcon icon="lucide:copy" />
                </template>
              </NButton>
            </div>
          </div>
        </div>
      </div>

      <div class="pg-footnote">
        {{ $t('apps.publicGallery.onlineIconHint') }}
      </div>
    </div>

    <!-- ==================== TAB 2: 按网址提取高清网站图标 ==================== -->
    <div v-else-if="activeTab === 'favicon'" class="pg-pane" data-testid="public-gallery-favicon">
      <NAlert type="info" :bordered="false" class="mb-3">
        {{ $t('apps.publicGallery.faviconAlert') }}
      </NAlert>

      <div class="pg-favicon-bar">
        <NInput
          v-model:value="faviconInput"
          clearable
          data-testid="favicon-domain-input"
          :placeholder="$t('apps.publicGallery.faviconPlaceholder')"
          @keydown.enter.prevent="fetchFaviconViaServer"
        >
          <template #prefix>
            <SvgIcon icon="lucide:globe" class="text-sm opacity-65" />
          </template>
        </NInput>
        <NButton
          type="primary"
          secondary
          :disabled="!faviconInput.trim()"
          :loading="serverFaviconLoading"
          @click="fetchFaviconViaServer"
        >
          <template #icon>
            <SvgIcon icon="lucide:download-cloud" />
          </template>
          {{ $t('apps.publicGallery.faviconServerFetch') }}
        </NButton>
      </div>

      <div class="pg-examples">
        <span class="pg-examples-label">{{ $t('apps.publicGallery.quickTry') }}</span>
        <button
          v-for="example in quickDomainExamples"
          :key="example"
          type="button"
          class="pg-pill is-compact"
          @click="applyQuickDomain(example)"
        >
          {{ example }}
        </button>
      </div>

      <div v-if="serverFaviconUrl" class="pg-favicon-server-hit mt-3">
        <div class="pg-icon-stage is-sm">
          <img :src="serverFaviconUrl" :alt="normalizedFaviconHost || 'favicon'" class="pg-icon-img">
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold">
            {{ $t('apps.publicGallery.faviconServerSaved') }}
          </div>
          <div class="text-[11px] opacity-65 truncate">
            {{ serverFaviconUrl }}
          </div>
        </div>
        <NButtonGroup>
          <NButton v-if="selectable" size="small" type="primary" @click="useImage(serverFaviconUrl)">
            {{ $t('apps.publicGallery.pick') }}
          </NButton>
          <NButton size="small" tertiary @click="copyImageUrl(serverFaviconUrl)">
            <template #icon>
              <SvgIcon icon="lucide:copy" />
            </template>
          </NButton>
        </NButtonGroup>
      </div>

      <div v-if="faviconCandidates.length > 0" class="pg-favicon-grid mt-3">
        <div v-for="cand in faviconCandidates" :key="cand.id" class="pg-favicon-card">
          <div class="pg-icon-stage" @click="selectable ? useImage(cand.url) : copyImageUrl(cand.url)">
            <img :src="cand.url" :alt="`${normalizedFaviconHost} - ${cand.provider}`" class="pg-icon-img">
          </div>
          <div class="pg-favicon-meta">
            <div class="flex items-center justify-between gap-1">
              <span class="text-xs font-semibold truncate">{{ cand.provider }}</span>
              <span class="pg-badge">{{ cand.badge }}</span>
            </div>
            <div class="pg-icon-btns mt-1.5">
              <NButton v-if="selectable" size="tiny" type="primary" @click="useImage(cand.url)">
                {{ $t('apps.publicGallery.pick') }}
              </NButton>
              <NButton size="tiny" tertiary :title="$t('apps.uploadsFileManager.copyLink')" @click="copyImageUrl(cand.url)">
                <template #icon>
                  <SvgIcon icon="lucide:copy" />
                </template>
              </NButton>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="public-empty">
        {{ $t('apps.publicGallery.faviconEmptyHint') }}
      </div>
    </div>

    <!-- ==================== TAB 3: 精选免费高清壁纸 ==================== -->
    <div v-else-if="activeTab === 'onlineWallpapers'" class="pg-pane" data-testid="public-gallery-online-wallpapers">
      <div class="public-filters">
        <button
          v-for="cat in wallpaperCategoryOptions"
          :key="cat.value"
          type="button"
          class="public-filter"
          :class="{ active: wallpaperCategory === cat.value }"
          @click="wallpaperCategory = cat.value"
        >
          {{ cat.label }}
        </button>
      </div>

      <NInput
        v-model:value="wallpaperKeyword"
        class="mt-2"
        clearable
        :placeholder="$t('apps.publicGallery.onlineWallpaperSearchPlaceholder')"
      >
        <template #prefix>
          <SvgIcon icon="lucide:search" class="text-sm opacity-65" />
        </template>
      </NInput>

      <div v-if="visibleOnlineWallpapers.length === 0" class="public-empty">
        {{ $t('apps.uploadsFileManager.noMatch') }}
      </div>

      <div v-else class="pg-wall-grid mt-3">
        <div v-for="wall in visibleOnlineWallpapers" :key="wall.id" class="pg-wall-card">
          <div class="pg-wall-preview" @click="selectable ? useImage(wall.fullUrl) : setWallpaper(wall.fullUrl)">
            <img :src="wall.thumbUrl" :alt="wall.title" loading="lazy" class="pg-wall-img">
            <span class="pg-wall-source">{{ wall.source }}</span>
          </div>
          <div class="pg-wall-footer">
            <NEllipsis class="text-xs font-medium flex-1 min-w-0">
              {{ wall.title }}
            </NEllipsis>
            <NButtonGroup>
              <NButton v-if="selectable" size="tiny" type="primary" @click="useImage(wall.fullUrl)">
                {{ $t('apps.publicGallery.pick') }}
              </NButton>
              <NButton
                v-else
                size="tiny"
                type="primary"
                secondary
                :disabled="!panelStore.isCloudConfigReady"
                :title="$t('apps.uploadsFileManager.setWallpaper')"
                @click="setWallpaper(wall.fullUrl)"
              >
                <template #icon>
                  <SvgIcon icon="lucide:wallpaper" />
                </template>
              </NButton>
              <NButton size="tiny" tertiary :title="$t('apps.uploadsFileManager.copyLink')" @click="copyImageUrl(wall.fullUrl)">
                <template #icon>
                  <SvgIcon icon="lucide:copy" />
                </template>
              </NButton>
            </NButtonGroup>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== TAB 4: 站内共享（管理员公开图库） ==================== -->
    <div v-else class="pg-pane" data-testid="public-gallery-local">
      <NAlert type="info" :bordered="false">
        {{ $t('apps.publicGallery.alert') }}
      </NAlert>
      <div v-if="!lockedCategory" class="public-filters">
        <button
          v-for="item in categoryOptions"
          :key="item.value || 'all'"
          type="button"
          class="public-filter"
          :class="{ active: category === item.value }"
          @click="selectCategory(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <NInput
        v-model:value="keyword"
        class="mt-2"
        clearable
        data-testid="public-gallery-search"
        :placeholder="$t('apps.uploadsFileManager.searchPlaceholder')"
        @update:value="onKeywordInput"
      />
      <div v-if="images.length === 0 && !loading" class="public-empty">
        {{ keyword || category ? $t('apps.uploadsFileManager.noMatch') : $t('apps.publicGallery.empty') }}
      </div>
      <NImageGroup v-else>
        <NGrid class="mt-2" cols="2 300:2 600:4 900:6" :x-gap="5" :y-gap="5">
          <NGridItem v-for="item in images" :key="item.id">
            <div class="public-card" :data-filename="item.fileName">
              <NCard size="small" :bordered="true">
                <template #cover>
                  <div class="public-preview">
                    <NImage style="object-fit: contain;height: 100%;" :src="item.src" />
                  </div>
                </template>
                <template #footer>
                  <span class="text-xs">
                    <NEllipsis>{{ item.fileName }}</NEllipsis>
                  </span>
                  <div class="public-actions">
                    <NButtonGroup>
                      <NButton v-if="selectable" size="tiny" type="primary" data-testid="public-gallery-pick" @click="useImage(item.src)">
                        {{ $t('apps.publicGallery.pick') }}
                      </NButton>
                      <NButton size="tiny" tertiary :title="$t('apps.uploadsFileManager.copyLink')" @click="copyImageUrl(item.src)">
                        <template #icon>
                          <SvgIcon icon="lucide:copy" />
                        </template>
                      </NButton>
                      <NButton v-if="!selectable" size="tiny" tertiary :disabled="!panelStore.isCloudConfigReady" :title="$t('apps.uploadsFileManager.setWallpaper')" @click="setWallpaper(item.src)">
                        <template #icon>
                          <SvgIcon icon="lucide:wallpaper" />
                        </template>
                      </NButton>
                    </NButtonGroup>
                  </div>
                </template>
              </NCard>
            </div>
          </NGridItem>
        </NGrid>
      </NImageGroup>
      <div v-if="total > 12" class="public-pages">
        <NPagination :page="page" :page-count="pageCount" @update:page="changePage" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pg-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
}

.pg-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 9px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: transparent;
  color: inherit;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.pg-tab:hover {
  border-color: rgba(14, 165, 233, 0.5);
  background: rgba(14, 165, 233, 0.06);
}

.pg-tab.is-active {
  background: var(--leon-ui-primary, #0ea5e9);
  border-color: var(--leon-ui-primary, #0ea5e9);
  color: #ffffff;
  font-weight: 600;
}

.pg-tab-count {
  font-size: 10.5px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
}

.pg-tab.is-active .pg-tab-count {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.pg-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pg-source-switch,
.pg-format-switch {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pg-pill {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.14s ease;
}

.pg-pill.is-compact {
  padding: 2px 9px;
  font-size: 11px;
}

.pg-pill:hover {
  border-color: var(--leon-ui-primary, #0ea5e9);
}

.pg-pill.is-active {
  background: rgba(14, 165, 233, 0.14);
  border-color: var(--leon-ui-primary, #0ea5e9);
  color: var(--leon-ui-primary, #0ea5e9);
  font-weight: 600;
}

.pg-sync-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  opacity: 0.7;
  margin-left: auto;
}

.pg-loading-box {
  display: flex;
  justify-content: center;
  padding: 28px 0;
}

.pg-icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
  max-height: 410px;
  overflow-y: auto;
  padding-right: 2px;
}

.pg-icon-card {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.14s ease, transform 0.14s ease;
}

.pg-icon-card:hover {
  border-color: var(--leon-ui-primary, #0ea5e9);
  transform: translateY(-1px);
}

.pg-icon-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 76px;
  padding: 12px;
  cursor: pointer;
  background-color: rgba(148, 163, 184, 0.1);
  background-image:
    linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.08) 75%),
    linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.08) 75%);
  background-size: 14px 14px;
  background-position: 0 0, 7px 7px;
}

.pg-icon-stage.is-sm {
  width: 52px;
  height: 52px;
  padding: 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.pg-icon-img {
  max-width: 48px;
  max-height: 48px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.pg-icon-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px 8px;
}

.pg-icon-name {
  font-size: 11.5px;
  font-weight: 500;
}

.pg-icon-btns {
  display: flex;
  align-items: center;
  gap: 5px;
}

.pg-footnote {
  margin-top: 10px;
  font-size: 11.5px;
  opacity: 0.68;
}

.pg-favicon-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pg-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.pg-examples-label {
  font-size: 11.5px;
  opacity: 0.68;
}

.pg-favicon-server-hit {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.08);
}

.pg-favicon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
  gap: 10px;
}

.pg-favicon-card {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 10px;
  overflow: hidden;
}

.pg-favicon-meta {
  padding: 8px;
}

.pg-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.14);
  color: var(--leon-ui-primary, #0ea5e9);
}

.pg-wall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
  gap: 10px;
  max-height: 410px;
  overflow-y: auto;
  padding-right: 2px;
}

.pg-wall-card {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.14s ease, transform 0.14s ease;
}

.pg-wall-card:hover {
  border-color: var(--leon-ui-primary, #0ea5e9);
  transform: translateY(-1px);
}

.pg-wall-preview {
  position: relative;
  aspect-ratio: 16 / 10;
  background: rgba(15, 23, 42, 0.25);
  overflow: hidden;
  cursor: pointer;
}

.pg-wall-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pg-wall-source {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  background: rgba(15, 23, 42, 0.72);
  color: #f8fafc;
}

.pg-wall-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
}

.public-filters,
.public-pages,
.public-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.public-filter {
  border: 1px solid rgba(148, 163, 184, 0.48);
  background: transparent;
  color: inherit;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.14s ease;
}

.public-filter.active {
  background: #0f172a;
  color: #f8fafc;
  border-color: #e2e8f0;
}

.public-empty {
  margin-top: 14px;
  font-size: 12.5px;
  opacity: 0.72;
  text-align: center;
  padding: 18px 8px;
}

.public-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  background: rgba(148, 163, 184, 0.16);
}
</style>
