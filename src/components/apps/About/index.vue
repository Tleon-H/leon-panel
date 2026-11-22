<script setup lang="ts">
import { NTag } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { get } from '@/api/system/about'
import srcSvglogo from '@/assets/logo.svg'

interface Version {
  versionName: string
  versionCode: number
}

const versionName = ref('')
const frontVersion = import.meta.env.VITE_APP_VERSION || 'unknown'

onMounted(() => {
  get<Version>().then((res) => {
    if (res.code === 0)
      versionName.value = res.data.versionName
  })
})
</script>

<template>
  <div class="py-6 px-4">
    <div class="flex flex-col items-center justify-center text-center">
      <div class="about-logo-frame mb-4">
        <img :src="srcSvglogo" width="88" height="88" alt="Leon Panel">
      </div>
      <div class="text-2xl font-extrabold tracking-tight uppercase">
        {{ $t('common.appName') }}
      </div>
      <div class="mt-1 font-mono text-sm opacity-80">
        <span class="font-bold">v{{ versionName }}</span>
      </div>
      <p class="mt-3 max-w-[520px] px-4 text-center text-sm leading-6 opacity-85">
        {{ $t('apps.about.description') }}
      </p>
      <div class="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm font-mono">
        <div>
          {{ $t('apps.about.repository') }}
          <a href="https://github.com/Tleon-H/leon-panel" target="_blank" class="link">Tleon-H/leon-panel</a>
        </div>
        <div>
          {{ $t('apps.about.license') }}
          <a href="https://github.com/Tleon-H/leon-panel/blob/master/LICENSE" target="_blank" class="link">MIT</a>
        </div>
      </div>
    </div>

    <div class="mt-5 flex justify-center">
      <NTag :bordered="true" size="small" class="font-mono">
        {{ $t("apps.about.frontVersionText") }}: FV-{{ frontVersion }}
      </NTag>
    </div>
  </div>
</template>

<style scoped>
.about-logo-frame {
  padding: 10px;
  border: 1.5px solid var(--leon-ui-border, #18181b);
  background: var(--leon-ui-canvas, #f4f1ea);
  box-shadow: 4px 4px 0 0 var(--leon-ui-border, #18181b);
}
</style>

<style>
.link {
  color: var(--leon-ui-primary, #2563eb);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
