// 网络失败和 HTTP 失败原来会被收成一句普通 Error，调用方看不到状态码。
// 首页要区分 401/403 和可以重试的失败，所以把状态码和业务码留在错误上。

export class RequestFailure extends Error {
  readonly status: number | null
  readonly code: number | null

  constructor(message: string, status: number | null, code: number | null) {
    super(message)
    this.name = 'RequestFailure'
    this.status = status
    this.code = code
  }
}

export function requestFailureDetails(error: unknown): { message: string; status: number | null; code: number | null } {
  if (error instanceof RequestFailure)
    return { message: error.message, status: error.status, code: error.code }
  if (typeof error === 'string')
    return { message: error || 'Error', status: null, code: null }
  if (!error || typeof error !== 'object')
    return { message: 'Error', status: null, code: null }

  const record = error as {
    message?: unknown
    msg?: unknown
    code?: unknown
    status?: unknown
    response?: { status?: unknown; data?: { code?: unknown; msg?: unknown } }
  }
  const status = finiteNumber(record.response?.status ?? record.status)
  const code = finiteNumber(record.response?.data?.code ?? record.code)
  const message = text(record.msg) ?? text(record.response?.data?.msg) ?? text(record.message) ?? 'Error'
  return { message, status, code }
}

export function asRequestFailure(error: unknown): RequestFailure {
  const details = requestFailureDetails(error)
  return new RequestFailure(details.message, details.status, details.code)
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  return null
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '')
    return value
  return null
}
