export type OnlineIconFormat = 'svg' | 'png'
export type OnlineIconCategory = 'all' | 'popular' | 'homelab' | 'dev' | 'ai' | 'media' | 'cloud'
export type OnlineWallpaperCategory = 'all' | 'dark' | 'nature' | 'minimal' | 'light'

export interface OnlineIconEntry {
  id: string
  name: string
  slug: string
  category: Exclude<OnlineIconCategory, 'all'>
  keywords: string
  svgUrl: string
  pngUrl: string
  source: 'dashboard-icons' | 'iconify'
}

export interface DomainFaviconCandidate {
  id: string
  provider: string
  badge: string
  url: string
}

export interface OnlineWallpaperEntry {
  id: string
  title: string
  category: Exclude<OnlineWallpaperCategory, 'all'>
  thumbUrl: string
  fullUrl: string
  source: string
}

export const DASHBOARD_ICONS_CDN_BASE = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons'
export const DASHBOARD_ICONS_TREE_URL = `${DASHBOARD_ICONS_CDN_BASE}/tree.json`
export const ICONIFY_SEARCH_API = 'https://api.iconify.design/search'
export const ICONIFY_BRAND_PREFIXES = 'logos,skill-icons,devicon,simple-icons,flat-color-icons,vscode-icons'

export function buildDashboardIconUrl(slug: string, format: OnlineIconFormat = 'svg'): string {
  const safe = slug.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  if (!safe)
    return ''
  return `${DASHBOARD_ICONS_CDN_BASE}/${format}/${safe}.${format}`
}

export function resolveOnlineIconUrl(entry: OnlineIconEntry, format: OnlineIconFormat = 'svg'): string {
  if (entry.source === 'iconify')
    return entry.svgUrl
  if (format === 'png' && entry.pngUrl)
    return entry.pngUrl
  return entry.svgUrl || entry.pngUrl
}

function di(
  slug: string,
  name: string,
  category: Exclude<OnlineIconCategory, 'all'>,
  keywords: string,
): OnlineIconEntry {
  return {
    id: `di:${slug}`,
    name,
    slug,
    category,
    keywords,
    svgUrl: buildDashboardIconUrl(slug, 'svg'),
    pngUrl: buildDashboardIconUrl(slug, 'png'),
    source: 'dashboard-icons',
  }
}

