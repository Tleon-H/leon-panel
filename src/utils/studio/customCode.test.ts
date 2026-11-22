import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCombinedCss,
  buildSafeModeExitUrl,
  executeCustomJsSnippets,
  isSafeModeActive,
  normalizeCustomCodeConfig,
} from './customCode.ts'

test('isSafeModeActive recognizes safe=1 in both search query and hash query and builds clean exit URL', () => {
  assert.equal(isSafeModeActive({ search: '?safe=1', hash: '#/' }), true)
  assert.equal(isSafeModeActive({ search: '?foo=bar&safe=1', hash: '#/' }), true)
  assert.equal(isSafeModeActive({ search: '', hash: '#/?safe=1' }), true)
  assert.equal(isSafeModeActive({ search: '', hash: '#/login?safe=true' }), true)
  assert.equal(isSafeModeActive({ search: '?safe=0', hash: '#/' }), false)
  assert.equal(isSafeModeActive({ search: '', hash: '#/' }), false)

  assert.equal(
    buildSafeModeExitUrl({ pathname: '/', search: '?safe=1&tab=2', hash: '#/?safe=1&k=v' }),
    '/?tab=2#/?k=v',
  )
  assert.equal(
    buildSafeModeExitUrl({ pathname: '/', search: '?safe=1', hash: '#/' }),
    '/#/',
  )
})

test('safeMode blocks both CSS generation and JS execution while normal mode executes once per snippet hash and isolates errors', () => {
  const normalized = normalizeCustomCodeConfig({
    snippets: [
      { id: 'c1', name: 'Sharp', type: 'css', enabled: true, code: '.sun-main { letter-spacing: 0.02em; }' },
      { id: 'c2', name: 'Disabled', type: 'css', enabled: false, code: 'body { display: none; }' },
      { id: 'j1', name: 'Good JS', type: 'js', enabled: true, code: 'window.__ok = 1' },
      { id: 'j2', name: 'Broken JS', type: 'js', enabled: true, code: 'throw new Error("boom")' },
    ],
  })

  // Safe mode skips everything
  assert.equal(buildCombinedCss(normalized.snippets, true), '')
  const safeSet = new Set<string>()
  const safeRuns: string[] = []
  const safeRes = executeCustomJsSnippets(normalized.snippets, true, safeSet, code => safeRuns.push(code))
  assert.equal(safeRes.executed, 0)
  assert.equal(safeRuns.length, 0)

  // Normal mode combines only enabled CSS
  const css = buildCombinedCss(normalized.snippets, false)
  assert.match(css, /Sharp/)
  assert.doesNotMatch(css, /display: none/)

  // Normal mode executes enabled JS once per hash and isolates failures
  const executedSet = new Set<string>()
  const ran: string[] = []
  const firstRun = executeCustomJsSnippets(normalized.snippets, false, executedSet, (code, name) => {
    if (name === 'Broken JS')
      throw new Error('boom')
    ran.push(code)
  })
  assert.equal(firstRun.executed, 1)
  assert.equal(firstRun.errors.length, 1)
  assert.equal(firstRun.errors[0].name, 'Broken JS')
  assert.equal(ran.length, 1)

  // Re-running with same snippets does not duplicate execution
  const secondRun = executeCustomJsSnippets(normalized.snippets, false, executedSet, code => ran.push(code))
  assert.equal(secondRun.executed, 0)
  assert.equal(ran.length, 1)
})
