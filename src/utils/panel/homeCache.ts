// 把 authInfo 确认过的身份和这一次首页请求接起来。
// 缓存只能在确认之后显示；实时成功且分组、卡片的 userId 都属于该账号时才覆盖并写入。
// 旧请求、离开页面、清除之后的世代，都不能把另一身份的卡片写回去。

import type { HomeListState } from './homeListLoad'
import type { HomeGroupSnapshot, HomeSnapshotIdentity } from './homeSnapshot'
import { cacheableHomeGroups, homeListOwnership, identityFromAuthInfo } from './homeSnapshot'
import {
  classifyHomeListFailure,
  disposeHomeList,
  homeListRequestCurrent,
  parseHomeListPayload,
  settleHomeListLoad,
} from './homeListLoad'

export interface HomeViewCache<T> {
  list: HomeListState<T>
  auth: 'pending' | 'confirmed' | 'rejected' | 'unavailable'
  authGeneration: number
  identity: HomeSnapshotIdentity | null
  held: { requestId: number; tokenIdentity: string; items: unknown[] } | null
  activeRequestId: number | null
  epoch: number | null
}

export interface HomeCacheStep<T> {
  state: HomeViewCache<T>
  write: { identity: HomeSnapshotIdentity; groups: HomeGroupSnapshot[]; epoch: number } | null
  clear: { identity: HomeSnapshotIdentity; epoch: number } | null
}

export function createHomeViewCache<T>(list: HomeListState<T>): HomeViewCache<T> {
  return {
    list,
    auth: 'pending',
    authGeneration: 1,
    identity: null,
    held: null,
    activeRequestId: null,
    epoch: null,
  }
}

export function resetHomeViewAuth<T>(state: HomeViewCache<T>, list: HomeListState<T>): HomeViewCache<T> {
  return {
    ...state,
    list,
    auth: 'pending',
    identity: null,
    held: null,
    authGeneration: state.authGeneration + 1,
  }
}

export function attachHomeRequest<T>(state: HomeViewCache<T>, list: HomeListState<T>, requestId: number | null, epoch: number | null): HomeViewCache<T> {
  if (requestId === null)
    return { ...state, list }
  return {
    ...state,
    list,
    held: null,
    activeRequestId: requestId,
    epoch,
  }
}

export function disposeHomeView<T>(state: HomeViewCache<T>): HomeViewCache<T> {
  return {
    ...state,
    list: disposeHomeList(state.list),
    held: null,
  }
}

export function receiveHomeViewAuth<T>(state: HomeViewCache<T>, input: {
  generation: number
  tokenIdentity: string
  response?: { code?: unknown; data?: unknown } | null
  failure?: { code?: unknown; status?: unknown } | null
  readCache: (identity: HomeSnapshotIdentity) => T[] | null
  epochNow: number | null
  // 只在确认身份前的鉴权失败时用来删除对应快照，不参与展示。
  clearHint?: HomeSnapshotIdentity | null
}): HomeCacheStep<T> {
  if (input.generation !== state.authGeneration || state.list.disposed || input.tokenIdentity !== state.list.identity)
    return unchanged(state)
  if (authFailure(input.failure, input.response))
    return rejectAuth(state, input.clearHint)
  const response = input.response
  const identity = response && response.code === 0 ? identityFromAuthInfo(response.data) : null
  if (!identity)
    return disableCache(state)

  const confirmed: HomeViewCache<T> = { ...state, auth: 'confirmed', identity }
  if (confirmed.held && homeListRequestCurrent(confirmed.list, confirmed.held.requestId, confirmed.held.tokenIdentity))
    return applyOwnedList(confirmed, confirmed.held.requestId, confirmed.held.tokenIdentity, confirmed.held.items, input.epochNow, input.readCache)
  if (confirmed.list.failure === 'auth')
    return { state: { ...confirmed, held: null }, write: null, clear: clearOf(confirmed) }
  if (settledSuccess(confirmed.list))
    return { state: { ...confirmed, held: null }, write: null, clear: null }
  const cached = input.readCache(identity)
  if (!cached)
    return { state: { ...confirmed, held: null }, write: null, clear: null }
  return {
    state: {
      ...confirmed,
      held: null,
      list: {
        ...confirmed.list,
        items: cached,
        loaded: true,
      },
    },
    write: null,
    clear: null,
  }
}

