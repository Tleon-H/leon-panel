export interface HomelabIconPreset {
  id: string
  label: string
  keywords: string
  icon: string
  bg: string
  category: 'infra' | 'storage' | 'network' | 'media' | 'ai'
}

export const BUNDLED_LOCAL_ICON_NAMES = [
  'lucide:activity',
  'lucide:arrow-left-right',
  'lucide:arrow-up',
  'lucide:arrow-up-down',
  'lucide:book-open',
  'lucide:bookmark',
  'lucide:bot',
  'lucide:boxes',
  'lucide:calendar',
  'lucide:check',
  'lucide:chevron-down',
  'lucide:chevron-right',
  'lucide:chevron-up',
  'lucide:cloud',
  'lucide:code-2',
  'lucide:compass',
  'lucide:container',
  'lucide:copy',
  'lucide:cpu',
  'lucide:database',
  'lucide:download',
  'lucide:download-cloud',
  'lucide:external-link',
  'lucide:file-down',
  'lucide:file-up',
  'lucide:film',
  'lucide:folder-kanban',
  'lucide:folder-open',
  'lucide:gauge',
  'lucide:git-branch',
  'lucide:globe',
  'lucide:grip-vertical',
  'lucide:hard-drive',
  'lucide:home',
  'lucide:image',
  'lucide:images',
  'lucide:info',
  'lucide:key-round',
  'lucide:languages',
  'lucide:layout-grid',
  'lucide:lock',
  'lucide:log-out',
  'lucide:mail',
  'lucide:memory-stick',
  'lucide:message-square',
  'lucide:more-horizontal',
  'lucide:music',
  'lucide:network',
  'lucide:notebook-pen',
  'lucide:palette',
  'lucide:panel-left-close',
  'lucide:panel-left-open',
  'lucide:pencil',
  'lucide:play-circle',
  'lucide:plus',
  'lucide:radar',
  'lucide:radio',
  'lucide:refresh-cw',
  'lucide:route',
  'lucide:router',
  'lucide:rss',
  'lucide:search',
  'lucide:server',
  'lucide:shield-check',
  'lucide:sparkles',
  'lucide:terminal',
  'lucide:trash-2',
  'lucide:tv',
  'lucide:upload',
  'lucide:user',
  'lucide:user-cog',
  'lucide:users',
  'lucide:wallpaper',
  'lucide:workflow',
  'lucide:wrench',
  'lucide:x',
] as const

const BUNDLED_LOCAL_ICON_SET = new Set<string>(BUNDLED_LOCAL_ICON_NAMES)

export function normalizeLocalIconKey(name?: string | null): string {
  const raw = (name ?? '').trim().toLowerCase()
  if (!raw)
    return ''
  if (raw.includes(':'))
    return raw
  if (raw.startsWith('lucide-'))
    return `lucide:${raw.slice('lucide-'.length)}`
  return raw
}

export function isBundledLocalIcon(name?: string | null): boolean {
  const normalized = normalizeLocalIconKey(name)
  return normalized !== '' && BUNDLED_LOCAL_ICON_SET.has(normalized)
}

export function computeDynamicVectorSize(containerSize: number): number {
  const safe = (Number.isFinite(containerSize) && containerSize > 0) ? containerSize : 70
  return Math.max(16, Math.round(safe * 0.56))
}

export function computeDynamicImagePadding(containerSize: number): number {
  const safe = (Number.isFinite(containerSize) && containerSize > 0) ? containerSize : 70
  if (safe <= 36)
    return 4
  if (safe <= 52)
    return 6
  return 10
}

// Curated harmonious, muted-yet-distinct tones for monogram fallbacks (WCAG AA compliant with white ink)
const MONOGRAM_PALETTE = [
  '#1E3A5F', // Deep Slate Blue
  '#155E75', // Deep Cyan
  '#0F766E', // Forest Teal
  '#3F6212', // Moss Olive
  '#9A3412', // Burnt Sienna
  '#9F1239', // Deep Rose
  '#3730A3', // Indigo Ink
  '#334155', // Graphite Slate
]

