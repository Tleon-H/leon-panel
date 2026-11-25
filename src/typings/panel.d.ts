declare namespace Panel {

    interface Info extends ItemInfo {

    }

    interface ItemInfo extends Common.InfoBase {
        icon: ItemIcon |null
        title: string
        url: string
        sort?: number
        lanUrl?: string
        description?: string
        openMethod: number
        itemIconGroupId ?:number
    }

    interface ItemIconGroup extends Common.InfoBase {
        icon?: string
        title?: string
        sort?:number
        /** 未设置时跟随全局图标样式。0 是详情大卡片，1 是小图标。 */
        iconStyle?: number | null
    }

    interface ItemIcon {
        itemType: number
        src ?: string
        text ?: string
        // bgColor ?: string
        backgroundColor ?: string
        imageFit ?: 'cover' | 'contain'
    }

    type AppearancePresetId =
        | 'obsidian-slate'
        | 'alabaster-paper'
        | 'bauhaus-grid'
        | 'swiss-paper'
        | 'mono-ink'
        | 'blueprint-slate'
        | 'nordic-stone'
        | 'ocean-glass'
        | 'mist-paper'
        | 'midnight-graphite'
    type CardSurfacePresetId = 'default' | AppearancePresetId
    type IconBadgeStyleId = 'default' | 'precision' | 'bauhaus' | 'glass' | 'soft' | 'outline'
    type PanelLayoutMode = 'standard' | 'compact' | 'dock'
    type WallpaperTone = 'dark' | 'light'
    type CloudConfigLoadState = 'idle' | 'loading' | 'ready' | 'error'

    interface AppearancePresetScopes {
        wallpaper: boolean
        cardStyle: boolean
        iconStyle: boolean
    }

    interface State {
        rightSiderCollapsed: boolean
        leftSiderCollapsed: boolean
        networkMode:PanelStateNetworkModeEnum | null
        ownerUserId?: number | null
        panelConfig:panelConfig
        previewPresetId?: AppearancePresetId | null
        previewScopes?: AppearancePresetScopes
        lastSyncedPanelJson?: string
        cloudConfigState?: CloudConfigLoadState
        cloudConfigError?: string
    }

    interface panelConfig{
        backgroundImageSrc?:string
        backgroundBlur?:number
        backgroundMaskNumber?:number
        wallpaperTone?: WallpaperTone
        cardSurface?: CardSurfacePresetId
        cardBackgroundColor?: string
        cardBorderColor?: string
        cardBlur?: number
        cardBorderRadius?: number
        cardAccentColor?: string
        layoutMode?: PanelLayoutMode
        iconStyle?:PanelPanelConfigStyleEnum
        iconBadgeStyle?: IconBadgeStyleId
        iconMonochrome?: boolean
        iconTextColor?:string
        iconTextInfoHideDescription?:boolean
        iconTextIconHideTitle?:boolean
        logoText?:string
        logoImageSrc?:string
        clockShowSecond?:boolean
        clockColor?:string
        searchBoxShow?:boolean
        searchBoxSearchIcon?:boolean
        marginTop?:number
        marginBottom?:number
        maxWidth?:number
        maxWidthUnit:string
        marginX?:number
        footerHtml?:string
        systemMonitorShow?:boolean
        systemMonitorShowTitle?:boolean
        systemMonitorPublicVisitModeShow?:boolean
        netModeChangeButtonShow?:boolean
    }

    interface userConfig{
        panel:panelConfig
        searchEngine?:any
    }

    interface ItemIconSortRequest{
        sortItems:Common.SortItemRequest[]
        itemIconGroupId:number
    }
}