// Curated HD icons (websites, AI, Dev, Homelab/NAS, Media, Cloud) with bilingual search keywords
export const CURATED_WEBSITE_ICONS: readonly OnlineIconEntry[] = [
  // Popular Websites & Social
  di('google', 'Google', 'popular', 'google 谷歌 搜索 search'),
  di('youtube', 'YouTube', 'popular', 'youtube 油管 视频 video'),
  di('bilibili', 'Bilibili', 'popular', 'bilibili b站 哔哩哔哩 视频'),
  di('github', 'GitHub', 'dev', 'github 代码 开源 git repo'),
  di('gitlab', 'GitLab', 'dev', 'gitlab git 代码 仓库'),
  di('x', 'X (Twitter)', 'popular', 'twitter x 推特 社交'),
  di('reddit', 'Reddit', 'popular', 'reddit 论坛 社区'),
  di('discord', 'Discord', 'popular', 'discord 语音 聊天 社区'),
  di('telegram', 'Telegram', 'popular', 'telegram tg 电报 聊天'),
  di('whatsapp', 'WhatsApp', 'popular', 'whatsapp 聊天 通讯'),
  di('notion', 'Notion', 'popular', 'notion 笔记 文档 知识库'),
  di('obsidian', 'Obsidian', 'popular', 'obsidian 笔记 markdown 知识库'),
  di('figma', 'Figma', 'popular', 'figma 设计 ui 原型'),
  di('wikipedia', 'Wikipedia', 'popular', 'wikipedia 维基百科 百科'),
  di('gmail', 'Gmail', 'popular', 'gmail 邮箱 邮件 mail google'),
  di('outlook', 'Outlook', 'popular', 'outlook 邮箱 微软 mail'),
  di('apple', 'Apple', 'popular', 'apple 苹果 icloud mac'),
  di('microsoft', 'Microsoft', 'popular', 'microsoft 微软 office 365'),
  di('steam', 'Steam', 'popular', 'steam 游戏 game'),
  di('twitch', 'Twitch', 'popular', 'twitch 直播 游戏'),
  di('pinterest', 'Pinterest', 'popular', 'pinterest 灵感 图库 设计'),
  di('zhihu', 'Zhihu', 'popular', 'zhihu 知乎 问答 社区'),
  di('weibo', 'Weibo', 'popular', 'weibo 微博 社交'),
  di('douban', 'Douban', 'popular', 'douban 豆瓣 电影 书评'),
  di('taobao', 'Taobao', 'popular', 'taobao 淘宝 购物 电商'),
  di('jd', 'JD', 'popular', 'jd 京东 购物 电商'),
  di('baidu', 'Baidu', 'popular', 'baidu 百度 搜索 网盘'),

  // AI & LLM
  di('chatgpt', 'ChatGPT / OpenAI', 'ai', 'chatgpt openai gpt ai 大模型'),
  di('claude', 'Claude', 'ai', 'claude anthropic ai 大模型'),
  di('google-gemini', 'Google Gemini', 'ai', 'gemini google ai 大模型'),
  di('deepseek', 'DeepSeek', 'ai', 'deepseek 深度求索 ai 大模型'),
  di('perplexity', 'Perplexity', 'ai', 'perplexity ai 搜索'),
  di('ollama', 'Ollama', 'ai', 'ollama llm 本地大模型 ai'),
  di('open-webui', 'Open WebUI', 'ai', 'open-webui openwebui chat ai'),
  di('huggingface', 'Hugging Face', 'ai', 'huggingface hf 模型 ai'),
  di('dify', 'Dify', 'ai', 'dify ai agent 工作流'),
  di('n8n', 'n8n', 'ai', 'n8n 自动化 workflow 工作流'),

  // Homelab, NAS & Infra
  di('docker', 'Docker', 'homelab', 'docker 容器 container'),
  di('portainer', 'Portainer', 'homelab', 'portainer docker 容器管理'),
  di('proxmox', 'Proxmox VE', 'homelab', 'proxmox pve 虚拟机 虚拟化'),
  di('synology', 'Synology', 'homelab', 'synology 群晖 dsm nas 存储'),
  di('truenas', 'TrueNAS', 'homelab', 'truenas nas 存储 zfs'),
  di('unraid', 'Unraid', 'homelab', 'unraid nas 虚拟化 存储'),
  di('openwrt', 'OpenWrt', 'homelab', 'openwrt 软路由 路由器 router'),
  di('opnsense', 'OPNsense', 'homelab', 'opnsense 防火墙 路由 firewall'),
  di('pfsense', 'pfSense', 'homelab', 'pfsense 防火墙 路由'),
  di('adguard-home', 'AdGuard Home', 'homelab', 'adguard dns 去广告 过滤'),
  di('pi-hole', 'Pi-hole', 'homelab', 'pihole pi-hole dns 去广告'),
  di('nginx-proxy-manager', 'Nginx Proxy Manager', 'homelab', 'nginx npm 反代 反向代理'),
  di('traefik', 'Traefik', 'homelab', 'traefik 反代 网关 proxy'),
  di('caddy', 'Caddy', 'homelab', 'caddy 反代 web server'),
  di('tailscale', 'Tailscale', 'homelab', 'tailscale vpn 组网 内网穿透'),
  di('wireguard', 'WireGuard', 'homelab', 'wireguard vpn 隧道 组网'),
  di('zerotier', 'ZeroTier', 'homelab', 'zerotier 组网 内网穿透'),
  di('home-assistant', 'Home Assistant', 'homelab', 'homeassistant hass 智能家居'),
  di('grafana', 'Grafana', 'homelab', 'grafana 监控 仪表盘 可视化'),
  di('prometheus', 'Prometheus', 'homelab', 'prometheus 监控 metrics'),
  di('uptime-kuma', 'Uptime Kuma', 'homelab', 'uptime kuma 监控 状态页'),
  di('netdata', 'Netdata', 'homelab', 'netdata 系统监控 实时性能'),
  di('vaultwarden', 'Vaultwarden', 'homelab', 'vaultwarden bitwarden 密码管理'),
  di('memos', 'Memos', 'homelab', 'memos 笔记 备忘 闪念'),
  di('freshrss', 'FreshRSS', 'homelab', 'freshrss rss 订阅 阅读'),
  di('it-tools', 'IT-Tools', 'homelab', 'it-tools 工具箱 开发者工具'),
  di('speedtest-tracker', 'Speedtest', 'homelab', 'speedtest 测速 宽带'),
  di('syncthing', 'Syncthing', 'homelab', 'syncthing 文件同步 p2p'),
  di('linkding', 'Linkding', 'homelab', 'linkding 书签 收藏夹'),
  di('homepage', 'Homepage', 'homelab', 'homepage 导航 面板 dashboard'),
  di('esxi', 'VMware ESXi', 'homelab', 'esxi vmware 虚拟机'),

  // Media & Downloads
  di('jellyfin', 'Jellyfin', 'media', 'jellyfin 影音 媒体库 电影'),
  di('emby', 'Emby', 'media', 'emby 影音 媒体库 电影'),
  di('plex', 'Plex', 'media', 'plex 影音 媒体库 电影'),
  di('immich', 'Immich', 'media', 'immich 相册 照片 备份'),
  di('photoprism', 'PhotoPrism', 'media', 'photoprism 相册 照片'),
  di('navidrome', 'Navidrome', 'media', 'navidrome 音乐 music subsonic'),
  di('spotify', 'Spotify', 'media', 'spotify 音乐 流媒体'),
  di('netflix', 'Netflix', 'media', 'netflix 奈飞 电影 剧集'),
  di('sonarr', 'Sonarr', 'media', 'sonarr 追剧 剧集 自动下载'),
  di('radarr', 'Radarr', 'media', 'radarr 电影 自动下载'),
  di('qbittorrent', 'qBittorrent', 'media', 'qbittorrent qb pt bt 下载'),
  di('transmission', 'Transmission', 'media', 'transmission tr pt bt 下载'),
  di('audiobookshelf', 'Audiobookshelf', 'media', 'audiobookshelf 有声书 播客'),
  di('calibre-web', 'Calibre-Web', 'media', 'calibre 电子书 书库'),

  // Cloud & Storage
  di('cloudflare', 'Cloudflare', 'cloud', 'cloudflare cf dns cdn 隧道'),
  di('aws', 'AWS', 'cloud', 'aws amazon 亚马逊云 云服务'),
  di('azure', 'Azure', 'cloud', 'azure microsoft 微软云'),
  di('google-cloud', 'Google Cloud', 'cloud', 'gcp google cloud 谷歌云'),
  di('vercel', 'Vercel', 'cloud', 'vercel 前端部署 部署'),
  di('netlify', 'Netlify', 'cloud', 'netlify 前端部署'),
  di('nextcloud', 'Nextcloud', 'cloud', 'nextcloud 私有云 网盘'),
  di('alist', 'Alist', 'cloud', 'alist openlist 网盘 挂载'),
  di('filebrowser', 'FileBrowser', 'cloud', 'filebrowser 文件管理 网盘'),
  di('google-drive', 'Google Drive', 'cloud', 'google drive 谷歌网盘 云盘'),
  di('onedrive', 'OneDrive', 'cloud', 'onedrive 微软网盘 云盘'),
  di('dropbox', 'Dropbox', 'cloud', 'dropbox 网盘 云盘'),
  di('minio', 'MinIO', 'cloud', 'minio s3 对象存储'),

  // Dev & Databases
  di('vscode', 'VS Code', 'dev', 'vscode code 编辑器 ide 开发'),
  di('gitea', 'Gitea', 'dev', 'gitea git 自建仓库 代码'),
  di('jenkins', 'Jenkins', 'dev', 'jenkins ci cd 构建'),
  di('kubernetes', 'Kubernetes', 'dev', 'k8s kubernetes 容器编排'),
  di('postgresql', 'PostgreSQL', 'dev', 'postgres postgresql 数据库 sql'),
  di('mysql', 'MySQL', 'dev', 'mysql mariadb 数据库 sql'),
  di('redis', 'Redis', 'dev', 'redis 缓存 数据库'),
  di('mongodb', 'MongoDB', 'dev', 'mongo mongodb 数据库'),
  di('linux', 'Linux', 'dev', 'linux 系统 服务器'),
  di('ubuntu', 'Ubuntu', 'dev', 'ubuntu linux 系统'),
  di('debian', 'Debian', 'dev', 'debian linux 系统'),
]

