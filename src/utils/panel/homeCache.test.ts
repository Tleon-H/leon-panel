import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { beginHomeListLoad, createHomeListState, homeListFeedback } from './homeListLoad.ts'
import {
  attachHomeRequest,
  createHomeViewCache,
  disposeHomeView,
  receiveHomeViewAuth,
  receiveHomeViewList,
  resetHomeViewAuth,
} from './homeCache.ts'
import type { HomeViewCache } from './homeCache.ts'
import {
  HOME_SNAPSHOT_EPOCH_KEY,
  HOME_SNAPSHOT_MAX_BYTES,
  HOME_SNAPSHOT_STORAGE_KEY,
  HOME_SNAPSHOT_TTL_MS,
  cacheableHomeGroups,
  clearHomeSnapshots,
  dropHomeSnapshot,
  homeListOwnership,
  homeSnapshotSource,
  identityFromAuthInfo,
  readHomeSnapshot,
  readHomeSnapshotEpoch,
  writeHomeSnapshot,
} from './homeSnapshot.ts'
import type { HomeGroupSnapshot, HomeSnapshotIdentity, HomeSnapshotStorage } from './homeSnapshot.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const now = 1_800_000_000_000
const login = (accountId: number): HomeSnapshotIdentity => ({ kind: 'login', accountId })
const guest = (accountId: number): HomeSnapshotIdentity => ({ kind: 'public', accountId })

function source(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

function memory(options?: { quota?: number; disabled?: boolean }) {
  const data = new Map<string, string>()
  const quota = options?.quota ?? Number.POSITIVE_INFINITY
  return {
    data,
    getItem(key: string) {
      if (options?.disabled)
        throw new Error('storage disabled')
      return data.has(key) ? data.get(key) as string : null
    },
    setItem(key: string, value: string) {
      if (options?.disabled)
        throw new Error('storage disabled')
      if (value.length > quota)
        throw new Error('quota')
      data.set(key, value)
    },
    removeItem(key: string) {
      if (options?.disabled)
        throw new Error('storage disabled')
      data.delete(key)
    },
  }
}

function remember(storage: HomeSnapshotStorage, identity: HomeSnapshotIdentity, items: unknown, epoch = 0, savedAt = now) {
  assert.equal(writeHomeSnapshot(storage, identity, items, epoch, savedAt), true)
}

function rawGroups(accountId: number, title: string, extra?: Record<string, unknown>) {
  return [{
    id: accountId,
    title,
    description: `${title}说明`,
    icon: 'material-symbols:folder-outline',
    sort: 2,
    iconStyle: 0,
    userId: accountId,
    sortStatus: true,
    hoverStatus: true,
    user: { id: accountId, username: 'ann', name: 'Ann', password: 'secret', token: 'session-token', mail: 'ann@example.com' },
    items: [{
      id: accountId * 10,
      title,
      url: 'https://example.com/docs',
      lanUrl: 'http://10.0.0.8',
      description: '内部文档',
      openMethod: 2,
      sort: 1,
      itemIconGroupId: accountId,
      userId: accountId,
      icon: { itemType: 1, text: '文', src: '', backgroundColor: '#112233' },
      sortStatus: true,
      hoverStatus: true,
      user: { password: 'secret', token: 'session-token', username: 'ann' },
      ...extra,
    }],
  }]
}

function authInfo(kind: 0 | 1, accountId: number) {
  return {
    code: 0,
    data: {
      visitMode: kind,
      user: {
        id: accountId,
        username: 'ann',
        name: 'Ann',
        password: 'secret',
        token: 'session-token',
        mail: 'ann@example.com',
      },
    },
  }
}

function boot(token = 'session-a') {
  return createHomeViewCache(createHomeListState<HomeGroupSnapshot>(token))
}

function start(state: HomeViewCache<HomeGroupSnapshot>, token = state.list.identity, epoch: number | null = 0) {
  const begun = beginHomeListLoad(state.list, token, 'refresh')
  return {
    requestId: begun.requestId as number,
    state: attachHomeRequest(state, begun.state, begun.requestId, epoch),
  }
}

function titles(state: HomeViewCache<HomeGroupSnapshot>) {
  return state.list.items.map(group => group.title)
}

function viewOf(state: HomeViewCache<HomeGroupSnapshot>) {
  return homeListFeedback({
    loading: state.list.loading,
    failure: state.list.failure,
    loaded: state.list.loaded,
    itemCount: state.list.items.length,
    searchActive: false,
    matchCount: 0,
  })
}

test('identity comes only from the authInfo visit mode and account id', () => {
  assert.deepEqual(identityFromAuthInfo(authInfo(0, 7).data), login(7))
  assert.deepEqual(identityFromAuthInfo(authInfo(1, 9).data), guest(9))
  assert.equal(homeSnapshotSource(login(7)), 'login:7')
  assert.equal(homeSnapshotSource(guest(7)), 'public:7')
  assert.notEqual(homeSnapshotSource(login(7)), homeSnapshotSource(guest(7)))
  assert.equal(identityFromAuthInfo({ visitMode: 0, user: { userId: 7, username: 'ann', token: 'saved' } }), null)
  assert.equal(identityFromAuthInfo({ visitMode: 1, user: { username: 'public' } }), null)
  assert.equal(identityFromAuthInfo({ user: { id: 7 } }), null)
  assert.equal(identityFromAuthInfo({ visitMode: '1', user: { id: 9 } }), null)
  assert.equal(identityFromAuthInfo(null), null)
})

test('a slow refresh shows the same identity cache, then replaces it with realtime data', () => {
  const storage = memory()
  remember(storage, login(7), rawGroups(7, '缓存文档'))
  const started = start(boot())
  assert.equal(started.state.list.loading, true)
  assert.deepEqual(titles(started.state), [])

  const revealed = receiveHomeViewAuth(started.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 7),
    readCache: identity => readHomeSnapshot(storage, identity, now),
    epochNow: 0,
  })
  assert.equal(revealed.write, null)
  assert.deepEqual(revealed.state.identity, login(7))
  assert.deepEqual(titles(revealed.state), ['缓存文档'])
  assert.equal(revealed.state.list.loading, true)
  assert.equal(viewOf(revealed.state).busy, true)
  assert.equal(viewOf(revealed.state).showRetry, false)

  const live = receiveHomeViewList(revealed.state, {
    requestId: started.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '实时文档') } },
    epochNow: 0,
  })
  assert.deepEqual(titles(live.state), ['实时文档'])
  assert.equal(live.state.list.loading, false)
  assert.equal(live.state.list.failure, 'none')
  assert.equal(viewOf(live.state).busy, false)
  assert.ok(live.write)
  assert.equal(writeHomeSnapshot(storage, live.write.identity, live.write.groups, live.write.epoch, now + 10), true)
  assert.deepEqual(readHomeSnapshot(storage, login(7), now + 10)?.map(group => group.title), ['实时文档'])
  const saved = storage.data.get(HOME_SNAPSHOT_STORAGE_KEY) as string
  assert.equal(saved.includes('secret'), false)
  assert.equal(saved.includes('session-token'), false)
  assert.equal(saved.includes('username'), false)
  assert.equal(saved.includes('sortStatus'), false)
  assert.equal(saved.includes('hoverStatus'), false)
  assert.equal(saved.includes('https://example.com/docs'), true)
  assert.equal(saved.includes('"iconStyle":0'), true)
})

