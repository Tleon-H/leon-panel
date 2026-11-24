import { ss } from '@/utils/storage'
import { getStorage as getAuthStorage } from '@/store/modules/auth/helper'
import { normalizeMaxWidth } from '@/utils/panel/maxWidth'
import { APPEARANCE_PRESETS, DEFAULT_APPEARANCE_SCOPES, isPanelStateOwnedByAccount, normalizePanelAppearance, serializePanelConfig } from '@/utils/panel/appearance'
import { PanelPanelConfigStyleEnum, PanelStateNetworkModeEnum } from '@/enums'
const LOCAL_NAME = 'panelStorage'

const defaultFooterHtml = '<div class="flex justify-center text-slate-400 text-xs" style="margin-top:80px">Powered by <a href="https://github.com/Tleon-H/leon-panel" target="_blank" class="ml-[5px]">Leon Panel</a></div>'

export function defaultStatePanelConfig(): Panel.panelConfig {
  const preset = APPEARANCE_PRESETS['obsidian-slate']
  return normalizePanelAppearance<Panel.panelConfig>({
    backgroundImageSrc: preset.wallpaper.backgroundImageSrc,
    backgroundBlur: preset.wallpaper.backgroundBlur,
    backgroundMaskNumber: preset.wallpaper.backgroundMaskNumber,
    wallpaperTone: preset.wallpaper.wallpaperTone,
    cardSurface: preset.cardStyle.cardSurface,
    cardBackgroundColor: preset.cardStyle.cardBackgroundColor,
    cardBorderColor: preset.cardStyle.cardBorderColor,
    cardBlur: preset.cardStyle.cardBlur,
    cardBorderRadius: preset.cardStyle.cardBorderRadius,
    cardAccentColor: preset.cardStyle.cardAccentColor,
    iconStyle: PanelPanelConfigStyleEnum.info,
    iconBadgeStyle: preset.iconStyle.iconBadgeStyle,
    iconTextColor: preset.iconStyle.iconTextColor,
    iconTextInfoHideDescription: false,
    iconTextIconHideTitle: false,
    logoText: 'Leon Panel',
    logoImageSrc: '',
    clockShowSecond: false,
    searchBoxShow: true,
    searchBoxSearchIcon: true,
    marginBottom: 8,
    marginTop: 6,
    maxWidth: 1200,
    maxWidthUnit: 'px',
    marginX: 5,
    footerHtml: defaultFooterHtml,
    systemMonitorShow: false,
    systemMonitorShowTitle: true,
    systemMonitorPublicVisitModeShow: false,
    netModeChangeButtonShow: true,
  })
}

export function defaultState(): Panel.State {
  const panelConfig = { ...defaultStatePanelConfig() }
  return {
    rightSiderCollapsed: false,
    leftSiderCollapsed: false,
    networkMode: PanelStateNetworkModeEnum.wan,
    ownerUserId: null,
    panelConfig,
    previewPresetId: null,
    previewScopes: { ...DEFAULT_APPEARANCE_SCOPES },
    lastSyncedPanelJson: serializePanelConfig(panelConfig),
    cloudConfigState: 'idle',
    cloudConfigError: '',
  }
}

function currentActiveUserId(): number | null {
  const auth = getAuthStorage()
  if (!auth?.token)
    return null
  const id = auth.userInfo?.id
  return (typeof id === 'number' && Number.isInteger(id) && id > 0) ? id : null
}

export function getLocalState(): Panel.State {
  const localState = ss.get(LOCAL_NAME)
  const activeUserId = currentActiveUserId()

  if (localState && localState.ownerUserId !== undefined && !isPanelStateOwnedByAccount(localState.ownerUserId, activeUserId))
    return defaultState()

  const state: Panel.State = {
    ...defaultState(),
    ...localState,
    previewPresetId: null,
    previewScopes: { ...DEFAULT_APPEARANCE_SCOPES },
    cloudConfigState: 'idle',
    cloudConfigError: '',
  }
  state.panelConfig = normalizePanelAppearance<Panel.panelConfig>({
    ...defaultStatePanelConfig(),
    ...state.panelConfig,
    maxWidth: normalizeMaxWidth(state.panelConfig?.maxWidth),
  })
  state.lastSyncedPanelJson = serializePanelConfig(state.panelConfig)
  return state
}

export function setLocalState(state: Panel.State) {
  const {
    previewPresetId: _previewPresetId,
    previewScopes: _previewScopes,
    lastSyncedPanelJson: _lastSyncedPanelJson,
    cloudConfigState: _cloudConfigState,
    cloudConfigError: _cloudConfigError,
    ...persisted
  } = state
  ss.set(LOCAL_NAME, persisted)
}

export function removeLocalState() {
  ss.remove(LOCAL_NAME)
}
