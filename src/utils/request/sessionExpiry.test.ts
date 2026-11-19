import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  beginHomeListLoad,
  classifyHomeListResult,
  createHomeListState,
  disposeHomeList,
  homeListFeedback,
  homeListIdentity,
  homeListRequestCurrent,
  noteHomeListIdentity,
  settleHomeListLoad,
} from '../panel/homeListLoad.ts'
import type { HomeListState } from '../panel/homeListLoad.ts'
import { staleSessionResponse } from './sessionExpiry.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

interface Card {
  id: number
  title: string
}

interface Page {
  token: string | null
  list: HomeListState<Card>
  search: string
  inputError: string
  route: string
  forgotten: Array<string | null>
  effects: string[]
}

const token = 'session-a'
const cards: Card[] = [{ id: 1, title: '常用' }]
const refreshed: Card[] = [{ id: 1, title: '常用' }, { id: 2, title: '新分组' }]

function source(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}

function page(identity = token, items = cards): Page {
  const started = beginHomeListLoad(createHomeListState<Card>(identity), identity, 'refresh')
  return {
    token: identity,
    list: settleHomeListLoad(started.state, {
      requestId: started.requestId as number,
      identity,
      outcome: 'success',
      items,
    }),
    search: '文档',
    inputError: 'protocol',
    route: '/',
    forgotten: [],
    effects: [],
  }
}

function view(current: Page, searchActive = false) {
  return homeListFeedback({
    loading: current.list.loading,
    failure: current.list.failure,
    loaded: current.list.loaded,
    itemCount: current.list.items.length,
    searchActive,
    matchCount: searchActive ? 0 : 1,
  })
}

// 与 successHandler 同一顺序：先判断这次响应是否过期，再清会话；然后首页才按世代接收结果。
function deliver(current: Page, request: { id: number; identity: string }, code: number, items?: Card[], sessionCurrent?: () => boolean) {
  const currentResponse = sessionCurrent ?? (() => {
    return homeListRequestCurrent(current.list, request.id, request.identity) && homeListIdentity(current.token) === request.identity
  })
  if (code !== 0 && !staleSessionResponse(code, currentResponse) && (code === 1000 || code === 1001)) {
    current.effects.push(code === 1001 ? 'login-message' : 'exit')
    current.route = '/login'
    current.forgotten.push(current.token)
    current.token = null
    current.list = noteHomeListIdentity(current.list, '').state
  }
  current.list = settleHomeListLoad(current.list, {
    requestId: request.id,
    identity: request.identity,
    outcome: classifyHomeListResult({ code }),
    items,
  })
}

function keptInput(current: Page) {
  assert.equal(current.search, '文档')
  assert.equal(current.inputError, 'protocol')
}

test('callers without a session check still leave on 1000 and 1001', () => {
  assert.equal(staleSessionResponse(1001, undefined), false)
  assert.equal(staleSessionResponse(1000, undefined), false)
  assert.equal(staleSessionResponse(0, () => false), false)
  assert.equal(staleSessionResponse(1400, () => false), false)
  assert.equal(staleSessionResponse(1001, () => true), false)
  assert.equal(staleSessionResponse(1000, () => false), true)

  const expired = page()
  deliver(expired, { id: 1, identity: token }, 1001, [], () => true)
  assert.deepEqual(expired.effects, ['login-message'])
  assert.equal(expired.route, '/login')
  assert.equal(expired.token, null)
  assert.deepEqual(expired.forgotten, [token])
  assert.deepEqual(expired.list.items, [])
  assert.equal(expired.list.failure, 'none')

  const missing = page()
  deliver(missing, { id: 1, identity: token }, 1000, [], () => true)
  assert.deepEqual(missing.effects, ['exit'])
  assert.equal(missing.route, '/login')
  assert.equal(missing.token, null)
  assert.deepEqual(missing.list.items, [])
  keptInput(expired)
  keptInput(missing)
})

test('a superseded homepage 1001 or 1000 does not leave the newer successful session', () => {
  const current = page()
  const failedRefresh = beginHomeListLoad(current.list, token, 'refresh')
  current.list = failedRefresh.state
  assert.deepEqual(current.list.items, cards)
  assert.equal(view(current).showNoData, false)
  assert.equal(view(current).showSearchEmpty, false)
  keptInput(current)
  deliver(current, { id: failedRefresh.requestId as number, identity: token }, 1400)
  assert.deepEqual(current.list.items, cards)
  assert.equal(current.list.failure, 'retryable')
  assert.equal(view(current).showRetry, true)
  assert.equal(view(current).showNoData, false)
  assert.equal(current.route, '/')
  keptInput(current)

  const retry = beginHomeListLoad(current.list, token, 'retry')
  current.list = retry.state
  assert.equal(retry.requestId, (failedRefresh.requestId as number) + 1)
  const newer = beginHomeListLoad(current.list, token, 'refresh')
  current.list = newer.state
  deliver(current, { id: newer.requestId as number, identity: token }, 0, refreshed)
  assert.deepEqual(current.list.items, refreshed)
  assert.equal(current.list.failure, 'none')
  assert.equal(current.list.loading, false)
  assert.equal(view(current).showRetry, false)
  keptInput(current)

  deliver(current, { id: retry.requestId as number, identity: token }, 1001, cards)
  assert.deepEqual(current.effects, [])
  assert.deepEqual(current.forgotten, [])
  assert.equal(current.token, token)
  assert.equal(current.route, '/')
  assert.deepEqual(current.list.items, refreshed)
  assert.equal(current.list.failure, 'none')
  keptInput(current)

  const hung = beginHomeListLoad(current.list, token, 'retry')
  current.list = hung.state
  const latest = beginHomeListLoad(current.list, token, 'refresh')
  current.list = latest.state
  deliver(current, { id: latest.requestId as number, identity: token }, 0, refreshed)
  deliver(current, { id: hung.requestId as number, identity: token }, 1000, cards)
  assert.deepEqual(current.effects, [])
  assert.equal(current.token, token)
  assert.equal(current.route, '/')
  assert.deepEqual(current.list.items, refreshed)
  keptInput(current)
})