test('realtime success before authInfo is kept and is not replaced by an older cache', () => {
  const storage = memory()
  remember(storage, login(7), rawGroups(7, '缓存文档'))
  const started = start(boot())
  const early = receiveHomeViewList(started.state, {
    requestId: started.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '实时文档') } },
    epochNow: 0,
  })
  assert.equal(early.write, null)
  assert.deepEqual(titles(early.state), [])
  assert.equal(early.state.list.loading, false)

  let readIdentity: HomeSnapshotIdentity | null = null
  const confirmed = receiveHomeViewAuth(early.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 7),
    readCache: (identity) => {
      readIdentity = identity
      return readHomeSnapshot(storage, identity, now)
    },
    epochNow: 0,
  })
  assert.equal(readIdentity, null)
  assert.deepEqual(titles(confirmed.state), ['实时文档'])
  assert.equal(confirmed.state.list.failure, 'none')
  assert.deepEqual(confirmed.write?.identity, login(7))
  assert.deepEqual(confirmed.write?.groups.map(group => group.title), ['实时文档'])
})

test('a cold start and a successful empty list replace the previous snapshot', () => {
  const storage = memory()
  const cold = start(boot())
  const waiting = receiveHomeViewAuth(cold.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 7),
    readCache: () => readHomeSnapshot(storage, login(7), now),
    epochNow: 0,
  })
  assert.deepEqual(titles(waiting.state), [])
  assert.equal(waiting.state.list.loading, true)
  assert.equal(viewOf(waiting.state).showNoData, false)

  const filled = receiveHomeViewList(waiting.state, {
    requestId: cold.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '第一份') } },
    epochNow: 0,
  })
  assert.equal(writeHomeSnapshot(storage, filled.write!.identity, filled.write!.groups, 0, now), true)

  const again = start(filled.state)
  const refreshed = receiveHomeViewList(again.state, {
    requestId: again.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: [] } },
    epochNow: 0,
  })
  assert.deepEqual(titles(refreshed.state), [])
  assert.equal(refreshed.state.list.loaded, true)
  assert.equal(refreshed.state.list.failure, 'none')
  assert.equal(viewOf(refreshed.state).showNoData, true)
  assert.equal(writeHomeSnapshot(storage, refreshed.write!.identity, refreshed.write!.groups, 0, now + 5), true)
  assert.deepEqual(readHomeSnapshot(storage, login(7), now + 5), [])
})

