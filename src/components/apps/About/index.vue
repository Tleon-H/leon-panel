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
        <img :src="srcSvglogo" width="84" height="84" alt="Leon Panel" class="block rounded-[14px]">
      </div>
      <div class="text-2xl font-bold tracking-tight">
        {{ $t('common.appName') }}
      </div>
      <div class="mt-1 font-mono text-sm opacity-75">
        <span class="font-semibold">v{{ versionName }}</span>
      </div>
      <p class="mt-3 max-w-[520px] px-4 text-center text-sm leading-6 opacity-85">
        {{ $t('apps.about.description') }}
      </p>
      <div class="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm font-mono">
        <div>
          {{ $t('apps.about.repository') }}
          <a href="https://github.com/Tleon-H/leon-panel" target="_blank" rel="noopener noreferrer" class="link">Tleon-H/leon-panel</a>
        </div>
        <div>
          {{ $t('apps.about.license') }}
          <a href="https://github.com/Tleon-H/leon-panel/blob/master/LICENSE" target="_blank" rel="noopener noreferrer" class="link">MIT</a>
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
  border: 1px solid var(--leon-ui-border, rgba(148, 163, 184, 0.25));
  border-radius: var(--leon-ui-modal-radius, 16px);
  background: var(--leon-ui-canvas, #f4f4f1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
}
</style>

<style>
.link {
  color: var(--leon-ui-primary, #0ea5e9);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
