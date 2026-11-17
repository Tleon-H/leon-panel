import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  contextMenuEntries,
  contextNewTabFeatures,
  isFilledContextAddress,
  openableContextHref,
  resolveContextMenuChoice,
} from './contextMenu.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function keys(item: { url?: unknown; lanUrl?: unknown }, loggedIn: boolean): string[] {
  return contextMenuEntries(item, loggedIn).flatMap(entry => [entry.key, ...(entry.children?.map(child => child.key) ?? [])])
}

const dual = {
  url: 'http://192.168.1.8:8080/admin?from=default#home',
  lanUrl: 'https://10.0.0.8/lan?from=lan#room',
  openMethod: 1,
}

test('filled default and intranet addresses stay visible in either network mode', () => {
  const wan = keys(dual, true)
  const lan = keys(dual, true)
  assert.deepEqual(wan, lan)
  assert.deepEqual(wan, [
    'address:url',
    'open:url:1',
    'open:url:2',
    'open:url:3',
    'address:lan',
    'open:lan:1',
    'open:lan:2',
    'open:lan:3',
    'edit',
    'delete',
  ])
  assert.deepEqual(contextMenuEntries(dual, false).map(entry => entry.key), ['address:url', 'address:lan'])
})

test('a blank or missing address is omitted and does not fall back to the other one', () => {
  assert.deepEqual(keys({ url: dual.url, lanUrl: '' }, false), ['address:url', 'open:url:1', 'open:url:2', 'open:url:3'])
  assert.deepEqual(keys({ url: '   ', lanUrl: dual.lanUrl }, false), ['address:lan', 'open:lan:1', 'open:lan:2', 'open:lan:3'])
  assert.deepEqual(keys({ url: null, lanUrl: undefined }, true), ['edit', 'delete'])
  assert.equal(isFilledContextAddress(''), false)
  assert.equal(isFilledContextAddress('  '), false)
  assert.equal(resolveContextMenuChoice({ url: '', lanUrl: dual.lanUrl, openMethod: 2 }, 'open:url:1'), null)
  assert.equal(resolveContextMenuChoice({ url: dual.url, lanUrl: '   ', openMethod: 3 }, 'open:lan:3'), null)
  assert.equal(resolveContextMenuChoice({ url: dual.url, lanUrl: null }, 'open:lan:2'), null)
})

test('the selected address and open method are used instead of the saved open method', () => {
  assert.deepEqual(resolveContextMenuChoice(dual, 'open:url:3'), {
    kind: 'url',
    method: 3,
    href: dual.url,
  })
  assert.deepEqual(resolveContextMenuChoice(dual, 'open:lan:2'), {
    kind: 'lan',
    method: 2,
    href: dual.lanUrl,
  })
  assert.deepEqual(resolveContextMenuChoice({ ...dual, openMethod: 2 }, 'open:url:1'), {
    kind: 'url',
    method: 1,
    href: dual.url,
  })
  assert.equal(resolveContextMenuChoice(dual, 'address:url'), null)
  assert.equal(resolveContextMenuChoice(dual, 'edit'), 'edit')
  assert.equal(resolveContextMenuChoice(dual, 'delete'), 'delete')
})

test('http and https addresses keep private addresses, ports, queries, and fragments', () => {
  const samples = [
    'http://192.168.1.8:8080/admin?from=default#home',
    'https://10.0.0.8/lan?from=lan#room',
    'HTTP://Example.COM/Path?q=1#Frag',
    'https://user:pass@172.16.0.4:8443/a?b=2#c',
    'http://[::1]:8765/a?b=1#c',
    'http://127.0.0.1:3000/?q=javascript:alert(1)#data:text',
  ]
  for (const sample of samples)
    assert.equal(openableContextHref(`  ${sample}  `), sample)
})