test('a retryable failure keeps the cached cards', () => {
  const storage = memory()
  remember(storage, login(7), rawGroups(7, '缓存文档'))
  const started = start(boot())
  const revealed = receiveHomeViewAuth(started.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 7),
    readCache: identity => readHomeSnapshot(storage, identity, now),
    epochNow: 0,
  })
  const failed = receiveHomeViewList(revealed.state, {
    requestId: started.requestId,
    tokenIdentity: 'session-a',
    failure: { status: 500 },
    epochNow: 0,
  })
  assert.deepEqual(titles(failed.state), ['缓存文档'])
  assert.equal(failed.state.list.failure, 'retryable')
  assert.equal(failed.write, null)
  assert.equal(viewOf(failed.state).showRetry, true)
  assert.equal(viewOf(failed.state).showNoData, false)
})

test('an older response cannot overwrite a newer result or a cleared snapshot', () => {
  const storage = memory()
  const first = start(boot())
  const second = start(first.state)
  const stale = receiveHomeViewList(second.state, {
    requestId: first.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '旧请求') } },
    epochNow: 0,
  })
  assert.equal(stale.state, second.state)
  assert.equal(stale.write, null)

  const confirmed = receiveHomeViewAuth(second.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 7),
    readCache: () => null,
    epochNow: 0,
  })
  const current = receiveHomeViewList(confirmed.state, {
    requestId: second.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '新请求') } },
    epochNow: 0,
  })
  assert.equal(writeHomeSnapshot(storage, current.write!.identity, current.write!.groups, 0, now), true)
  const lateAuth = receiveHomeViewList(current.state, {
    requestId: first.requestId,
    tokenIdentity: 'session-a',
    response: { code: 1001 },
    epochNow: 0,
  })
  assert.equal(lateAuth.state, current.state)
  assert.equal(lateAuth.clear, null)
  assert.equal(lateAuth.write, null)
  assert.deepEqual(titles(lateAuth.state), ['新请求'])
  assert.equal(lateAuth.state.list.failure, 'none')
  assert.deepEqual(readHomeSnapshot(storage, login(7), now)?.map(group => group.title), ['新请求'])

  const left = disposeHomeView(current.state)
  const afterLeave = receiveHomeViewList(left, {
    requestId: second.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '离开后') } },
    epochNow: 0,
  })
  assert.equal(afterLeave.write, null)
  assert.deepEqual(titles(afterLeave.state), ['新请求'])
})

