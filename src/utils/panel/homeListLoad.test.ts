import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { asRequestFailure, requestFailureDetails } from '../request/failure.ts'
import {
  beginHomeListLoad,
  classifyHomeListResult,
  createHomeListState,
  disposeHomeList,
  homeListFeedback,
  homeListIdentity,
  noteHomeListIdentity,
  parseHomeListPayload,
  settleHomeListLoad,
} from './homeListLoad.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

interface CardGroup {
  id: number
  title: string
  items: { title: string }[]
}

const token = 'session-a'
const cards: CardGroup[] = [{ id: 1, title: '常用', items: [{ title: '文档' }] }]
const otherCards: CardGroup[] = [{ id: 2, title: '另一账号', items: [{ title: '私人' }] }]

function loaded(identity = token, items = cards) {
  const started = beginHomeListLoad(createHomeListState<CardGroup>(identity), identity, 'refresh')
  return settleHomeListLoad(started.state, {
    requestId: started.requestId as number,
    identity,
    outcome: 'success',
    items,
  })
}

test('the first load sends one request and stays busy until it settles', () => {
  const started = beginHomeListLoad(createHomeListState<CardGroup>(''), '', 'refresh')
  assert.equal(started.requestId, 1)
  assert.equal(started.state.loading, true)
  assert.equal(started.state.loaded, false)
  assert.deepEqual(started.state.items, [])
  const waiting = homeListFeedback({
    loading: true,
    failure: 'none',
    loaded: false,
    itemCount: 0,
    searchActive: true,
    matchCount: 0,
  })
  assert.equal(waiting.busy, true)
  assert.equal(waiting.showRetry, false)
  assert.equal(waiting.showNoData, false)
  assert.equal(waiting.showSearchEmpty, false)

  const again = beginHomeListLoad(started.state, '', 'retry')
  assert.equal(again.requestId, null)
  assert.equal(again.state.generation, started.state.generation)
})

test('a successful empty list is not a search miss or a retry', () => {
  const started = beginHomeListLoad(createHomeListState<CardGroup>(token), token, 'refresh')
  const settled = settleHomeListLoad(started.state, {
    requestId: started.requestId as number,
    identity: token,
    outcome: 'success',
    items: [],
  })
  assert.equal(settled.loading, false)
  assert.equal(settled.loaded, true)
  assert.equal(settled.failure, 'none')
  const view = homeListFeedback({
    loading: settled.loading,
    failure: settled.failure,
    loaded: settled.loaded,
    itemCount: settled.items.length,
    searchActive: true,
    matchCount: 0,
  })
  assert.equal(view.busy, false)
  assert.equal(view.showNoData, true)
  assert.equal(view.showSearchEmpty, false)
  assert.equal(view.showRetry, false)
  assert.deepEqual(parseHomeListPayload({ code: 0, data: { list: [] } }), { outcome: 'success', items: [] })
})

test('local search misses stay separate from an empty successful load', () => {
  const state = loaded()
  const miss = homeListFeedback({
    loading: false,
    failure: 'none',
    loaded: true,
    itemCount: state.items.length,
    searchActive: true,
    matchCount: 0,
  })
  assert.equal(miss.showSearchEmpty, true)
  assert.equal(miss.showNoData, false)
  const hit = homeListFeedback({
    loading: false,
    failure: 'none',
    loaded: true,
    itemCount: 1,
    searchActive: true,
    matchCount: 1,
  })
  assert.equal(hit.showSearchEmpty, false)
})

