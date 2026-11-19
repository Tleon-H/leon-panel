<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { browserHomeStorage, clearHomeSnapshots } from '@/utils/panel/homeSnapshot'

const router = useRouter()
const result = ref<'idle' | 'cleared' | 'empty' | 'unavailable'>('idle')

function clearCache() {
  try {
    const outcome = clearHomeSnapshots(browserHomeStorage())
    result.value = outcome.ok ? (outcome.removed ? 'cleared' : 'empty') : 'unavailable'
  }
  catch {
    result.value = 'unavailable'
  }
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <main class="home-cache-clear">
    <h1>{{ $t('homeCache.title') }}</h1>
    <p>{{ $t('homeCache.scope') }}</p>
    <p>{{ $t('homeCache.visit') }}</p>
    <p>{{ $t('homeCache.keeps') }}</p>
    <button type="button" data-testid="clear-home-cache" @click="clearCache">
      {{ $t('homeCache.button') }}
    </button>
    <p v-if="result !== 'idle'" role="status" data-testid="clear-home-cache-result">
      {{ $t(`homeCache.${result}`) }}
    </p>
    <button type="button" data-testid="clear-home-cache-home" @click="goHome">
      {{ $t('homeCache.backHome') }}
    </button>
  </main>
</template>

<style scoped>
.home-cache-clear {
  box-sizing: border-box;
  min-height: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 20px 64px;
  background: #f8fafc;
  color: #1f2937;
}

.home-cache-clear h1 {
  margin: 0 0 16px;
  font-size: 28px;
  line-height: 1.3;
}

.home-cache-clear p {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.6;
}

.home-cache-clear button {
  min-height: 40px;
  margin: 8px 8px 0 0;
  padding: 8px 16px;
  border: 0;
  border-radius: 10px;
  background: #111827;
  color: #fff;
  cursor: pointer;
}

.home-cache-clear button:focus-visible {
  outline: 2px solid #0284c7;
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .home-cache-clear {
    padding-top: 28px;
  }

  .home-cache-clear button {
    width: 100%;
    margin-right: 0;
  }
}
</style>