test('two accounts and a guest fallback never render another identity cache', () => {
  const storage = memory()
  remember(storage, login(7), rawGroups(7, '账号甲'))
  remember(storage, login(8), rawGroups(8, '账号乙'))
  remember(storage, guest(9), rawGroups(9, '公开丙'))
  const first = start(boot('token-a'))
  const accountB = receiveHomeViewAuth(first.state, {
    generation: 1,
    tokenIdentity: 'token-a',
    response: authInfo(0, 8),
    readCache: identity => readHomeSnapshot(storage, identity, now),
    epochNow: 0,
  })
  assert.deepEqual(accountB.state.identity, login(8))
  assert.deepEqual(titles(accountB.state), ['账号乙'])

  const switched = resetHomeViewAuth(accountB.state, beginHomeListLoad(accountB.state.list, 'token-b', 'refresh').state)
  const next = start(switched, 'token-b')
  const late = receiveHomeViewList(next.state, {
    requestId: first.requestId,
    tokenIdentity: 'token-a',
    response: { code: 0, data: { list: rawGroups(7, '账号甲迟到') } },
    epochNow: 0,
  })
  assert.deepEqual(titles(late.state), [])
  assert.equal(late.write, null)
  const accountA = receiveHomeViewAuth(next.state, {
    generation: switched.authGeneration,
    tokenIdentity: 'token-b',
    response: authInfo(0, 7),
    readCache: identity => readHomeSnapshot(storage, identity, now),
    epochNow: 0,
  })
  assert.deepEqual(titles(accountA.state), ['账号甲'])

  const guestStart = start(boot(''))
  const seen: string[] = []
  const publicVisit = receiveHomeViewAuth(guestStart.state, {
    generation: 1,
    tokenIdentity: '',
    response: authInfo(1, 9),
    readCache: (identity) => {
      seen.push(homeSnapshotSource(identity))
      return readHomeSnapshot(storage, identity, now)
    },
    epochNow: 0,
  })
  assert.deepEqual(seen, ['public:9'])
  assert.deepEqual(titles(publicVisit.state), ['公开丙'])
  assert.deepEqual(readHomeSnapshot(storage, login(7), now)?.map(group => group.title), ['账号甲'])

  const onlyPrivate = memory()
  remember(onlyPrivate, login(7), rawGroups(7, '私有旧缓存'))
  const invalidToken = start(boot('expired-token'))
  const guestWithoutCache = receiveHomeViewAuth(invalidToken.state, {
    generation: 1,
    tokenIdentity: 'expired-token',
    response: authInfo(1, 9),
    readCache: identity => readHomeSnapshot(onlyPrivate, identity, now),
    epochNow: 0,
  })
  assert.deepEqual(titles(guestWithoutCache.state), [])
  const guestList = receiveHomeViewList(guestWithoutCache.state, {
    requestId: invalidToken.requestId,
    tokenIdentity: 'expired-token',
    response: { code: 0, data: { list: rawGroups(9, '当前公开') } },
    epochNow: 0,
  })
  assert.deepEqual(titles(guestList.state), ['当前公开'])
  assert.equal(writeHomeSnapshot(onlyPrivate, guestList.write!.identity, guestList.write!.groups, 0, now + 1), true)
  assert.deepEqual(readHomeSnapshot(onlyPrivate, guest(9), now + 1)?.map(group => group.title), ['当前公开'])
  assert.deepEqual(readHomeSnapshot(onlyPrivate, login(7), now + 1)?.map(group => group.title), ['私有旧缓存'])
})

test('parallel authInfo and getList from different accounts are not stored together', () => {
  const storage = memory()
  remember(storage, guest(9), rawGroups(9, '公开甲'))
  const started = start(boot())
  const early = receiveHomeViewList(started.state, {
    requestId: started.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(10, '公开乙') } },
    epochNow: 0,
  })
  assert.equal(early.write, null)
  const confirmed = receiveHomeViewAuth(early.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(1, 9),
    readCache: identity => readHomeSnapshot(storage, identity, now),
    epochNow: 0,
  })
  assert.equal(confirmed.write, null)
  assert.deepEqual(titles(confirmed.state), ['公开甲'])
  assert.equal(confirmed.state.list.failure, 'retryable')
  assert.deepEqual(readHomeSnapshot(storage, guest(9), now)?.map(group => group.title), ['公开甲'])
  assert.equal(readHomeSnapshot(storage, guest(10), now), null)

  const other = start(boot())
  const shown = receiveHomeViewAuth(other.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(1, 9),
    readCache: identity => readHomeSnapshot(storage, identity, now),
    epochNow: 0,
  })
  const mismatched = receiveHomeViewList(shown.state, {
    requestId: other.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(10, '公开乙') } },
    epochNow: 0,
    readCache: identity => readHomeSnapshot(storage, identity, now),
  })
  assert.equal(mismatched.write, null)
  assert.deepEqual(titles(mismatched.state), ['公开甲'])
  assert.equal(homeListOwnership(rawGroups(10, '公开乙'), 9), 'foreign')
  assert.equal(homeListOwnership([{ userId: 9, items: [{ userId: 10 }] }], 9), 'foreign')
  assert.equal(homeListOwnership([{ userId: '9', items: [] }], 9), 'foreign')
  assert.equal(homeListOwnership([{ userId: 9 }], 9), 'foreign')
  assert.equal(cacheableHomeGroups(rawGroups(10, '公开乙'), 9), null)
})

