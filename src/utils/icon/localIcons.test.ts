import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  BUNDLED_LOCAL_ICON_NAMES,
  HOMELAB_ICON_PRESETS,
  computeDynamicImagePadding,
  computeDynamicVectorSize,
  computeMonogramBackground,
  filterHomelabPresets,
  isBundledLocalIcon,
  normalizeLocalIconKey,
} from './localIcons.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const svgDir = join(root, 'src/assets/svg-icons')

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory())
      walkSourceFiles(full, out)
    else if ((entry.endsWith('.vue') || entry.endsWith('.ts')) && !entry.endsWith('.test.ts'))
      out.push(full)
  }
  return out
}

test('all bundled local Lucide icons and Homelab presets resolve to real SVG files in src/assets/svg-icons', () => {
  for (const icon of BUNDLED_LOCAL_ICON_NAMES) {
    const filename = `${icon.replace(/:/g, '-')}.svg`
    assert.ok(existsSync(join(svgDir, filename)), `missing bundled SVG: ${filename}`)
    assert.equal(isBundledLocalIcon(icon), true)
    assert.equal(isBundledLocalIcon(icon.replace(/:/g, '-')), true)
  }

  assert.ok(HOMELAB_ICON_PRESETS.length >= 30, 'expected rich offline Homelab icon preset catalog')
  for (const preset of HOMELAB_ICON_PRESETS) {
    assert.equal(isBundledLocalIcon(preset.icon), true, `preset ${preset.id} icon ${preset.icon} must be bundled locally`)
    const filename = `${preset.icon.replace(/:/g, '-')}.svg`
    assert.ok(existsSync(join(svgDir, filename)), `missing SVG for preset ${preset.id}: ${filename}`)
  }
})

test('every static SvgIcon usage across src/ uses unified bundled Lucide icons with zero missing sprites', () => {
  const files = walkSourceFiles(join(root, 'src'))
  const staticSvgIconRegex = /<SvgIcon[^>]*\sicon="([^"]+)"/g
  let checkedCount = 0

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const match of content.matchAll(staticSvgIconRegex)) {
      const iconName = match[1]
      checkedCount += 1
      const normalized = normalizeLocalIconKey(iconName)
      assert.ok(
        normalized.startsWith('lucide:'),
        `non-Lucide static SvgIcon "${iconName}" found in ${file}`,
      )
      const filename = `${normalized.replace(/:/g, '-')}.svg`
      assert.ok(
        existsSync(join(svgDir, filename)),
        `missing SVG sprite "${filename}" referenced by ${file}`,
      )
    }
  }
  assert.ok(checkedCount >= 20, `expected at least 20 static SvgIcon references, checked ${checkedCount}`)
})

test('dynamic icon sizing, monogram tone, and preset search work cleanly across container sizes', () => {
  assert.equal(computeDynamicVectorSize(36), 20)
  assert.equal(computeDynamicVectorSize(44), 25)
  assert.equal(computeDynamicVectorSize(70), 39)
  assert.equal(computeDynamicImagePadding(36), 4)
  assert.equal(computeDynamicImagePadding(44), 6)
  assert.equal(computeDynamicImagePadding(70), 10)

  const toneA = computeMonogramBackground('Jellyfin')
  const toneB = computeMonogramBackground('Jellyfin')
  assert.equal(toneA, toneB)
  assert.match(toneA, /^#[0-9A-F]{6}$/i)

  assert.equal(filterHomelabPresets('').length, HOMELAB_ICON_PRESETS.length)
  assert.ok(filterHomelabPresets('docker').some(p => p.id === 'docker'))
  assert.ok(filterHomelabPresets('群晖').some(p => p.id === 'nas'))
  assert.ok(filterHomelabPresets('影音').some(p => p.id === 'jellyfin'))
})

test('new Obsidian Slate and Alabaster Paper wallpaper assets exist', () => {
  assert.ok(existsSync(join(root, 'public/assets/wallpapers/obsidian-slate.svg')))
  assert.ok(existsSync(join(root, 'public/assets/wallpapers/alabaster-paper.svg')))
})