test('network, http, and business failures can be retried once per click', () => {
  assert.equal(classifyHomeListResult({}), 'retryable')
  assert.equal(classifyHomeListResult({ status: 500 }), 'retryable')
  assert.equal(classifyHomeListResult({ status: 404 }), 'retryable')
  assert.equal(classifyHomeListResult({ code: 1400 }), 'retryable')
  assert.equal(classifyHomeListResult({ code: 1005 }), 'retryable')
  assert.equal(classifyHomeListResult({ code: -1 }), 'retryable')
  assert.equal(classifyHomeListResult({ code: 1200, status: 200 }), 'retryable')

  const started = beginHomeListLoad(createHomeListState<CardGroup>(token), token, 'refresh')
  const failed = settleHomeListLoad(started.state, {
    requestId: started.requestId as number,
    identity: token,
    outcome: 'retryable',
    items: otherCards,
  })
  assert.deepEqual(failed.items, [])
  assert.equal(failed.loading, false)
  assert.equal(failed.failure, 'retryable')
  const view = homeListFeedback({
    loading: false,
    failure: failed.failure,
    loaded: failed.loaded,
    itemCount: 0,
    searchActive: true,
    matchCount: 0,
  })
  assert.equal(view.showRetry, true)
  assert.equal(view.showNoData, false)
  assert.equal(view.showSearchEmpty, false)

  const retry = beginHomeListLoad(failed, token, 'retry')
  assert.equal(retry.requestId, (started.requestId as number) + 1)
  assert.equal(retry.state.loading, true)
  assert.equal(retry.state.failure, 'none')
  const blocked = beginHomeListLoad(retry.state, token, 'retry')
  assert.equal(blocked.requestId, null)

  const failedAgain = settleHomeListLoad(retry.state, {
    requestId: retry.requestId as number,
    identity: token,
    outcome: 'retryable',
  })
  const second = beginHomeListLoad(failedAgain, token, 'retry')
  assert.notEqual(second.requestId, null)
  const restored = settleHomeListLoad(second.state, {
    requestId: second.requestId as number,
    identity: token,
    outcome: 'success',
    items: cards,
  })
  assert.equal(restored.failure, 'none')
  assert.equal(restored.loading, false)
  assert.deepEqual(restored.items, cards)
  assert.equal(homeListFeedback({
    loading: false,
    failure: restored.failure,
    loaded: restored.loaded,
    itemCount: restored.items.length,
    searchActive: false,
    matchCount: 0,
  }).showRetry, false)
})

test('the same account keeps its cards while a later refresh waits or fails', () => {
  const state = loaded()
  const refreshing = beginHomeListLoad(state, token, 'refresh')
  assert.equal(refreshing.state.loading, true)
  assert.deepEqual(refreshing.state.items, cards)
  assert.equal(homeListFeedback({
    loading: true,
    failure: 'none',
    loaded: true,
    itemCount: cards.length,
    searchActive: true,
    matchCount: 0,
  }).showSearchEmpty, true)
  assert.equal(homeListFeedback({
    loading: true,
    failure: 'none',
    loaded: true,
    itemCount: cards.length,
    searchActive: false,
    matchCount: 0,
  }).showNoData, false)

  const failed = settleHomeListLoad(refreshing.state, {
    requestId: refreshing.requestId as number,
    identity: token,
    outcome: 'retryable',
    items: [],
  })
  assert.deepEqual(failed.items, cards)
  assert.equal(failed.loaded, true)
  assert.equal(failed.failure, 'retryable')
  assert.equal(failed.loading, false)
  const view = homeListFeedback({
    loading: false,
    failure: failed.failure,
    loaded: failed.loaded,
    itemCount: failed.items.length,
    searchActive: false,
    matchCount: 0,
  })
  assert.equal(view.showRetry, true)
  assert.equal(view.showNoData, false)
})

test('an older request cannot replace a newer refresh, retry, or disposal', () => {
  const first = beginHomeListLoad(createHomeListState<CardGroup>(token), token, 'refresh')
  const second = beginHomeListLoad(first.state, token, 'refresh')
  const staleSuccess = settleHomeListLoad(second.state, {
    requestId: first.requestId as number,
    identity: token,
    outcome: 'success',
    items: otherCards,
  })
  assert.equal(staleSuccess, second.state)
  assert.equal(staleSuccess.loading, true)
  assert.deepEqual(staleSuccess.items, [])

  const current = settleHomeListLoad(second.state, {
    requestId: second.requestId as number,
    identity: token,
    outcome: 'success',
    items: cards,
  })
  const lateFailure = settleHomeListLoad(current, {
    requestId: first.requestId as number,
    identity: token,
    outcome: 'retryable',
  })
  assert.equal(lateFailure, current)
  assert.deepEqual(lateFailure.items, cards)
  assert.equal(lateFailure.failure, 'none')

  const disposed = disposeHomeList(current)
  const afterLeave = settleHomeListLoad(disposed, {
    requestId: second.requestId as number,
    identity: token,
    outcome: 'success',
    items: otherCards,
  })
  assert.equal(afterLeave, disposed)
  assert.equal(beginHomeListLoad(disposed, token, 'refresh').requestId, null)
  assert.equal(disposeHomeList(disposed), disposed)
})

