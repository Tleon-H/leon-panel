import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

test('the visible product branding is standalone Leon Panel 0.1.0', () => {
  assert.equal(source('service/assets/version').trim(), '1|0.1.0')

  const html = source('index.html')
  assert.match(html, /<title>Leon Panel<\/title>/)
  assert.match(html, /name="application-name" content="Leon Panel"/)
  assert.match(html, /name="apple-mobile-web-app-title" content="Leon Panel"/)

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