export const CURATED_ONLINE_WALLPAPERS: readonly OnlineWallpaperEntry[] = [
  {
    id: 'bing-daily-uhd',
    title: 'Bing 每日超清壁纸 (实时更新)',
    category: 'nature',
    thumbUrl: 'https://bing.img.run/1920x1080.php',
    fullUrl: 'https://bing.img.run/uhd.php',
    source: 'Bing Daily',
  },
  {
    id: 'unsplash-obsidian-peaks',
    title: '暗夜雪峰 · Obsidian Peaks',
    category: 'dark',
    thumbUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-aurora-night',
    title: '极光夜空 · Northern Aurora',
    category: 'dark',
    thumbUrl: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-dark-ocean',
    title: '深海暮色 · Abyssal Horizon',
    category: 'dark',
    thumbUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-deep-forest',
    title: '雾林松影 · Misty Pines',
    category: 'nature',
    thumbUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-alpine-lake',
    title: '静谧冰湖 · Alpine Mirror',
    category: 'nature',
    thumbUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-desert-dunes',
    title: '沙丘光影 · Warm Dunes',
    category: 'minimal',
    thumbUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-dark-architecture',
    title: '极简建筑 · Geometric Concrete',
    category: 'minimal',
    thumbUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-abstract-waves',
    title: '流体暗纹 · Obsidian Waves',
    category: 'dark',
    thumbUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-soft-clouds',
    title: '晨雾云海 · Alabaster Sky',
    category: 'light',
    thumbUrl: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-minimal-white-arch',
    title: '素白回廊 · Swiss Minimal',
    category: 'light',
    thumbUrl: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
  {
    id: 'unsplash-tokyo-night',
    title: '都市霓虹 · Night Metropolis',
    category: 'dark',
    thumbUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=640&q=75',
    fullUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=2560&q=85',
    source: 'Unsplash',
  },
]

export function formatSlugDisplayName(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function parseDashboardIconsTree(raw: unknown): OnlineIconEntry[] {
  if (!raw || typeof raw !== 'object')
    return [...CURATED_WEBSITE_ICONS]
  const obj = raw as Record<string, unknown>
  const svgSet = new Set<string>()
  const pngSet = new Set<string>()

  if (Array.isArray(obj.svg)) {
    for (const file of obj.svg) {
      if (typeof file === 'string' && file.endsWith('.svg'))
        svgSet.add(file.slice(0, -4).toLowerCase())
    }
  }
  if (Array.isArray(obj.png)) {
    for (const file of obj.png) {
      if (typeof file === 'string' && file.endsWith('.png'))
        pngSet.add(file.slice(0, -4).toLowerCase())
    }
  }

  const allSlugs = new Set<string>([...svgSet, ...pngSet])
  if (allSlugs.size === 0)
    return [...CURATED_WEBSITE_ICONS]

  const merged: OnlineIconEntry[] = []
  const seen = new Set<string>()

  for (const curated of CURATED_WEBSITE_ICONS) {
    seen.add(curated.slug)
    const hasSvg = svgSet.has(curated.slug)
    const hasPng = pngSet.has(curated.slug)
    merged.push({
      ...curated,
      svgUrl: hasSvg ? buildDashboardIconUrl(curated.slug, 'svg') : (hasPng ? buildDashboardIconUrl(curated.slug, 'png') : curated.svgUrl),
      pngUrl: hasPng ? buildDashboardIconUrl(curated.slug, 'png') : (hasSvg ? buildDashboardIconUrl(curated.slug, 'svg') : curated.pngUrl),
    })
  }

  const extraSlugs = Array.from(allSlugs).filter(slug => !seen.has(slug)).sort()
  for (const slug of extraSlugs) {
    // Skip light/dark duplicate variants from cluttering search unless explicitly searched
    if (slug.endsWith('-light') || slug.endsWith('-dark'))
      continue
    const hasSvg = svgSet.has(slug)
    const hasPng = pngSet.has(slug)
    const displayName = formatSlugDisplayName(slug)
    merged.push({
      id: `di:${slug}`,
      name: displayName,
      slug,
      category: 'popular',
      keywords: `${slug} ${displayName.toLowerCase()}`,
      svgUrl: hasSvg ? buildDashboardIconUrl(slug, 'svg') : buildDashboardIconUrl(slug, 'png'),
      pngUrl: hasPng ? buildDashboardIconUrl(slug, 'png') : buildDashboardIconUrl(slug, 'svg'),
      source: 'dashboard-icons',
    })
  }

  return merged
}

export function filterOnlineIcons(
  entries: readonly OnlineIconEntry[],
  keyword: string,
  category: OnlineIconCategory = 'all',
  limit = 60,
): OnlineIconEntry[] {
  const q = keyword.trim().toLowerCase()
  const tokens = q ? q.split(/\s+/).filter(Boolean) : []
  const result: OnlineIconEntry[] = []

  for (const entry of entries) {
    if (!q && category !== 'all' && entry.category !== category)
      continue
    if (tokens.length > 0) {
      const haystack = `${entry.name} ${entry.slug} ${entry.keywords}`.toLowerCase()
      const matched = tokens.every(token => haystack.includes(token))
      if (!matched)
        continue
    }
    result.push(entry)
    if (result.length >= limit)
      break
  }

  return result
}

export function parseIconifySearchResponse(raw: unknown): OnlineIconEntry[] {
  if (!raw || typeof raw !== 'object')
    return []
  const icons = (raw as { icons?: unknown }).icons
  if (!Array.isArray(icons))
    return []

  const results: OnlineIconEntry[] = []
  for (const entry of icons) {
    if (typeof entry !== 'string' || !entry.includes(':'))
      continue
    const [prefix, name] = entry.split(':')
    if (!prefix || !name)
      continue
    const safePrefix = encodeURIComponent(prefix)
    const safeName = encodeURIComponent(name)
    const svgUrl = `https://api.iconify.design/${safePrefix}/${safeName}.svg?height=128`
    results.push({
      id: `iconify:${entry}`,
      name: `${formatSlugDisplayName(name)}`,
      slug: entry,
      category: 'popular',
      keywords: `${prefix} ${name} ${entry}`,
      svgUrl,
      pngUrl: svgUrl,
      source: 'iconify',
    })
  }
  return results
}

export function extractDomainFromInput(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed)
    return ''
  if (/^(?:javascript|data|file|vbscript):/i.test(trimmed))
    return ''
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
    if (!host || !host.includes('.') || /[^a-z0-9.-]/.test(host))
      return ''
    return host
  }
  catch {
    return ''
  }
}