export function receiveHomeViewList<T>(state: HomeViewCache<T>, input: {
  requestId: number
  tokenIdentity: string
  response?: { code?: unknown; data?: unknown } | null
  failure?: { code?: unknown; status?: unknown } | null
  epochNow: number | null
  readCache?: (identity: HomeSnapshotIdentity) => T[] | null
  clearHint?: HomeSnapshotIdentity | null
}): HomeCacheStep<T> {
  if (!homeListRequestCurrent(state.list, input.requestId, input.tokenIdentity))
    return unchanged(state)
  const outcome = input.failure
    ? classifyHomeListFailure(input.failure)
    : parseHomeListPayload(input.response).outcome
  if (outcome === 'auth') {
    return {
      state: {
        ...state,
        held: null,
        list: settleHomeListLoad(state.list, {
          requestId: input.requestId,
          identity: input.tokenIdentity,
          outcome: 'auth',
        }),
      },
      write: null,
      clear: state.auth === 'confirmed' ? clearOf(state) : hintedClear(state, input.clearHint),
    }
  }
  if (outcome !== 'success') {
    return {
      state: {
        ...state,
        held: null,
        list: settleHomeListLoad(state.list, {
          requestId: input.requestId,
          identity: input.tokenIdentity,
          outcome: 'retryable',
        }),
      },
      write: null,
      clear: null,
    }
  }
  const items = parseHomeListPayload(input.response).items
  if (state.auth === 'unavailable')
    return showAuthorizedList(state, input.requestId, input.tokenIdentity, items)
  if (state.auth !== 'confirmed' || !state.identity) {
    if (state.auth === 'rejected') {
      return {
        state: {
          ...state,
          held: null,
          list: settleHomeListLoad(state.list, {
            requestId: input.requestId,
            identity: input.tokenIdentity,
            outcome: 'retryable',
          }),
        },
        write: null,
        clear: null,
      }
    }
    return {
      state: {
        ...state,
        held: { requestId: input.requestId, tokenIdentity: input.tokenIdentity, items },
        list: { ...state.list, loading: false },
      },
      write: null,
      clear: null,
    }
  }
  return applyOwnedList(state, input.requestId, input.tokenIdentity, items, input.epochNow, input.readCache)
}

function applyOwnedList<T>(state: HomeViewCache<T>, requestId: number, tokenIdentity: string, items: unknown[], epochNow: number | null, readCache?: (identity: HomeSnapshotIdentity) => T[] | null): HomeCacheStep<T> {
  const identity = state.identity
  if (!identity || !homeListRequestCurrent(state.list, requestId, tokenIdentity))
    return unchanged(state)
  if (homeListOwnership(items, identity.accountId) === 'foreign') {
    const cached = readCache?.(identity)
    const kept = cached && state.list.items.length === 0 ? cached : state.list.items
    return {
      state: {
        ...state,
        held: null,
        list: settleHomeListLoad({ ...state.list, items: kept, loaded: kept.length > 0 || state.list.loaded }, {
          requestId,
          identity: tokenIdentity,
          outcome: 'retryable',
        }),
      },
      write: null,
      clear: null,
    }
  }
  // 页面展示后端返回的原卡片。快照另做裁剪；写不进去时这次缓存作废，活数据保留。
  const groups = cacheableHomeGroups(items, identity.accountId)
  return {
    state: {
      ...state,
      held: null,
      list: settleHomeListLoad(state.list, {
        requestId,
        identity: tokenIdentity,
        outcome: 'success',
        items: items as T[],
      }),
    },
    write: groups ? writable(state, groups, epochNow) : null,
    clear: null,
  }
}

function writable<T>(state: HomeViewCache<T>, groups: HomeGroupSnapshot[], epochNow: number | null): HomeCacheStep<T>['write'] {
  if (!state.identity || state.epoch === null || epochNow === null || state.epoch !== epochNow)
    return null
  return { identity: state.identity, groups, epoch: state.epoch }
}

function clearOf<T>(state: HomeViewCache<T>): HomeCacheStep<T>['clear'] {
  if (!state.identity || state.epoch === null)
    return null
  return { identity: state.identity, epoch: state.epoch }
}

function rejectAuth<T>(state: HomeViewCache<T>, hint?: HomeSnapshotIdentity | null): HomeCacheStep<T> {
  return {
    state: {
      ...state,
      auth: 'rejected',
      identity: null,
      held: null,
      list: {
        ...state.list,
        loading: false,
        failure: 'auth',
        loaded: false,
        items: [],
      },
    },
    write: null,
    clear: clearOf(state) ?? hintedClear(state, hint),
  }
}

function disableCache<T>(state: HomeViewCache<T>): HomeCacheStep<T> {
  const held = state.held && homeListRequestCurrent(state.list, state.held.requestId, state.held.tokenIdentity)
    ? state.held.items as T[]
    : null
  return {
    state: {
      ...state,
      auth: 'unavailable',
      identity: null,
      held: null,
      list: held
        ? { ...state.list, items: held, loaded: true, loading: false, failure: 'none' }
        : state.list,
    },
    write: null,
    clear: null,
  }
}

function showAuthorizedList<T>(state: HomeViewCache<T>, requestId: number, tokenIdentity: string, items: unknown[]): HomeCacheStep<T> {
  return {
    state: {
      ...state,
      held: null,
      list: settleHomeListLoad(state.list, {
        requestId,
        identity: tokenIdentity,
        outcome: 'success',
        items: items as T[],
      }),
    },
    write: null,
    clear: null,
  }
}

function authFailure(failure?: { code?: unknown; status?: unknown } | null, response?: { code?: unknown } | null): boolean {
  if (failure && classifyHomeListFailure(failure) === 'auth')
    return true
  if (response && classifyHomeListFailure({ code: response.code }) === 'auth')
    return true
  return false
}

function hintedClear<T>(state: HomeViewCache<T>, hint?: HomeSnapshotIdentity | null): HomeCacheStep<T>['clear'] {
  if (!hint || state.epoch === null)
    return null
  return { identity: hint, epoch: state.epoch }
}

function settledSuccess<T>(list: HomeListState<T>): boolean {
  return list.loaded && list.failure === 'none' && !list.loading
}

function unchanged<T>(state: HomeViewCache<T>): HomeCacheStep<T> {
  return { state, write: null, clear: null }
}
