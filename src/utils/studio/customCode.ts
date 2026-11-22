export type CustomSnippetType = 'css' | 'js'

export interface CustomCodeSnippet {
  id: string
  name: string
  type: CustomSnippetType
  enabled: boolean
  code: string
  updatedAt: number
}

export interface LeonCustomCodeConfig {
  snippets: CustomCodeSnippet[]
}

export const CUSTOM_CODE_MODULE_NAME = 'leonStudioCustomCode'
export const CUSTOM_STYLE_ELEMENT_ID = 'leon-studio-custom-css'
export const MAX_CUSTOM_SNIPPETS = 30
export const MAX_SNIPPET_LENGTH = 20000

export interface LocationLike {
  search?: string
  hash?: string
  pathname?: string
  origin?: string
}

export function isSafeModeActive(locationLike?: LocationLike | null): boolean {
  if (!locationLike)
    return false

  const checkQuery = (rawQuery?: string): boolean => {
    if (!rawQuery)
      return false
    const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery
    if (!query)
      return false
    const params = new URLSearchParams(query)
    const val = params.get('safe')
    return val === '1' || val === 'true'
  }

  if (checkQuery(locationLike.search))
    return true

  if (locationLike.hash) {
    const qIndex = locationLike.hash.indexOf('?')
    if (qIndex !== -1 && checkQuery(locationLike.hash.slice(qIndex + 1)))
      return true
  }

  return false
}

export function buildSafeModeExitUrl(locationLike: LocationLike): string {
  const pathname = locationLike.pathname || '/'
  const searchParams = new URLSearchParams((locationLike.search || '').replace(/^\?/, ''))
  searchParams.delete('safe')
  const nextSearch = searchParams.toString()

  let nextHash = locationLike.hash || ''
  if (nextHash) {
    const qIndex = nextHash.indexOf('?')
    if (qIndex !== -1) {
      const hashBase = nextHash.slice(0, qIndex)
      const hashParams = new URLSearchParams(nextHash.slice(qIndex + 1))
      hashParams.delete('safe')
      const remaining = hashParams.toString()
      nextHash = remaining ? `${hashBase}?${remaining}` : hashBase
    }
  }

  return `${pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`
}

export function defaultCustomCodeConfig(): LeonCustomCodeConfig {
  return { snippets: [] }
}

export function normalizeCustomCodeConfig(raw: unknown): LeonCustomCodeConfig {
  if (!raw || typeof raw !== 'object')
    return defaultCustomCodeConfig()
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.snippets))
    return defaultCustomCodeConfig()

  const snippets: CustomCodeSnippet[] = []
  const seen = new Set<string>()

  for (const item of obj.snippets) {
    if (snippets.length >= MAX_CUSTOM_SNIPPETS)
      break
    if (!item || typeof item !== 'object')
      continue
    const rec = item as Record<string, unknown>
    const type: CustomSnippetType | null = rec.type === 'css' ? 'css' : rec.type === 'js' ? 'js' : null
    if (!type)
      continue
    const id = (typeof rec.id === 'string' && rec.id.trim() !== '')
      ? rec.id.trim().slice(0, 64)
      : `snippet-${snippets.length + 1}`
    if (seen.has(id))
      continue
    seen.add(id)
    snippets.push({
      id,
      name: (typeof rec.name === 'string' && rec.name.trim() !== '') ? rec.name.trim().slice(0, 80) : `Snippet ${snippets.length + 1}`,
      type,
      enabled: Boolean(rec.enabled),
      code: typeof rec.code === 'string' ? rec.code.slice(0, MAX_SNIPPET_LENGTH) : '',
      updatedAt: (typeof rec.updatedAt === 'number' && Number.isFinite(rec.updatedAt)) ? rec.updatedAt : 0,
    })
  }

  return { snippets }
}

export function buildCombinedCss(snippets: readonly CustomCodeSnippet[], safeMode: boolean): string {
  if (safeMode)
    return ''
  return snippets
    .filter(item => item.type === 'css' && item.enabled && item.code.trim() !== '')
    .map(item => `/* [Leon Studio] ${item.name.replace(/\*\//g, '')} */\n${item.code}`)
    .join('\n\n')
}

export function hashSnippetKey(snippet: Pick<CustomCodeSnippet, 'id' | 'code'>): string {
  let hash = 5381
  const input = `${snippet.id}:${snippet.code}`
  for (let i = 0; i < input.length; i++)
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  return `${snippet.id}:${(hash >>> 0).toString(16)}`
}

export function applyCustomCssToDocument(snippets: readonly CustomCodeSnippet[], safeMode: boolean, doc: Document = document): void {
  const existing = doc.getElementById(CUSTOM_STYLE_ELEMENT_ID)
  const css = buildCombinedCss(snippets, safeMode)
  if (!css) {
    existing?.remove()
    return
  }
  const styleEl = existing instanceof HTMLStyleElement ? existing : doc.createElement('style')
  styleEl.id = CUSTOM_STYLE_ELEMENT_ID
  styleEl.setAttribute('data-leon-studio-css', '1')
  styleEl.textContent = css
  if (!existing)
    doc.head.appendChild(styleEl)
}

export function executeCustomJsSnippets(
  snippets: readonly CustomCodeSnippet[],
  safeMode: boolean,
  executedKeys: Set<string>,
  runner?: (code: string, name: string) => void,
): { executed: number; errors: Array<{ id: string; name: string; message: string }> } {
  if (safeMode)
    return { executed: 0, errors: [] }

  let executed = 0
  const errors: Array<{ id: string; name: string; message: string }> = []

  for (const snippet of snippets) {
    if (snippet.type !== 'js' || !snippet.enabled || snippet.code.trim() === '')
      continue
    const key = hashSnippetKey(snippet)
    if (executedKeys.has(key))
      continue
    executedKeys.add(key)
    try {
      if (runner) {
        runner(snippet.code, snippet.name)
      }
      else {
        // eslint-disable-next-line no-new-func
        const fn = new Function(snippet.code)
        fn()
      }
      executed++
    }
    catch (err) {
      errors.push({
        id: snippet.id,
        name: snippet.name,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { executed, errors }
}