test('auth failures clear only the confirmed snapshot, including a late 1001 that is no longer current', () => {
  const storage = memory()
  remember(storage, login(7), rawGroups(7, '账号甲'))
  remember(storage, guest(9), rawGroups(9, '公开丙'))
  const started = start(boot())
  let reads = 0
  const rejected = receiveHomeViewAuth(started.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: { code: 1001, msg: '登录失效' },
    readCache: () => {
      reads += 1
      return readHomeSnapshot(storage, login(7), now)
    },
    epochNow: 0,
  })
  assert.equal(reads, 0)
  assert.equal(rejected.state.auth, 'rejected')
  assert.deepEqual(titles(rejected.state), [])
  assert.equal(rejected.clear, null)
  assert.deepEqual(readHomeSnapshot(storage, login(7), now)?.map(group => group.title), ['账号甲'])

  const confirmed = receiveHomeViewAuth(started.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 7),
    readCache: identity => readHomeSnapshot(storage, identity, now),
    epochNow: 0,
  })
  const expired = receiveHomeViewList(confirmed.state, {
    requestId: started.requestId,
    tokenIdentity: 'session-a',
    response: { code: 1001 },
    epochNow: 0,
  })
  assert.deepEqual(expired.clear?.identity, login(7))
  assert.equal(dropHomeSnapshot(storage, expired.clear!.identity, expired.clear!.epoch), true)
  assert.equal(expired.state.list.failure, 'auth')
  assert.deepEqual(titles(expired.state), [])
  assert.equal(readHomeSnapshot(storage, login(7), now), null)
  assert.deepEqual(readHomeSnapshot(storage, guest(9), now)?.map(group => group.title), ['公开丙'])

  for (const failure of [{ status: 401 }, { status: 403 }, { code: 401 }, { code: 403 }, { code: 1000 }]) {
    const again = receiveHomeViewAuth(start(boot()).state, {
      generation: 1,
      tokenIdentity: 'session-a',
      response: authInfo(0, 7),
      readCache: () => null,
      epochNow: 0,
    })
    const denied = receiveHomeViewList(again.state, {
      requestId: 1,
      tokenIdentity: 'session-a',
      failure,
      epochNow: 0,
    })
    assert.equal(denied.state.list.failure, 'auth')
    assert.deepEqual(denied.clear?.identity, login(7))
  }

  const fresh = receiveHomeViewAuth(start(boot()).state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 8),
    readCache: () => null,
    epochNow: 0,
  })
  const saved = receiveHomeViewList(fresh.state, {
    requestId: 1,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(8, '新账号') } },
    epochNow: 0,
  })
  assert.equal(writeHomeSnapshot(storage, saved.write!.identity, saved.write!.groups, 0, now), true)
  const superseded = start(saved.state)
  const newest = receiveHomeViewList(superseded.state, {
    requestId: superseded.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(8, '更新后') } },
    epochNow: 0,
  })
  const staleExpiry = receiveHomeViewList(newest.state, {
    requestId: superseded.requestId - 1,
    tokenIdentity: 'session-a',
    response: { code: 1000 },
    epochNow: 0,
  })
  assert.equal(staleExpiry.clear, null)
  assert.deepEqual(titles(staleExpiry.state), ['更新后'])
  assert.equal(staleExpiry.state.list.failure, 'none')

  remember(storage, login(7), rawGroups(7, '账号甲'))
  const hinted = receiveHomeViewAuth(start(boot()).state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: { code: 1001 },
    clearHint: login(7),
    readCache: () => {
      reads += 1
      return readHomeSnapshot(storage, login(7), now)
    },
    epochNow: 0,
  })
  assert.equal(hinted.clear?.identity.kind, 'login')
  assert.equal(hinted.clear?.identity.accountId, 7)
  assert.equal(hinted.clear?.epoch, 0)
  assert.equal(dropHomeSnapshot(storage, hinted.clear!.identity, hinted.clear!.epoch), true)
  assert.equal(readHomeSnapshot(storage, login(7), now), null)
  assert.deepEqual(readHomeSnapshot(storage, guest(9), now)?.map(group => group.title), ['公开丙'])
  assert.equal(reads, 0)

  remember(storage, login(8), rawGroups(8, '账号乙'))
  const supersededHint = start(boot())
  const newerHint = start(supersededHint.state)
  const staleHint = receiveHomeViewList(newerHint.state, {
    requestId: supersededHint.requestId,
    tokenIdentity: 'session-a',
    response: { code: 1001 },
    clearHint: login(8),
    epochNow: 0,
  })
  assert.equal(staleHint.clear, null)
  assert.deepEqual(readHomeSnapshot(storage, login(8), now)?.map(group => group.title), ['账号乙'])
  clearHomeSnapshots(storage)
  remember(storage, login(8), rawGroups(8, '清除后的账号乙'), 1)
  assert.equal(dropHomeSnapshot(storage, login(8), 0), false)
  assert.deepEqual(readHomeSnapshot(storage, login(8), now)?.map(group => group.title), ['清除后的账号乙'])
})