test('a current 1000 or 1001 still leaves and drops the cards', () => {
  for (const code of [1001, 1000]) {
    const current = page()
    const request = beginHomeListLoad(current.list, token, 'refresh')
    current.list = request.state
    deliver(current, { id: request.requestId as number, identity: token }, code)
    assert.equal(current.route, '/login')
    assert.equal(current.token, null)
    assert.deepEqual(current.forgotten, [token])
    assert.deepEqual(current.list.items, [])
    assert.equal(current.effects[0], code === 1001 ? 'login-message' : 'exit')
  }
})

test('a late auth response after leaving or switching accounts does not clear the new session', () => {
  const left = page()
  const request = beginHomeListLoad(left.list, token, 'refresh')
  left.list = disposeHomeList(request.state)
  deliver(left, { id: request.requestId as number, identity: token }, 1001, cards)
  deliver(left, { id: request.requestId as number, identity: token }, 1000, cards)
  assert.equal(left.token, token)
  assert.equal(left.route, '/')
  assert.deepEqual(left.forgotten, [])
  assert.equal(left.list.disposed, true)
  assert.deepEqual(left.list.items, cards)
  keptInput(left)

  const switched = page()
  const old = beginHomeListLoad(switched.list, token, 'refresh')
  const noted = noteHomeListIdentity(old.state, 'session-b')
  switched.token = 'session-b'
  switched.list = noted.state
  const next = beginHomeListLoad(switched.list, 'session-b', 'refresh')
  switched.list = next.state
  const bob = [{ id: 9, title: '另一文档' }]
  deliver(switched, { id: next.requestId as number, identity: 'session-b' }, 0, bob)
  deliver(switched, { id: old.requestId as number, identity: token }, 1001, cards)
  deliver(switched, { id: old.requestId as number, identity: token }, 1000, cards)
  assert.equal(switched.token, 'session-b')
  assert.equal(switched.route, '/')
  assert.deepEqual(switched.forgotten, [])
  assert.deepEqual(switched.list.items, bob)
  keptInput(switched)
})

test('an old 1000 or 1001 does not clear a token written before the identity watch runs', () => {
  for (const code of [1001, 1000]) {
    const current = page()
    const request = beginHomeListLoad(current.list, token, 'refresh')
    current.list = request.state
    current.token = 'session-b'
    assert.equal(current.list.identity, token)
    assert.equal(homeListRequestCurrent(current.list, request.requestId as number, token), true)
    deliver(current, { id: request.requestId as number, identity: token }, code, cards)
    assert.deepEqual(current.effects, [])
    assert.deepEqual(current.forgotten, [])
    assert.equal(current.token, 'session-b')
    assert.equal(current.route, '/')
    assert.equal(current.list.identity, token)
    keptInput(current)
  }
})

test('the request layer checks a stale homepage response before clearing the session', () => {
  const request = source('src/utils/request/index.ts')
  const handler = request.slice(request.indexOf('const successHandler'), request.indexOf('const failHandler'))
  const guard = handler.indexOf('staleSessionResponse(res.data.code, sessionCurrent)')
  assert.ok(guard > 0)
  assert.ok(guard < handler.indexOf('forgetStoredAccountToken'))
  assert.ok(guard < handler.indexOf('removeToken()'))
  assert.ok(guard < handler.indexOf('router.push({ path: \'/login\' })'))
  assert.match(handler, /res\.data\.code === 1001/)
  assert.match(handler, /res\.data\.code === 1000/)
  assert.match(request, /sessionCurrent\?: \(\) => boolean/)
  assert.match(source('src/api/panel/itemIconGroup.ts'), /sessionCurrent,/)
  assert.match(source('src/views/home/index.vue'), /homeListRequestCurrent\(listState, requestId, identity\) && homeListIdentity\(authStore\.token\) === identity/)
  const home = source('src/views/home/index.vue')
  const refresh = home.slice(home.indexOf('function requestHomeList'), home.indexOf('function updateItemIconGroupByNet'))
  assert.doesNotMatch(refresh, /searchKeyword|inputError|formError/)

  const api = files(join(root, 'src/api')).filter(path => path.endsWith('.ts'))
  const guarded = api.filter(path => source(path.slice(root.length + 1)).includes('sessionCurrent'))
  assert.deepEqual(guarded.map(path => path.slice(root.length + 1)).sort(), ['src/api/panel/itemIconGroup.ts', 'src/api/system/user.ts'])
})
