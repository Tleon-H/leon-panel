import type { GlobalThemeOverrides } from 'naive-ui'
import { computed, watch } from 'vue'
import { darkTheme, useOsTheme } from 'naive-ui'
import { useAppStore, usePanelState } from '@/store'
import { buildNaiveThemeBundle } from '@/utils/panel/naiveTheme'

export function useTheme() {
  const appStore = useAppStore()
  const panelState = usePanelState()

  const OsTheme = useOsTheme()

  const isDark = computed(() => {
    if (appStore.theme === 'auto')
      return OsTheme.value === 'dark'
    else
      return appStore.theme === 'dark'
  })

  const theme = computed(() => {
    return isDark.value ? darkTheme : undefined
  })

  const themeBundle = computed(() => buildNaiveThemeBundle(panelState.activePanelConfig, isDark.value))

  const themeOverrides = computed<GlobalThemeOverrides>(() => themeBundle.value.overrides)

  watch(
    () => isDark.value,
    (dark) => {
      if (dark)
        document.documentElement.classList.add('dark')
      else
        document.documentElement.classList.remove('dark')
    },
    { immediate: true },
  )

  watch(
    () => themeBundle.value.cssVars,
    (vars) => {
      const root = document.documentElement
      for (const [key, value] of Object.entries(vars))
        root.style.setProperty(key, value)
    },
    { immediate: true, deep: true },
  )

  return { theme, themeOverrides, isDark }
}
