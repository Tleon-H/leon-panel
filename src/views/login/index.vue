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
const appVersion = import.meta.env.VITE_APP_VERSION || '0.3.0'

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
      <!-- Precision Brand Identity Column -->
      <div class="login-poster">
        <div class="login-poster-top">
          <div class="login-logo-box">
            <img :src="brandLogoSvg" width="44" height="44" :alt="$t('common.appName')" class="block rounded-[10px]">
          </div>
          <span class="login-version-chip">v{{ appVersion }}</span>
        </div>

        <div class="login-poster-features" aria-hidden="true">
          <div class="login-metric-pill">
            <SvgIcon icon="lucide:server" class="text-[14px]" />
            <span>Homelab &amp; NAS</span>
          </div>
          <div class="login-metric-pill">
            <SvgIcon icon="lucide:container" class="text-[14px]" />
            <span>Self-Hosted Services</span>
          </div>
          <div class="login-metric-pill">
            <SvgIcon icon="lucide:network" class="text-[14px]" />
            <span>LAN / WAN Dual Mode</span>
          </div>
        </div>

        <div class="login-poster-footer">
          <h1 class="login-brand-name">
            {{ $t('common.appName') }}
          </h1>
          <p class="login-brand-sub">
            PRECISION HOMELAB NAVIGATOR
          </p>
        </div>
      </div>

      <!-- Precision Form Column -->
      <div class="login-form-pane">
        <div class="login-topbar">
          <div class="login-section-tag">
            <span class="login-tag-dot" />
            <span>{{ $t('login.loginButton') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <SvgIcon icon="lucide:languages" class="w-[16px] h-[16px] opacity-70" />
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
                <SvgIcon icon="lucide:user" class="text-[16px] opacity-65" />
              </template>
            </NInput>
          </NFormItem>

          <NFormItem :show-label="false">
            <NInput v-model:value="form.password" size="large" type="password" show-password-on="click" :placeholder="$t('login.passwordPlaceholder')">
              <template #prefix>
                <SvgIcon icon="lucide:lock" class="text-[16px] opacity-65" />
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
          <a href="https://github.com/Tleon-H/leon-panel" target="_blank" rel="noopener noreferrer" class="login-repo-link">
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
  background-color: var(--leon-ui-canvas, #f4f4f1);
  background-image: radial-gradient(ellipse 72% 55% at 50% 0%, rgba(14, 165, 233, 0.08), transparent 70%);
}

.login-shell {
  width: 100%;
  max-width: 780px;
  display: grid;
  grid-template-columns: 284px minmax(0, 1fr);
  background: var(--leon-ui-surface, #ffffff);
  border: 1px solid var(--leon-ui-border, rgba(15, 23, 42, 0.1));
  border-radius: 16px;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.1), 0 2px 6px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.login-poster {
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: linear-gradient(160deg, #11151e 0%, #0b0d11 100%);
  color: #f8fafc;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.login-poster-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.login-logo-box {
  padding: 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.login-version-chip {
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  letter-spacing: 0.04em;
}

.login-poster-features {
  margin: 28px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.login-metric-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: #cbd5e1;
  font-size: 12.5px;
  font-weight: 500;
}

.login-brand-name {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.login-brand-sub {
  margin: 6px 0 0;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #94a3b8;
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
  border-bottom: 1px solid var(--leon-ui-border, #e2e8f0);
}

.login-section-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.login-tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--leon-ui-primary, #0ea5e9);
}

.saved-accounts {
  margin-bottom: 4px;
}

.saved-accounts-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}

.saved-accounts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-footer {
  padding-top: 12px;
  border-top: 1px solid var(--leon-ui-border, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--leon-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
}

.login-repo-link {
  color: #64748b;
  text-decoration: none;
  transition: color 0.15s ease;
}

.login-repo-link:hover {
  color: var(--leon-ui-primary, #0ea5e9);
}

@media (max-width: 720px) {
  .login-shell {
    grid-template-columns: 1fr;
    max-width: 440px;
  }

  .login-poster {
    padding: 20px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .login-poster-features {
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
  background-color: #0b0d11;
  background-image: radial-gradient(ellipse 72% 55% at 50% 0%, rgba(14, 165, 233, 0.12), transparent 70%);
}

.dark .login-shell {
  background: #14171f;
  border-color: rgba(255, 255, 255, 0.09);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.56), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.dark .login-poster {
  background: linear-gradient(160deg, #0f131b 0%, #090b10 100%);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark .saved-accounts-label,
.dark .login-repo-link {
  color: #94a3b8;
}
</style>
