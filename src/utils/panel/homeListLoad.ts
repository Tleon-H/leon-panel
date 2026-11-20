// 首页分组和卡片只在当前页面里记住最近一次成功结果。
// 同一次账号会话里，刷新还在进行或失败时留下已显示的卡片。
// 换账号、登出、401/403 或登录失效会立刻清掉上一身份的卡片。
// 这里不写入 localStorage、sessionStorage，也不跨页面保留。

export type HomeListOutcome = 'success' | 'retryable' | 'auth'
export type HomeListFailure = 'none' | 'retryable' | 'auth'
export type HomeListBeginMode = 'refresh' | 'retry'

export interface HomeListState<T> {
  identity: string
  generation: number
  disposed: boolean
  loading: boolean
  failure: HomeListFailure
  loaded: boolean
  items: T[]
}

export interface HomeListFeedback {
  busy: boolean
  showRetry: boolean
  showNoData: boolean
  showSearchEmpty: boolean
}

export function homeListIdentity(token: unknown): string {
  return typeof token === 'string' ? token.trim() : ''
}

export function createHomeListState<T>(identity = ''): HomeListState<T> {
  return {
    identity,
    generation: 0,
    disposed: false,
    loading: false,
    failure: 'none',
    loaded: false,
    items: [],
  }
}

export function noteHomeListIdentity<T>(state: HomeListState<T>, identity: string): { state: HomeListState<T>; changed: boolean } {
  if (state.disposed || state.identity === identity)
    return { state, changed: false }
  return {
    changed: true,
    state: {
      ...state,
      identity,
      generation: state.generation + 1,
      items: [],
      loaded: false,
      loading: false,
      failure: 'none',
    },
  }
}

export function beginHomeListLoad<T>(state: HomeListState<T>, identity: string, mode: HomeListBeginMode = 'refresh'): { state: HomeListState<T>; requestId: number | null } {
  if (state.disposed)
    return { state, requestId: null }
  const next = identity === state.identity ? state : noteHomeListIdentity(state, identity).state
  if (mode === 'retry' && next.loading)
    return { state: next, requestId: null }
  const requestId = next.generation + 1
  return {
    requestId,
    state: {
      ...next,
      identity,
      generation: requestId,
      loading: true,
      failure: 'none',
    },
  }
}

export function homeListRequestCurrent<T>(state: HomeListState<T>, requestId: number, identity: string): boolean {
  return !state.disposed && requestId === state.generation && identity === state.identity
}

export function settleHomeListLoad<T>(state: HomeListState<T>, input: {
  requestId: number
  identity: string
  outcome: HomeListOutcome
  items?: T[]
}): HomeListState<T> {
  if (!homeListRequestCurrent(state, input.requestId, input.identity))
    return state
  if (input.outcome === 'success') {
    return {
      ...state,
      loading: false,
      failure: 'none',
      loaded: true,
      items: input.items ?? [],
    }
  }
  if (input.outcome === 'auth') {
    return {
      ...state,
      loading: false,
      failure: 'auth',
      loaded: false,
      items: [],
    }
  }
  return {
    ...state,
    loading: false,
    failure: 'retryable',
  }
}

export function disposeHomeList<T>(state: HomeListState<T>): HomeListState<T> {
  if (state.disposed)
    return state
  return {
    ...state,
    disposed: true,
    generation: state.generation + 1,
    loading: false,
  }
}

export function classifyHomeListResult(input: { code?: unknown; status?: unknown }): HomeListOutcome {
  const status = finiteCode(input.status)
  const code = finiteCode(input.code)
  if (status === 401 || status === 403 || code === 401 || code === 403 || code === 1000 || code === 1001)
    return 'auth'
  if (code === 0)
    return 'success'
  return 'retryable'
}

export function classifyHomeListFailure(details: { code?: unknown; status?: unknown }): Exclude<HomeListOutcome, 'success'> {
  const outcome = classifyHomeListResult(details)
  return outcome === 'success' ? 'retryable' : outcome
}

export function parseHomeListPayload<T>(res: { code?: unknown; data?: unknown } | null | undefined): { outcome: HomeListOutcome; items: T[] } {
  const outcome = classifyHomeListResult({ code: res?.code })
  if (outcome !== 'success')
    return { outcome, items: [] }
  const data = res?.data
  if (!data || typeof data !== 'object' || !Array.isArray((data as { list?: unknown }).list))
    return { outcome: 'retryable', items: [] }
  return { outcome: 'success', items: (data as { list: T[] }).list }
}

function finiteCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  return null
}

export function homeListFeedback(input: {
  loading: boolean
  failure: HomeListFailure
  loaded: boolean
  itemCount: number
  searchActive: boolean
  matchCount: number
}): HomeListFeedback {
  const hasCards = input.loaded && input.itemCount > 0 && input.failure !== 'auth'
  const settled = !input.loading
  return {
    busy: input.loading,
    showRetry: settled && input.failure !== 'none',
    showNoData: settled && input.failure === 'none' && input.loaded && input.itemCount === 0,
    showSearchEmpty: hasCards && input.searchActive && input.matchCount === 0,
  }
}
