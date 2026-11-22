import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildNaiveThemeBundle } from './naiveTheme.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

test('Naive UI themeOverrides replaces default green with active panel accent and Bauhaus geometric tokens', () => {
  const bauhausLight = buildNaiveThemeBundle({
    cardSurface: 'bauhaus-grid',
    cardAccentColor: '#ff4f00',
    maxWidthUnit: 'px',
  }, false)
  assert.equal(bauhausLight.overrides.common?.primaryColor, '#ff4f00')
  assert.equal(bauhausLight.overrides.common?.borderRadius, '0px')
  assert.equal(bauhausLight.overrides.common?.borderColor, '#18181b')
  assert.equal(bauhausLight.cssVars['--leon-ui-modal-radius'], '0px')
  assert.notEqual(bauhausLight.overrides.common?.primaryColor, '#18a058')

  const swissLight = buildNaiveThemeBundle({
    cardSurface: 'swiss-paper',
    cardAccentColor: '#2563eb',
    maxWidthUnit: 'px',
  }, false)
  assert.equal(swissLight.overrides.common?.primaryColor, '#2563eb')
  assert.equal(swissLight.overrides.common?.borderRadius, '4px')

  const monoDark = buildNaiveThemeBundle({
    cardSurface: 'mono-ink',
    cardAccentColor: '#ff4f00',
    maxWidthUnit: 'px',
  }, true)
  assert.equal(monoDark.overrides.common?.primaryColor, '#ff4f00')
  assert.equal(monoDark.overrides.common?.bodyColor, '#09090b')
  assert.equal(monoDark.overrides.common?.cardColor, '#121215')

  const legacyDefault = buildNaiveThemeBundle({
    cardSurface: 'default',
    cardAccentColor: '#7dd3fc',
    maxWidthUnit: 'px',
  }, false)
  assert.equal(legacyDefault.overrides.common?.primaryColor, '#ff4f00')
})

test('useTheme wires buildNaiveThemeBundle to panelState.activePanelConfig', () => {
  const hook = readFileSync(join(root, 'src/hooks/useTheme.ts'), 'utf8')
  assert.match(hook, /usePanelState\(/)
  assert.match(hook, /buildNaiveThemeBundle\(/)
  assert.match(hook, /panelState\.activePanelConfig/)
})