test('a temporary authInfo failure keeps the authorized list and does not touch the snapshot', () => {
  const storage = memory()
  remember(storage, login(7), rawGroups(7, '缓存文档'))
  const longUrl = `https://example.com/${'a'.repeat(1200)}`
  const started = start(boot())
  const early = receiveHomeViewList(started.state, {
    requestId: started.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '实时文档', { url: longUrl, icon: { itemType: 2, src: longUrl, text: '文', backgroundColor: '#112233' } }) } },
    epochNow: 0,
  })
  let reads = 0
  const interrupted = receiveHomeViewAuth(early.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    failure: { status: null, code: null },
    clearHint: login(7),
    readCache: () => {
      reads += 1
      return readHomeSnapshot(storage, login(7), now)
    },
    epochNow: 0,
  })
  assert.equal(interrupted.state.auth, 'unavailable')
  assert.equal(interrupted.write, null)
  assert.equal(interrupted.clear, null)
  assert.equal(reads, 0)
  assert.deepEqual(titles(interrupted.state), ['实时文档'])
  assert.equal(interrupted.state.list.failure, 'none')
  assert.equal(viewOf(interrupted.state).showRetry, false)
  const shown = interrupted.state.list.items[0].items?.[0]
  assert.equal(shown?.url, longUrl)
  assert.equal(shown?.icon?.src, longUrl)
  assert.deepEqual(readHomeSnapshot(storage, login(7), now)?.map(group => group.title), ['缓存文档'])

  for (const failure of [{ status: 502 }, { status: 500 }, { code: 1005 }] as const) {
    const again = receiveHomeViewAuth(early.state, {
      generation: 1,
      tokenIdentity: 'session-a',
      response: 'code' in failure ? { code: failure.code } : undefined,
      failure: 'status' in failure ? failure : undefined,
      clearHint: login(7),
      readCache: () => readHomeSnapshot(storage, login(7), now),
      epochNow: 0,
    })
    assert.equal(again.state.auth, 'unavailable')
    assert.equal(again.clear, null)
    assert.equal(again.write, null)
    assert.equal(again.state.list.items[0].items?.[0].url, longUrl)
  }

  const waiting = start(boot())
  const offline = receiveHomeViewAuth(waiting.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    failure: { status: 503 },
    clearHint: login(7),
    readCache: () => readHomeSnapshot(storage, login(7), now),
    epochNow: 0,
  })
  assert.equal(offline.state.list.loading, true)
  assert.deepEqual(titles(offline.state), [])
  const later = receiveHomeViewList(offline.state, {
    requestId: waiting.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '稍后到达', { url: longUrl }) } },
    clearHint: login(7),
    epochNow: 0,
  })
  assert.deepEqual(titles(later.state), ['稍后到达'])
  assert.equal(later.write, null)
  assert.equal(later.clear, null)
  assert.equal(later.state.list.items[0].items?.[0].url, longUrl)

  const beforeAuth = start(boot())
  const listed = receiveHomeViewList(beforeAuth.state, {
    requestId: beforeAuth.requestId,
    tokenIdentity: 'session-a',
    response: { code: 1001 },
    clearHint: login(7),
    epochNow: 0,
  })
  assert.equal(listed.state.list.failure, 'auth')
  assert.deepEqual(titles(listed.state), [])
  assert.deepEqual(listed.clear?.identity, login(7))
  assert.deepEqual(readHomeSnapshot(storage, login(7), now)?.map(group => group.title), ['缓存文档'])
})