export function computeMonogramBackground(seed?: string | null): string {
  const text = (seed ?? '').trim()
  if (!text)
    return MONOGRAM_PALETTE[0]
  let hash = 0
  for (let i = 0; i < text.length; i++)
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  return MONOGRAM_PALETTE[Math.abs(hash) % MONOGRAM_PALETTE.length]
}

// 36 offline, zero-CDN Homelab / Self-Hosted curated presets (all backed by local SVG sprites)
export const HOMELAB_ICON_PRESETS: readonly HomelabIconPreset[] = [
  // Infra & Containers
  { id: 'docker', label: 'Docker', keywords: 'docker container 容器', icon: 'lucide:container', bg: '#0284C7', category: 'infra' },
  { id: 'portainer', label: 'Portainer', keywords: 'portainer stack compose 容器管理', icon: 'lucide:boxes', bg: '#0369A1', category: 'infra' },
  { id: 'proxmox', label: 'Proxmox', keywords: 'proxmox pve vm esxi 虚拟机 服务器', icon: 'lucide:server', bg: '#EA580C', category: 'infra' },
  { id: 'terminal', label: 'Terminal', keywords: 'ssh shell terminal 终端 控制台', icon: 'lucide:terminal', bg: '#18181B', category: 'infra' },
  { id: 'grafana', label: 'Monitor', keywords: 'grafana prometheus uptime kuma 监控 仪表盘', icon: 'lucide:activity', bg: '#D97706', category: 'infra' },
  { id: 'speedtest', label: 'Speedtest', keywords: 'speedtest netdata metrics 测速 性能', icon: 'lucide:gauge', bg: '#0D9488', category: 'infra' },
  { id: 'database', label: 'Database', keywords: 'postgres mysql redis sqlite 数据库', icon: 'lucide:database', bg: '#2563EB', category: 'infra' },
  { id: 'gitea', label: 'Git / Code', keywords: 'gitea github gitlab git 仓库 代码', icon: 'lucide:git-branch', bg: '#15803D', category: 'infra' },
  { id: 'vscode', label: 'Code Server', keywords: 'vscode ide code 开发 编辑器', icon: 'lucide:code-2', bg: '#1D4ED8', category: 'infra' },
  { id: 'workflow', label: 'Automation', keywords: 'n8n qinglong 青龙 自动化 任务', icon: 'lucide:workflow', bg: '#0F766E', category: 'infra' },
  { id: 'compute', label: 'CPU / Node', keywords: 'cpu node cluster 节点 算力', icon: 'lucide:cpu', bg: '#334155', category: 'infra' },

  // NAS & Storage
  { id: 'nas', label: 'NAS / Disk', keywords: 'synology unraid truenas fnos nas 群晖 飞牛 存储', icon: 'lucide:hard-drive', bg: '#1E40AF', category: 'storage' },
  { id: 'alist', label: 'Alist / Files', keywords: 'alist filebrowser openlist 网盘 文件', icon: 'lucide:folder-open', bg: '#0EA5E9', category: 'storage' },
  { id: 'nextcloud', label: 'Cloud Drive', keywords: 'nextcloud owncloud cloud 云盘 同步', icon: 'lucide:cloud', bg: '#0284C7', category: 'storage' },
  { id: 'qbittorrent', label: 'Downloader', keywords: 'qbittorrent transmission aria2 pt bt 下载', icon: 'lucide:download-cloud', bg: '#0F766E', category: 'storage' },

  // Network & Security
  { id: 'router', label: 'Router / OpenWrt', keywords: 'openwrt ikuai router ros 路由 软路由', icon: 'lucide:router', bg: '#0F172A', category: 'network' },
  { id: 'adguard', label: 'AdGuard / DNS', keywords: 'adguard pihole dns firewall 去广告 防火墙', icon: 'lucide:shield-check', bg: '#059669', category: 'network' },
  { id: 'proxy', label: 'Nginx / Proxy', keywords: 'nginx npm traefik caddy 反代 网关', icon: 'lucide:route', bg: '#15803D', category: 'network' },
  { id: 'vault', label: 'Vaultwarden', keywords: 'vaultwarden bitwarden password 密码', icon: 'lucide:key-round', bg: '#1D4ED8', category: 'network' },
  { id: 'vpn', label: 'Tailscale / VPN', keywords: 'tailscale wireguard zerotier vpn 组网', icon: 'lucide:radio', bg: '#334155', category: 'network' },
  { id: 'cloudflare', label: 'DNS / Tunnel', keywords: 'cloudflare ddns tunnel 穿透 域名', icon: 'lucide:radar', bg: '#EA580C', category: 'network' },
  { id: 'lan', label: 'LAN Switch', keywords: 'lan switch subnet 内网 交换机', icon: 'lucide:network', bg: '#475569', category: 'network' },
  { id: 'web', label: 'Web Portal', keywords: 'web site portal 网站 外网', icon: 'lucide:globe', bg: '#0369A1', category: 'network' },

  // Media & Smart Home
  { id: 'jellyfin', label: 'Jellyfin / Emby', keywords: 'jellyfin emby plex media 影音 电影', icon: 'lucide:play-circle', bg: '#4338CA', category: 'media' },
  { id: 'immich', label: 'Immich / Photos', keywords: 'immich photoprism photo 相册 照片', icon: 'lucide:image', bg: '#E11D48', category: 'media' },
  { id: 'arr', label: 'Sonarr / Radarr', keywords: 'sonarr radarr moviepilot 追剧 影视', icon: 'lucide:film', bg: '#B45309', category: 'media' },
  { id: 'music', label: 'Navidrome', keywords: 'navidrome music spotify 音乐', icon: 'lucide:music', bg: '#059669', category: 'media' },
  { id: 'tv', label: 'Live TV', keywords: 'iptv tv live 电视 直播', icon: 'lucide:tv', bg: '#334155', category: 'media' },
  { id: 'homeassistant', label: 'Home Assistant', keywords: 'homeassistant hass smart home 智能家居', icon: 'lucide:home', bg: '#0284C7', category: 'media' },
  { id: 'wiki', label: 'Wiki / Books', keywords: 'calibre audiobookshelf wiki docs 电子书 文档', icon: 'lucide:book-open', bg: '#0F766E', category: 'media' },

  // AI & Productivity
  { id: 'ai', label: 'Ollama / AI', keywords: 'ollama openwebui chatgpt ai llm 大模型', icon: 'lucide:bot', bg: '#18181B', category: 'ai' },
  { id: 'notes', label: 'Memos / Notes', keywords: 'memos trilium notion notes 笔记 便签', icon: 'lucide:notebook-pen', bg: '#D97706', category: 'ai' },
  { id: 'rss', label: 'FreshRSS', keywords: 'freshrss miniflux rss 订阅 阅读', icon: 'lucide:rss', bg: '#EA580C', category: 'ai' },
  { id: 'mail', label: 'Webmail', keywords: 'mail roundcube email 邮箱 邮件', icon: 'lucide:mail', bg: '#2563EB', category: 'ai' },
  { id: 'tools', label: 'IT-Tools', keywords: 'it-tools toolbox util 工具箱', icon: 'lucide:wrench', bg: '#475569', category: 'ai' },
  { id: 'bookmarks', label: 'Bookmarks', keywords: 'linkding bookmark 书签 收藏', icon: 'lucide:bookmark', bg: '#0369A1', category: 'ai' },
]

export function filterHomelabPresets(keyword: string): readonly HomelabIconPreset[] {
  const q = keyword.trim().toLowerCase()
  if (!q)
    return HOMELAB_ICON_PRESETS
  return HOMELAB_ICON_PRESETS.filter(item =>
    item.label.toLowerCase().includes(q)
    || item.keywords.toLowerCase().includes(q)
    || item.icon.toLowerCase().includes(q),
  )
}