test('account changes, logout, and auth failures drop the previous cards', () => {
  assert.equal(homeListIdentity(' session-a '), token)
  assert.equal(homeListIdentity(''), '')
  assert.equal(homeListIdentity(null), '')
  assert.equal(homeListIdentity(undefined), '')

  const state = loaded()
  const switched = noteHomeListIdentity(state, 'session-b')
  assert.equal(switched.changed, true)
  assert.deepEqual(switched.state.items, [])
  assert.equal(switched.state.loaded, false)
  assert.equal(switched.state.loading, false)
  const stale = settleHomeListLoad(switched.state, {
    requestId: 1,
    identity: token,
    outcome: 'success',
    items: cards,
  })
  assert.equal(stale, switched.state)
  assert.equal(noteHomeListIdentity(switched.state, 'session-b').changed, false)

  const loggedOut = noteHomeListIdentity(loaded(), '')
  assert.deepEqual(loggedOut.state.items, [])
  assert.equal(loggedOut.state.identity, '')

  for (const input of [{ status: 403 }, { status: 401 }, { code: 403 }, { code: 401 }, { code: 1000 }, { code: 1001 }])
    assert.equal(classifyHomeListResult(input), 'auth')

  const denied = settleHomeListLoad(loaded(), {
    requestId: 1,
    identity: token,
    outcome: 'auth',
    items: cards,
  })
  assert.deepEqual(denied.items, [])
  assert.equal(denied.loaded, false)
  assert.equal(denied.failure, 'auth')
  assert.equal(denied.loading, false)
  const view = homeListFeedback({
    loading: false,
    failure: 'auth',
    loaded: false,
    itemCount: 0,
    searchActive: true,
    matchCount: 0,
  })
  assert.equal(view.showRetry, true)
  assert.equal(view.showSearchEmpty, false)
  assert.equal(view.showNoData, false)

  const expired = loaded()
  const cleared = noteHomeListIdentity(expired, '')
  const ignored = settleHomeListLoad(cleared.state, {
    requestId: 1,
    identity: token,
    outcome: 'auth',
    items: cards,
  })
  assert.equal(ignored, cleared.state)
  assert.equal(ignored.failure, 'none')
  assert.deepEqual(ignored.items, [])
})

test('a malformed success and a non-array payload stay retryable', () => {
  assert.deepEqual(parseHomeListPayload({ code: 0, data: {} }), { outcome: 'retryable', items: [] })
  assert.deepEqual(parseHomeListPayload({ code: 0, data: { list: null } }), { outcome: 'retryable', items: [] })
  assert.deepEqual(parseHomeListPayload({ code: 1001, data: { list: cards } }), { outcome: 'auth', items: [] })
  assert.deepEqual(parseHomeListPayload({ code: 1400, data: { list: cards } }), { outcome: 'retryable', items: [] })
  assert.deepEqual(parseHomeListPayload(null), { outcome: 'retryable', items: [] })
})

