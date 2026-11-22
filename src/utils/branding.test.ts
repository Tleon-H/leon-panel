import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function bytes(path: string): Buffer {
  return readFileSync(join(root, path))
}

function pngDimensions(buf: Buffer): { width: number; height: number } {
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'expected valid PNG header')
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

test('the visible product branding is standalone Leon Panel 0.1.0', () => {
  assert.equal(source('service/assets/version').trim(), '1|0.1.0')

  const html = source('index.html')
  assert.match(html, /<title>Leon Panel<\/title>/)
  assert.match(html, /name="application-name" content="Leon Panel"/)
  assert.match(html, /name="apple-mobile-web-app-title" content="Leon Panel"/)
  assert.match(html, /href="\/apple-touch-icon\.png"/)
  assert.doesNotMatch(html, /#4b9e5f/i)

  const manifest = source('vite.config.ts')
  assert.match(manifest, /name: 'Leon Panel'/)
  assert.match(manifest, /short_name: 'Leon Panel'/)
  assert.doesNotMatch(manifest, /sun-panel/i)

  for (const path of ['src/locales/zh-CN.json', 'src/locales/en-US.json']) {
    const copy = source(path)
    assert.match(copy, /"appName": "Leon Panel"/)
    assert.doesNotMatch(copy, /sun-panel|1\.3\.0|1\.8\.1|QQ交流群|QQ Group|打赏|Donate/i)
  }

  const panel = source('src/store/modules/panel/helper.ts')
  assert.match(panel, /logoText: 'Leon Panel'/)
  assert.match(panel, /github\.com\/Tleon-H\/leon-panel/)
  assert.doesNotMatch(panel, /sun-panel|hslr-s/i)

  const login = source('src/views/login/index.vue')
  assert.match(login, /\$t\('common\.appName'\)/)
  assert.match(login, /setTitle\(t\('common\.appName'\)\)/)
  assert.match(login, /github\.com\/Tleon-H\/leon-panel/)
  assert.doesNotMatch(login, /sun-panel|hslr-s/i)

  const about = source('src/components/apps/About/index.vue')
  assert.match(about, /\$t\('common\.appName'\)/)
  assert.match(about, /alt="Leon Panel"/)
  assert.match(about, /github\.com\/Tleon-H\/leon-panel/)
  assert.doesNotMatch(about, /sun-panel|hslr-s|红烧猎人|donate|qq\.com|hub\.docker\.com|gitee\.com|bilibili|youtube/i)

  const readme = source('README.md')
  assert.match(readme, /^# Leon Panel/m)
  assert.match(readme, /0\.1\.0/)
  assert.match(readme, /\[MIT\]\(\.\/LICENSE\)/)
  assert.match(readme, /https:\/\/github\.com\/Tleon-H\/leon-panel/)
  assert.doesNotMatch(readme, /sun-panel|hslr-s|红烧猎人|star-history|hub\.docker\.com|enianteam\.com|qq_group|donate/i)
})

test('brand SVG, PNG, PWA, ICO assets and router routes use Leon Panel identity without legacy Sun-Panel art', () => {
  for (const svgPath of ['public/favicon.svg', 'public/favicon-black.svg', 'src/assets/logo.svg']) {
    const svg = source(svgPath)
    assert.match(svg, /Leon Panel Logo/)
    assert.doesNotMatch(svg, /#4fb3bb|图层_1|566\.93/i)
  }

  assert.deepEqual(pngDimensions(bytes('public/logo.png')), { width: 512, height: 512 })
  assert.deepEqual(pngDimensions(bytes('public/pwa-192x192.png')), { width: 192, height: 192 })
  assert.deepEqual(pngDimensions(bytes('public/pwa-512x512.png')), { width: 512, height: 512 })
  assert.deepEqual(pngDimensions(bytes('public/apple-touch-icon.png')), { width: 180, height: 180 })

  const ico = bytes('public/favicon.ico')
  assert.equal(ico.readUInt16LE(0), 0, 'ICO reserved header must be 0')
  assert.equal(ico.readUInt16LE(2), 1, 'ICO type must be 1')
  assert.ok(ico.readUInt16LE(4) >= 3, 'ICO should embed multiple resolutions')

  assert.equal(existsSync(join(root, 'src/assets/about_image')), false, 'legacy about_image folder must be removed')

  const webRouter = source('service/router/web.go')
  for (const route of ['/favicon.ico', '/favicon.svg', '/favicon-black.svg', '/apple-touch-icon.png', '/pwa-192x192.png', '/pwa-512x512.png'])
    assert.match(webRouter, new RegExp(`"${route.replace('.', '\\.')}"`))

  const tokens = JSON.parse(source('design/tokens.json'))
  assert.ok(Array.isArray(tokens.$metadata?.tokenSetOrder) && tokens.$metadata.tokenSetOrder.length >= 4)
  assert.ok(Array.isArray(tokens.$themes) && tokens.$themes.length >= 3)
  for (const concept of [
    'design/logos/leon-logo-a-prism.svg',
    'design/logos/leon-logo-b-grid.svg',
    'design/logos/leon-logo-c-monolith.svg',
  ])
    assert.equal(existsSync(join(root, concept)), true, `missing logo concept: ${concept}`)
})

test('release tags match the package version and validation never modifies env files', () => {
  const pkg = JSON.parse(source('package.json'))
  assert.equal(pkg.version, '0.1.0')
  const before = source('.env')
  const script = join(root, 'scripts/check-version.cjs')
  const tag = pkg.version
  assert.equal(execFileSync(process.execPath, [script, '--image-tag'], { encoding: 'utf8' }).trim(), tag)
  const env = { ...process.env, GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: `v${tag}` }
  execFileSync(process.execPath, [script], { env, stdio: 'pipe' })
  assert.throws(() => execFileSync(process.execPath, [script], {
    env: { ...env, GITHUB_REF_NAME: 'v0.0.0' }, stdio: 'pipe',
  }))
  assert.equal(source('.env'), before)
})
