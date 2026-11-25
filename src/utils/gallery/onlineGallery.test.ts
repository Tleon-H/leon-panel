import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  CURATED_WEBSITE_ICONS,
  buildDashboardIconUrl,
  buildDomainFaviconCandidates,
  extractDomainFromInput,
  filterOnlineIcons,
  filterOnlineWallpapers,
  parseDashboardIconsTree,
  parseIconifySearchResponse,
  resolveOnlineIconUrl,
} from './onlineGallery.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

test('buildDashboardIconUrl and parseDashboardIconsTree produce valid jsDelivr CDN URLs and merge full catalogs', () => {
  assert.equal(
    buildDashboardIconUrl('Docker', 'svg'),
    'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/docker.svg',
  )
  assert.equal(
    buildDashboardIconUrl('jellyfin', 'png'),
    'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/jellyfin.png',
  )
  assert.equal(buildDashboardIconUrl('   '), '')

  const merged = parseDashboardIconsTree({
    svg: ['docker.svg', 'custom-app.svg', 'custom-app-dark.svg'],
    png: ['docker.png', 'png-only-tool.png'],
  })

  const docker = merged.find(item => item.slug === 'docker')
  assert.ok(docker)
  assert.equal(resolveOnlineIconUrl(docker, 'svg'), 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/docker.svg')
  assert.equal(resolveOnlineIconUrl(docker, 'png'), 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/docker.png')

  const customApp = merged.find(item => item.slug === 'custom-app')
  assert.ok(customApp)
  assert.equal(customApp.name, 'Custom App')
  // Variant suffix -dark should be filtered out from catalog clutter
  assert.equal(merged.some(item => item.slug === 'custom-app-dark'), false)

  const pngOnly = merged.find(item => item.slug === 'png-only-tool')
  assert.ok(pngOnly)
  assert.equal(resolveOnlineIconUrl(pngOnly, 'svg'), 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/png-only-tool.png')
})

test('filterOnlineIcons supports bilingual keyword search and category filtering', () => {
  const byChinese = filterOnlineIcons(CURATED_WEBSITE_ICONS, '群晖')
  assert.ok(byChinese.some(item => item.slug === 'synology'))

  const byBili = filterOnlineIcons(CURATED_WEBSITE_ICONS, 'b站')
  assert.ok(byBili.some(item => item.slug === 'bilibili'))

  const aiOnly = filterOnlineIcons(CURATED_WEBSITE_ICONS, '', 'ai')
  assert.ok(aiOnly.length >= 5)
  assert.ok(aiOnly.every(item => item.category === 'ai'))
})

test('parseIconifySearchResponse converts search results to crisp HD SVG URLs', () => {
  const parsed = parseIconifySearchResponse({
    icons: ['logos:docker-icon', 'simple-icons:github', 'invalid-entry'],
  })
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].svgUrl, 'https://api.iconify.design/logos/docker-icon.svg?height=128')
  assert.equal(parsed[1].slug, 'simple-icons:github')
  assert.equal(resolveOnlineIconUrl(parsed[0], 'png'), parsed[0].svgUrl)
})

test('extractDomainFromInput and buildDomainFaviconCandidates validate domains and reject unsafe schemes', () => {
  assert.equal(extractDomainFromInput('https://www.GitHub.com/Tleon-H/leon-panel'), 'www.github.com')
  assert.equal(extractDomainFromInput('bilibili.com'), 'bilibili.com')
  assert.equal(extractDomainFromInput('javascript:alert(1)'), '')
  assert.equal(extractDomainFromInput('data:text/html,hi'), '')
  assert.equal(extractDomainFromInput('localhost'), '')

  const candidates = buildDomainFaviconCandidates('https://github.com')
  assert.equal(candidates.length, 4)
  assert.match(candidates[0].url, /google\.com\/s2\/favicons\?domain=github\.com&sz=256/)
  assert.equal(buildDomainFaviconCandidates('javascript:alert(1)').length, 0)
})

test('filterOnlineWallpapers filters by category and keyword', () => {
  const darkWalls = filterOnlineWallpapers('', 'dark')
  assert.ok(darkWalls.length >= 3)
  assert.ok(darkWalls.every(w => w.category === 'dark'))

  const bing = filterOnlineWallpapers('Bing')
  assert.equal(bing.length, 1)
  assert.equal(bing[0].id, 'bing-daily-uhd')
})

test('all new publicGallery i18n keys exist in both zh-CN and en-US locales', () => {
  const zh = JSON.parse(readFileSync(join(root, 'src/locales/zh-CN.json'), 'utf8'))
  const en = JSON.parse(readFileSync(join(root, 'src/locales/en-US.json'), 'utf8'))
  const zhKeys = Object.keys(zh.apps.publicGallery).sort()
  const enKeys = Object.keys(en.apps.publicGallery).sort()
  assert.deepEqual(zhKeys, enKeys)
})