export function buildDomainFaviconCandidates(raw: string): DomainFaviconCandidate[] {
  const host = extractDomainFromInput(raw)
  if (!host)
    return []
  const encoded = encodeURIComponent(host)
  return [
    {
      id: `google-hd:${host}`,
      provider: 'Google HD',
      badge: '256px',
      url: `https://www.google.com/s2/favicons?domain=${encoded}&sz=256`,
    },
    {
      id: `icon-horse:${host}`,
      provider: 'Icon Horse',
      badge: 'HD',
      url: `https://icon.horse/icon/${encoded}`,
    },
    {
      id: `ddg:${host}`,
      provider: 'DuckDuckGo',
      badge: 'ICO',
      url: `https://icons.duckduckgo.com/ip3/${encoded}.ico`,
    },
    {
      id: `origin:${host}`,
      provider: 'Site Root',
      badge: 'DIRECT',
      url: `https://${host}/favicon.ico`,
    },
  ]
}

export function filterOnlineWallpapers(
  keyword: string,
  category: OnlineWallpaperCategory = 'all',
): OnlineWallpaperEntry[] {
  const q = keyword.trim().toLowerCase()
  return CURATED_ONLINE_WALLPAPERS.filter((item) => {
    if (category !== 'all' && item.category !== category)
      return false
    if (!q)
      return true
    return `${item.title} ${item.source} ${item.category}`.toLowerCase().includes(q)
  })
}