test('http failures keep their status and business code', () => {
  const http = asRequestFailure({
    message: 'Request failed with status code 403',
    response: { status: 403, data: { code: 1001, msg: '未登录' } },
  })
  assert.equal(http.status, 403)
  assert.equal(http.code, 1001)
  assert.equal(http.message, '未登录')
  assert.equal(classifyHomeListResult(requestFailureDetails(http)), 'auth')

  const business = requestFailureDetails({ code: 1400, msg: '参数格式错误' })
  assert.equal(business.status, null)
  assert.equal(business.code, 1400)
  assert.equal(classifyHomeListResult(business), 'retryable')

  const network = requestFailureDetails(new Error('Network Error'))
  assert.equal(network.status, null)
  assert.equal(network.code, null)
  assert.equal(classifyHomeListResult(network), 'retryable')

  const request = source('src/utils/request/index.ts')
  assert.match(request, /throw asRequestFailure\(error\)/)
  assert.match(request, /message\.error\(t\('common\.networkError'\)/)
  assert.match(request, /res\.data\.code === 1001/)
  assert.match(request, /router\.push\(\{ path: '\/login' \}\)/)
  assert.doesNotMatch(request, /Object\.assign\(/)
})

test('the homepage keeps one grouped request and the existing card behaviors', () => {
  const home = source('src/views/home/index.vue')
  const style = source('src/styles/leon-panel.less')
  const load = source('src/utils/panel/homeListLoad.ts')
  const getList = home.slice(home.indexOf('function getList()'), home.indexOf('function updateItemIconGroupByNet'))
  const mounted = home.slice(home.indexOf('onMounted(() => {'), home.indexOf('const activeSearchItem'))
  assert.match(getList, /homeListRequestCurrent\(listState, requestId, identity\) && homeListIdentity\(authStore\.token\) === identity/)
  assert.equal(getList.match(/getGroupList/g)?.length, 1)
  assert.doesNotMatch(getList, /getListByGroupId/)
  assert.match(getList, /requestHomeList\('retry'\)/)
  assert.match(getList, /beginHomeListLoad\(listState, identity, mode\)/)
  assert.equal(mounted.match(/getList\(\)/g)?.length, 1)
  assert.match(mounted, /disposeHomeList\(listState\)/)
  assert.match(home, /noteHomeListIdentity\(listState, identity\)/)
  assert.match(home, /if \(identity\)\s*getList\(\)/)
  assert.match(home, /acceptLoadedIcons\(/)
  assert.match(home, /currentRequestId: listState\.generation/)
  assert.equal(home.match(/getListByGroupId/g)?.length, 2)
  assert.match(home, /contextMenuEntries\(/)
  assert.match(home, /resolveGroupIconStyle\(group\.iconStyle, panelState\.panelConfig\.iconStyle\)/)
  assert.match(home, /handleSaveSort\(itemGroup\)/)
  assert.match(home, /watch\(settingModalShow, \(visible\) => \{\s*if \(visible \|\| items\.value\.some\(group => group\.sortStatus\)\)/)
  assert.match(home, /role="progressbar"/)
  assert.match(home, /data-testid="home-loading-bar"/)
  assert.match(home, /:aria-busy="homeLoading \? 'true' : 'false'"/)
  assert.match(home, /<button type="button" class="leon-home-retry-button"/)
  assert.match(home, /data-testid="home-list-retry"/)
  assert.match(home, /v-if="homeShowSearchEmpty"/)
  assert.match(home, /data-testid="home-no-data"/)
  assert.match(home, /panelHome\.loadFailed/)
  assert.match(home, /panelHome\.retry/)
  assert.match(home, /panelHome\.loading/)
  assert.match(home, /common\.noData/)
  const executable = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(executable(load), /localStorage|sessionStorage|indexedDB/)
  assert.doesNotMatch(executable(home), /localStorage|sessionStorage|indexedDB/)
  assert.match(style, /\.leon-home-loading/)
  assert.match(style, /@media \(max-width: 640px\)/)
  assert.match(style, /\.leon-home-retry-button/)
  assert.match(style, /prefers-reduced-motion: reduce/)
  assert.match(source('src/locales/zh-CN.json'), /"loading": "正在加载分组和卡片"/)
  assert.match(source('src/locales/zh-CN.json'), /"loadFailed": "分组和卡片加载失败"/)
  assert.match(source('src/locales/zh-CN.json'), /"retry": "重试"/)
  assert.match(source('src/locales/en-US.json'), /"loading": "Loading groups and cards"/)
  assert.match(source('src/locales/en-US.json'), /"loadFailed": "Groups and cards failed to load"/)
  assert.match(source('src/locales/en-US.json'), /"retry": "Retry"/)
  assert.equal(source('package.json').includes('"version": "1.3.0+leon.11"'), true)
})