test('live cards keep long addresses while the snapshot is a separate copy', () => {
  const storage = memory()
  const longUrl = `https://example.com/${'b'.repeat(1500)}`
  const started = start(boot())
  const confirmed = receiveHomeViewAuth(started.state, {
    generation: 1,
    tokenIdentity: 'session-a',
    response: authInfo(0, 7),
    readCache: () => null,
    epochNow: 0,
  })
  const live = receiveHomeViewList(confirmed.state, {
    requestId: started.requestId,
    tokenIdentity: 'session-a',
    response: { code: 0, data: { list: rawGroups(7, '长地址', { url: longUrl, icon: { itemType: 2, src: longUrl, text: '长', backgroundColor: '#fff' } }) } },
    epochNow: 0,
  })
  const shown = live.state.list.items[0].items?.[0]
  assert.equal(shown?.url, longUrl)
  assert.equal(shown?.icon?.src, longUrl)
  assert.equal(live.write?.groups[0].items[0].url, longUrl)
  assert.equal(live.write?.groups[0].items[0].icon?.src, longUrl)
  assert.equal(JSON.stringify(live.write?.groups).includes('secret'), false)
  assert.equal(writeHomeSnapshot(storage, live.write!.identity, live.write!.groups, live.write!.epoch, now, 80), false)
  assert.equal(readHomeSnapshot(storage, login(7), now), null)
  assert.equal(live.state.list.items[0].items?.[0].url, longUrl)
})

test('damaged, expired, oversized, and disabled storage still leave room for the network result', () => {
  const broken = memory()
  broken.data.set(HOME_SNAPSHOT_STORAGE_KEY, '{')
  assert.equal(readHomeSnapshot(broken, login(7), now), null)
  assert.equal(writeHomeSnapshot(broken, login(7), rawGroups(7, '修复后'), 0, now), true)
  assert.deepEqual(readHomeSnapshot(broken, login(7), now)?.map(group => group.title), ['修复后'])

  const oldVersion = memory()
  oldVersion.data.set(HOME_SNAPSHOT_STORAGE_KEY, JSON.stringify({ version: 0, epoch: 0, entries: { 'login:7': { savedAt: now, groups: rawGroups(7, '旧版') } } }))
  assert.equal(readHomeSnapshot(oldVersion, login(7), now), null)

  const expired = memory()
  remember(expired, login(7), rawGroups(7, '过期'), 0, now - HOME_SNAPSHOT_TTL_MS)
  assert.equal(readHomeSnapshot(expired, login(7), now), null)
  remember(expired, login(7), rawGroups(7, '未来'), 0, now + 10 * 60 * 1000)
  assert.equal(readHomeSnapshot(expired, login(7), now), null)

  const cramped = memory({ quota: 80 })
  assert.equal(writeHomeSnapshot(cramped, login(7), rawGroups(7, '太大'), 0, now), false)
  assert.equal(cramped.data.has(HOME_SNAPSHOT_STORAGE_KEY), false)

  const disabled = memory({ disabled: true })
  assert.equal(readHomeSnapshotEpoch(disabled), null)
  assert.equal(readHomeSnapshot(disabled, login(7), now), null)
  assert.equal(writeHomeSnapshot(disabled, login(7), rawGroups(7, '写不进'), 0, now), false)
  assert.deepEqual(clearHomeSnapshots(disabled), { ok: false, removed: false })

  const bounded = memory()
  assert.equal(writeHomeSnapshot(bounded, login(7), rawGroups(7, '容量'), 0, now, 80), false)
  assert.equal(bounded.data.has(HOME_SNAPSHOT_STORAGE_KEY), false)
  assert.equal(writeHomeSnapshot(bounded, login(8), rawGroups(8, '较小'), 0, now), true)
  const room = (bounded.data.get(HOME_SNAPSHOT_STORAGE_KEY)?.length ?? 0) + 20
  assert.equal(writeHomeSnapshot(bounded, login(7), rawGroups(7, '账号甲'), 0, now + 1, room), true)
  assert.equal(readHomeSnapshot(bounded, login(8), now + 1), null)
  assert.deepEqual(readHomeSnapshot(bounded, login(7), now + 1)?.map(group => group.title), ['账号甲'])
  assert.equal(HOME_SNAPSHOT_MAX_BYTES, 200 * 1024)
})