let cachedDashboardIndex: OnlineIconEntry[] | null = null
let pendingDashboardFetch: Promise<OnlineIconEntry[]> | null = null

export async function loadFullDashboardIconsCatalog(): Promise<{ entries: OnlineIconEntry[]; remoteLoaded: boolean }> {
  if (cachedDashboardIndex)
    return { entries: cachedDashboardIndex, remoteLoaded: true }

  if (!pendingDashboardFetch) {
    pendingDashboardFetch = (async () => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = controller ? setTimeout(() => controller.abort(), 7000) : null
      try {
        const resp = await fetch(DASHBOARD_ICONS_TREE_URL, {
          signal: controller?.signal,
        })
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        const parsed = parseDashboardIconsTree(json)
        cachedDashboardIndex = parsed
        return parsed
      }
      finally {
        if (timer)
          clearTimeout(timer)
        pendingDashboardFetch = null
      }
    })()
  }

  try {
    const entries = await pendingDashboardFetch
    return { entries, remoteLoaded: true }
  }
  catch {
    return { entries: [...CURATED_WEBSITE_ICONS], remoteLoaded: false }
  }
}

export async function searchIconifyIcons(
  query: string,
  scope: 'brands' | 'all' = 'brands',
  limit = 36,
): Promise<OnlineIconEntry[]> {
  const q = query.trim()
  if (!q)
    return []
  const params = new URLSearchParams({
    query: q,
    limit: String(limit),
  })
  if (scope === 'brands')
    params.set('prefixes', ICONIFY_BRAND_PREFIXES)

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), 7000) : null
  try {
    const resp = await fetch(`${ICONIFY_SEARCH_API}?${params.toString()}`, {
      signal: controller?.signal,
    })
    if (!resp.ok)
      return []
    const json = await resp.json()
    return parseIconifySearchResponse(json)
  }
  catch {
    return []
  }
  finally {
    if (timer)
      clearTimeout(timer)
  }
}
