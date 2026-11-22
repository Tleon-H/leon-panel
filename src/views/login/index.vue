<script setup lang="ts">
import { NButton, NForm, NFormItem, NInput, NSelect, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { login } from '@/api'
import { useAppStore, useAuthStore, usePanelState } from '@/store'
import { SvgIcon } from '@/components/common'
import { router } from '@/router'
import { t } from '@/locales'
import { languageOptions } from '@/utils/defaultData'
import type { Language } from '@/store/modules/app/helper'
import { type AccountSession, rememberAccount } from '@/utils/account/sessions'
import { setTitle } from '@/utils/cmn'
import { loadAccountSessions, saveAccountSessions } from '@/utils/account/storage'
import brandLogoSvg from '@/assets/logo.svg'

const authStore = useAuthStore()
const appStore = useAppStore()
const panelState = usePanelState()
const ms = useMessage()
const loading = ref(false)
const languageValue = ref<Language>(appStore.language)
const savedAccounts = ref<AccountSession[]>(loadAccountSessions())
const appVersion = import.meta.env.VITE_APP_VERSION || '0.1.0'

const form = ref<Login.LoginReqest>({
  username: '',
  password: '',
})

const loginPost = async () => {
  loading.value = true
  try {
    const res = await login<Login.LoginResponse>(form.value)
    if (res.code === 0) {
      const next = rememberAccount(savedAccounts.value, res.data)
      saveAccountSessions(next)
      savedAccounts.value = next
      panelState.removeState()
      authStore.setToken(res.data.token)
      authStore.setUserInfo(res.data)

      setTimeout(() => {
        ms.success(`Hi ${res.data.name},${t('login.welcomeMessage')}`)
        loading.value = false
        router.push({ path: '/' })
      }, 500)
    }
    else {
      loading.value = false
    }
  }
  catch (error) {
    loading.value = false
    console.log(error)
  }
}

function resume(session: AccountSession) {
  panelState.removeState()
  authStore.setToken(session.token)
  authStore.setUserInfo({
    id: session.id,
    username: session.username,
    name: session.name,
    role: session.role,
  })
  router.push({ path: '/' })
}

function handleSubmit() {
  loginPost()
}

function handleChangeLanuage(value: Language) {
  languageValue.value = value
  appStore.setLanguage(value)
  setTitle(t('common.appName'))
}

onMounted(() => {
  setTitle(t('common.appName'))
})
</script>

<template>
  <div class="login-container">
    <div class="login-shell">
      <!-- Bauhaus Geometric Brand Poster Column -->
      <div class="login-poster">
        <div class="login-poster-top">
          <div class="login-logo-box">
            <img :src="brandLogoSvg" width="48" height="48" :alt="$t('common.appName')">
          </div>
          <span class="login-version-chip">v{{ appVersion }}</span>
        </div>

        <div class="login-geo-art" aria-hidden="true">
          <svg viewBox="0 0 200 104" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="44" height="44" fill="#2563EB" />
            <circle cx="78" cy="22" r="22" fill="#FF4F00" />
            <polygon points="112,44 138,0 164,44" fill="#EAB308" />
            <rect x="0" y="56" width="100" height="16" fill="currentColor" />
            <rect x="112" y="56" width="88" height="16" fill="currentColor" fill-opacity="0.22" />
            <rect x="0" y="84" width="200" height="4" fill="currentColor" fill-opacity="0.32" />
            <rect x="0" y="84" width="56" height="4" fill="#FF4F00" />
          </svg>
        </div>

        <div class="login-poster-footer">
          <h1 class="login-brand-name">
            {{ $t('common.appName') }}
          </h1>
          <p class="login-brand-sub">
            HOMELAB // GEOMETRIC NAVIGATOR
          </p>
        </div>
      </div>

      <!-- Flat Architectural Form Column -->
      <div class="login-form-pane">
        <div class="login-topbar">
          <div class="login-section-tag">
            <span class="login-tag-dot" />
            <span>{{ $t('login.loginButton') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <SvgIcon icon="ion-language" style="width: 18px; height: 18px;" />
            <div class="min-w-[104px]">
              <NSelect v-model:value="languageValue" size="small" :options="languageOptions" @update-value="handleChangeLanuage" />
            </div>
          </div>
        </div>

        <div v-if="savedAccounts.length" class="saved-accounts">
          <div class="saved-accounts-label">
            {{ $t('apps.accountSwitch.savedOnThisBrowser') }}
          </div>
          <div class="saved-accounts-list">
            <NButton
              v-for="item in savedAccounts"
              :key="item.id"
              block
              secondary
              class="saved-account-btn"
              :data-username="item.username"
              @click="resume(item)"
            >
              {{ item.name }}（{{ item.username }}）
            </NButton>
          </div>
        </div>

        <NForm :model="form" label-width="100px" @keydown.enter="handleSubmit">
          <NFormItem :show-label="false">
            <NInput v-model:value="form.username" size="large" :placeholder="$t('login.usernamePlaceholder')">
              <template #prefix>
                <SvgIcon icon="ph:user-bold" />
              </template>
            </NInput>
          </NFormItem>

          <NFormItem :show-label="false">
            <NInput v-model:value="form.password" size="large" type="password" show-password-on="click" :placeholder="$t('login.passwordPlaceholder')">
              <template #prefix>
                <SvgIcon icon="mdi:password-outline" />
              </template>
            </NInput>
          </NFormItem>

          <NFormItem :show-label="false" style="margin-top: 8px; margin-bottom: 12px;">
            <NButton type="primary" size="large" block :loading="loading" @click="handleSubmit">
              {{ $t('login.loginButton') }}
            </NButton>
          </NFormItem>
        </NForm>

        <div class="login-footer">
          <a href="https://github.com/Tleon-H/leon-panel" target="_blank" class="login-repo-link">
            {{ $t('common.appName') }} · GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--leon-ui-canvas, #f4f1ea);
  background-image:
    linear-gradient(to right, rgba(9, 9, 11, 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(9, 9, 11, 0.06) 1px, transparent 1px);
  background-size: 32px 32px;
}

.login-shell {
  width: 100%;
  max-width: 780px;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  background: var(--leon-ui-surface, #ffffff);
  border: 2px solid #09090b;
  border-radius: var(--leon-ui-modal-radius, 0px);
  box-shadow: 6px 6px 0 0 #09090b;
  overflow: hidden;
}

.login-poster {
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #09090b;
  color: #fafafa;
  border-right: 2px solid #09090b;
}

.login-poster-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.login-logo-box {
  padding: 6px;
  background: #f4f1ea;
  border: 1.5px solid #fafafa;
}

.login-version-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border: 1px solid rgba(250, 250, 250, 0.4);
  letter-spacing: 0.06em;
}

.login-geo-art {
  margin: 28px 0;
  color: #fafafa;
}

.login-brand-name {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}

.login-brand-sub {
  margin: 6px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #a1a1aa;
}

.login-form-pane {
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
}

.login-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--leon-ui-border, #e4e4e7);
}

.login-section-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.login-tag-dot {
  width: 8px;
  height: 8px;
  background: var(--leon-ui-primary, #ff4f00);
}

.saved-accounts {
  margin-bottom: 4px;
}

.saved-accounts-label {
  font-size: 12px;
  color: #52525b;
  margin-bottom: 8px;
}

.saved-accounts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-footer {
  padding-top: 12px;
  border-top: 1px solid var(--leon-ui-border, #e4e4e7);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.login-repo-link {
  color: #52525b;
  text-decoration: none;
  transition: color 0.15s ease;
}

.login-repo-link:hover {
  color: var(--leon-ui-primary, #ff4f00);
}

@media (max-width: 720px) {
  .login-shell {
    grid-template-columns: 1fr;
    max-width: 440px;
  }

  .login-poster {
    padding: 20px;
    border-right: none;
    border-bottom: 2px solid #09090b;
  }

  .login-geo-art {
    display: none;
  }

  .login-poster-footer {
    margin-top: 14px;
  }

  .login-form-pane {
    padding: 22px 20px;
  }
}
</style>

<style>
.dark .login-container {
  background-color: #09090b;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
}

.dark .login-shell {
  border-color: #27272a;
  box-shadow: 6px 6px 0 0 var(--leon-ui-primary, #ff4f00);
}

.dark .login-poster {
  background: #121215;
  border-color: #27272a;
}

.dark .saved-accounts-label,
.dark .login-repo-link {
  color: #a1a1aa;
}
</style>