test('clear removes only the homepage snapshot and blocks requests that started earlier', () => {
  const storage = memory()
  storage.data.set('AUTH_TOKEN', '{"token":"keep","userInfo":{"password":"secret"}}')
  storage.data.set('LEON_ACCOUNT_SESSIONS', '[{"username":"ann"}]')
  storage.data.set('panelStorage', '{"panelConfig":{"logoText":"Leon Panel"}}')
  storage.data.set('appSetting', '{"language":"zh-CN"}')
  remember(storage, login(7), rawGroups(7, '待清除'))
  const before = clearHomeSnapshots(storage)
  assert.deepEqual(before, { ok: true, removed: true })
  assert.equal(storage.data.has(HOME_SNAPSHOT_STORAGE_KEY), false)
  assert.equal(readHomeSnapshotEpoch(storage), 1)
  assert.equal(storage.data.get('AUTH_TOKEN')?.includes('keep'), true)
  assert.equal(storage.data.get('LEON_ACCOUNT_SESSIONS')?.includes('ann'), true)
  assert.equal(storage.data.get('panelStorage')?.includes('Leon Panel'), true)
  assert.equal(storage.data.get('appSetting')?.includes('zh-CN'), true)
  assert.equal(writeHomeSnapshot(storage, login(7), rawGroups(7, '旧请求回写'), 0, now + 1), false)
  assert.equal(readHomeSnapshot(storage, login(7), now + 1), null)
  const again = clearHomeSnapshots(storage)
  assert.deepEqual(again, { ok: true, removed: false })
  assert.equal(writeHomeSnapshot(storage, login(7), rawGroups(7, '清除后的新结果'), 2, now + 2), true)
  assert.deepEqual(readHomeSnapshot(storage, login(7), now + 2)?.map(group => group.title), ['清除后的新结果'])
})

test('the homepage and clear page keep the existing request and route boundaries', () => {
  const home = source('src/views/home/index.vue')
  const clear = source('src/views/clear/index.vue')
  const executable = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const getList = home.slice(home.indexOf('function getList()'), home.indexOf('function updateItemIconGroupByNet'))
  const mounted = home.slice(home.indexOf('onMounted(() => {'), home.indexOf('const activeSearchItem'))
  assert.equal(getList.match(/getGroupList/g)?.length, 1)
  assert.match(getList, /getGroupList<Common\.ListResponse<ItemGroup\[\]>>\(true,/)
  assert.match(mounted, /confirmHomeAuth\(\)/)
  assert.equal(mounted.match(/getList\(\)/g)?.length, 1)
  const tokenWatch = home.slice(home.indexOf('watch(() => homeListIdentity(authStore.token)'), home.indexOf('onMounted(() => {'))
  const logoutGuard = tokenWatch.indexOf('if (!identity && previous)')
  assert.ok(logoutGuard > tokenWatch.indexOf('commitHomeList(view.list)'))
  assert.ok(logoutGuard < tokenWatch.indexOf('confirmHomeAuth()'))
  assert.match(tokenWatch, /if \(!identity && previous\)\s*return/)
  assert.match(tokenWatch, /if \(identity\)\s*getList\(\)/)
  assert.match(mounted, /disposeHomeList\(listState\)/)
  assert.match(home, /updateLocalUserInfo\(\(\) =>/)
  const confirm = home.slice(home.indexOf('function confirmHomeAuth()'), home.indexOf('function getList()'))
  assert.doesNotMatch(confirm, /!homeListIdentity/)
  assert.match(home, /view\.authGeneration === generation/)
  const hint = home.slice(home.indexOf('function issuedSnapshotHint'), home.indexOf('function dropIssuedSnapshot'))
  assert.match(hint, /authStore\.userInfo\?\.id/)
  assert.doesNotMatch(home.replace(hint, ''), /authStore\.userInfo/)
  assert.doesNotMatch(home.slice(home.indexOf('function readCachedGroups'), home.indexOf('function persistHomeCache')), /userInfo/)
  assert.match(home, /dropIssuedSnapshot\(clearTarget\)/)
  assert.doesNotMatch(executable(home), /localStorage|sessionStorage|indexedDB/)
  assert.doesNotMatch(executable(source('src/utils/panel/homeListLoad.ts')), /localStorage|sessionStorage|indexedDB/)
  assert.equal(clear.includes('onMounted'), false)
  assert.match(clear, /function clearCache\(\)/)
  assert.match(clear, /@click="clearCache"/)
  assert.match(clear, /data-testid="clear-home-cache"/)
  assert.match(source('src/locales/zh-CN.json'), /"button": "清除首页缓存"/)
  assert.match(source('src/locales/zh-CN.json'), /打开这个页面不会删除或修改任何数据/)
  assert.match(source('src/router/index.ts'), /path: '\/clear'/)
  assert.match(source('service/router/web.go'), /"\/clear"/)
})