test('reasonable addresses without a scheme open as http and executable links do not open', () => {
  assert.equal(openableContextHref('192.168.1.20:9000/path?y=2#room'), 'http://192.168.1.20:9000/path?y=2#room')
  assert.equal(openableContextHref('nas.local:5000'), 'http://nas.local:5000/')
  assert.equal(openableContextHref('localhost:3000/app'), 'http://localhost:3000/app')
  assert.equal(openableContextHref('//10.0.0.8:9000/app?x=1#z'), 'http://10.0.0.8:9000/app?x=1#z')
  assert.equal(openableContextHref('[::1]:8765/a?b=1#c'), 'http://[::1]:8765/a?b=1#c')

  assert.deepEqual(keys({ url: 'javascript:alert(1)', lanUrl: 'data:text/html,hi' }, false).filter(key => key.startsWith('address')), ['address:url', 'address:lan'])
  for (const blocked of [
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'java\nscript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'DATA:text/html,hello',
    'vbscript:msgbox(1)',
    'blob:https://example.com/11111111-1111-1111-1111-111111111111',
    'file:///tmp/example',
    'about:blank',
    'mailto:admin@example.com',
    '/admin',
    './admin',
    'javascript:http://example.com',
    'javascript://example.com/%0Aalert(1)',
    'http:example.com',
    'https:/example.com',
    'http://',
    'http://example.com/a b',
    'http://example.com\\@evil.test',
  ]) {
    assert.equal(openableContextHref(blocked), null)
    assert.equal(resolveContextMenuChoice({ url: blocked, lanUrl: dual.lanUrl, openMethod: 2 }, 'open:url:2'), null)
  }
  assert.equal(contextNewTabFeatures.includes('noopener'), true)
})

test('the homepage menu uses the chosen address on both card layouts and leaves left click alone', () => {
  const home = source('src/views/home/index.vue')
  const menu = home.slice(home.indexOf('function getDropdownMenuOptions()'), home.indexOf('watch(settingModalShow'))
  const select = home.slice(home.indexOf('function handleRightMenuSelect'), home.indexOf('function handleContextMenu'))
  const click = home.slice(home.indexOf('function handleItemClick'), home.indexOf('function handWindowIframeIdLoad'))
  const openChosen = home.slice(home.indexOf('function openChosenAddress'), home.indexOf('function handleItemClick'))

  assert.equal(home.match(/@contextmenu="\(e\) => handleContextMenu\(e, itemGroupIndex, item\)"/g)?.length, 2)
  assert.match(menu, /contextMenuEntries\(/)
  assert.match(menu, /VisitMode\.VISIT_MODE_LOGIN/)
  assert.doesNotMatch(menu, /networkMode|openLanUrl|openWanUrl|newWindows/)
  assert.match(select, /resolveContextMenuChoice\(item, String\(key\)\)/)
  assert.match(select, /openChosenAddress\(choice\.method, choice\.href, item\.title\)/)
  assert.doesNotMatch(select, /openMethod|networkMode|openPage\(|\.url|\.lanUrl/)
  assert.match(openChosen, /window\.open\(href, '_blank', contextNewTabFeatures\)/)
  assert.match(openChosen, /opened\.opener = null/)
  assert.match(openChosen, /windowSrc\.value = href/)
  assert.match(click, /panelState\.networkMode === PanelStateNetworkModeEnum\.lan \? item\.lanUrl : item\.url/)
  assert.match(click, /if \(item\.lanUrl === ''\)/)
  assert.match(click, /jumpUrl = item\.url/)
  assert.match(click, /openPage\(item\.openMethod, jumpUrl, item\.title\)/)
  assert.match(home, /<iframe[\s\S]*:src="windowSrc"/)

  const zh = source('src/locales/zh-CN.json')
  const en = source('src/locales/en-US.json')
  for (const label of ['默认地址', '内网地址', '当前页打开', '新标签页打开', '页内小窗打开'])
    assert.match(zh, new RegExp(label))
  for (const label of ['Default address', 'Intranet address', 'Open in current page', 'Open in new tab', 'Open in an in-page window'])
    assert.match(en, new RegExp(label))
})
