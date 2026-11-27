// 页脚自定义 HTML 白名单净化器。
// 保留合规备案链接（如 ICP / 公安备案）与基础文字排版，拦截脚本、事件属性、危险协议与非法嵌套标签；
// 在 /?safe=1 安全模式下直接跳过自定义页脚渲染，保证用户随时可恢复访问。

export const FOOTER_HTML_MAX_LENGTH = 16384

const ALLOWED_TAGS = new Set([
  'div',
  'p',
  'span',
  'a',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'small',
  'code',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'time',
  'br',
  'hr',
  'img',
])

const VOID_TAGS = new Set(['br', 'hr', 'img'])

// 危险容器的整个内部内容都会被丢弃，避免脚本、样式或外来命名空间内容以文本或嵌套标签泄露。
const SKIP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'noscript',
  'template',
  'textarea',
  'title',
  'xmp',
  'svg',
  'math',
  'head',
])

const ALLOWED_STYLE_PROPERTIES = new Set([
  'color',
  'font-size',
  'font-weight',
  'font-style',
  'text-align',
  'text-decoration',
  'line-height',
  'letter-spacing',
  'opacity',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'display',
  'align-items',
  'justify-content',
  'flex-wrap',
  'gap',
  'column-gap',
  'row-gap',
  'width',
  'max-width',
  'height',
  'max-height',
  'vertical-align',
  'border-radius',
  'white-space',
])

// 仅放行少量基础排版与页脚对齐工具类，禁止任何定位、层级、全屏尺寸、背景遮罩、负边距或交互拦截类。
const ALLOWED_FOOTER_CLASSES = new Set([
  'flex',
  'inline-flex',
  'flex-wrap',
  'flex-col',
  'items-center',
  'justify-center',
  'justify-between',
  'gap-1',
  'gap-2',
  'gap-3',
  'gap-4',
  'text-center',
  'text-left',
  'text-right',
  'text-xs',
  'text-sm',
  'text-base',
  'font-normal',
  'font-medium',
  'font-semibold',
  'font-bold',
  'italic',
  'underline',
  'no-underline',
  'hover:underline',
  'leading-normal',
  'leading-relaxed',
  'tracking-wide',
  'whitespace-nowrap',
  'text-slate-300',
  'text-slate-400',
  'text-slate-500',
  'text-gray-300',
  'text-gray-400',
  'text-gray-500',
  'text-zinc-400',
  'text-neutral-400',
  'text-white',
  'opacity-70',
  'opacity-75',
  'opacity-80',
  'opacity-90',
  'ml-[5px]',
  'ml-1',
  'ml-2',
  'mr-1',
  'mr-2',
  'mx-1',
  'mx-2',
  'mx-auto',
  'mt-1',
  'mt-2',
  'mt-3',
  'mt-4',
  'mb-1',
  'mb-2',
  'my-1',
  'my-2',
  'px-1',
  'px-2',
  'py-1',
])

const ALLOWED_DISPLAY_VALUES = new Set(['inline', 'inline-block', 'block', 'flex', 'inline-flex'])
const ALLOWED_REL_TOKENS = new Set(['noopener', 'noreferrer', 'nofollow', 'external'])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: '\u00A0',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  middot: '\u00B7',
  bull: '\u2022',
  ndash: '\u2013',
  mdash: '\u2014',
}

interface ParsedAttr {
  name: string
  value: string
}

export function resolveSafeFooterHtml(raw: unknown, safeMode: boolean): string {
  if (safeMode)
    return ''
  return sanitizeFooterHtml(raw)
}

export function sanitizeFooterHtml(raw: unknown): string {
  if (typeof raw !== 'string')
    return ''
  const trimmed = raw.trim()
  if (!trimmed)
    return ''
  const input = trimmed.length > FOOTER_HTML_MAX_LENGTH
    ? trimmed.slice(0, FOOTER_HTML_MAX_LENGTH)
    : trimmed

  const out: string[] = []
  const openStack: string[] = []
  let skipTag: string | null = null
  let skipDepth = 0
  let i = 0
  const len = input.length

  while (i < len) {
    const lt = input.indexOf('<', i)
    if (lt === -1) {
      if (!skipTag)
        out.push(escapeText(decodeHtmlEntities(input.slice(i))))
      break
    }

    if (lt > i && !skipTag)
      out.push(escapeText(decodeHtmlEntities(input.slice(i, lt))))

    // Comments: <!-- ... -->
    if (input.startsWith('<!--', lt)) {
      const endComment = input.indexOf('-->', lt + 4)
      i = endComment === -1 ? len : endComment + 3
      continue
    }

    // Declarations / DOCTYPE / CDATA / Processing instructions: <! ... > or <? ... >
    if (input[lt + 1] === '!' || input[lt + 1] === '?') {
      const endDecl = input.indexOf('>', lt + 2)
      i = endDecl === -1 ? len : endDecl + 1
      continue
    }

    const parsed = parseTag(input, lt)
    if (!parsed) {
      // Bare '<' that does not form a tag — emit safely escaped if not skipping.
      if (!skipTag)
        out.push('&lt;')
      i = lt + 1
      continue
    }

    i = parsed.nextIndex
    const tagName = parsed.name

    if (skipTag) {
      if (tagName === skipTag) {
        if (parsed.isClosing) {
          skipDepth--
          if (skipDepth <= 0) {
            skipTag = null
            skipDepth = 0
          }
        }
        else if (!parsed.selfClosing) {
          skipDepth++
        }
      }
      continue
    }

    if (!parsed.isClosing && SKIP_CONTENT_TAGS.has(tagName)) {
      if (!parsed.selfClosing) {
        skipTag = tagName
        skipDepth = 1
      }
      continue
    }

    if (!ALLOWED_TAGS.has(tagName))
      continue

    if (parsed.isClosing) {
      if (VOID_TAGS.has(tagName))
        continue
      const matchIdx = openStack.lastIndexOf(tagName)
      if (matchIdx === -1)
        continue
      while (openStack.length > matchIdx) {
        const closing = openStack.pop()!
        out.push(`</${closing}>`)
      }
      continue
    }

    const safeAttrs = sanitizeTagAttributes(tagName, parsed.attrs)
    const attrSuffix = safeAttrs.length > 0 ? ` ${safeAttrs.join(' ')}` : ''
    if (VOID_TAGS.has(tagName)) {
      out.push(`<${tagName}${attrSuffix}>`)
    }
    else {
      out.push(`<${tagName}${attrSuffix}>`)
      if (parsed.selfClosing)
        out.push(`</${tagName}>`)
      else
        openStack.push(tagName)
    }
  }

  while (openStack.length > 0)
    out.push(`</${openStack.pop()!}>`)

  return out.join('')
}

function parseTag(input: string, start: number): {
  name: string
  isClosing: boolean
  selfClosing: boolean
  attrs: ParsedAttr[]
  nextIndex: number
} | null {
  const len = input.length
  let i = start + 1
  if (i >= len)
    return null

  let isClosing = false
  if (input[i] === '/') {
    isClosing = true
    i++
  }

  const nameStart = i
  while (i < len && /[A-Za-z0-9:-]/.test(input[i]))
    i++
  if (i === nameStart)
    return null
  const name = input.slice(nameStart, i).toLowerCase()

  const attrs: ParsedAttr[] = []
  let selfClosing = false

  while (i < len) {
    while (i < len && /[\s/]/.test(input[i])) {
      if (input[i] === '/')
        selfClosing = true
      i++
    }
    if (i >= len)
      return null
    if (input[i] === '>') {
      return { name, isClosing, selfClosing, attrs, nextIndex: i + 1 }
    }

    selfClosing = false
    const attrNameStart = i
    while (i < len && !/[\s=/>"'<]/.test(input[i]))
      i++
    if (i === attrNameStart) {
      // Skip unexpected punctuation inside malformed tag.
      i++
      continue
    }
    const attrName = input.slice(attrNameStart, i).toLowerCase()

    while (i < len && /\s/.test(input[i]))
      i++

    let attrValue = ''
    if (i < len && input[i] === '=') {
      i++
      while (i < len && /\s/.test(input[i]))
        i++
      if (i < len && (input[i] === '"' || input[i] === '\'')) {
        const quote = input[i]
        i++
        const valStart = i
        while (i < len && input[i] !== quote)
          i++
        attrValue = input.slice(valStart, i)
        if (i < len && input[i] === quote)
          i++
      }
      else {
        const valStart = i
        while (i < len && !/[\s>]/.test(input[i]))
          i++
        attrValue = input.slice(valStart, i)
      }
    }

    if (!isClosing)
      attrs.push({ name: attrName, value: decodeHtmlEntities(attrValue) })
  }

  return null
}

function sanitizeTagAttributes(tagName: string, attrs: ParsedAttr[]): string[] {
  const attrMap = new Map<string, string>()
  for (const attr of attrs) {
    if (!attrMap.has(attr.name))
      attrMap.set(attr.name, attr.value)
  }

  const emitted: string[] = []

  const safeClass = sanitizeClassAttr(attrMap.get('class'))
  if (safeClass)
    emitted.push(`class="${escapeAttr(safeClass)}"`)

  const safeStyle = sanitizeStyleAttr(attrMap.get('style'))
  if (safeStyle)
    emitted.push(`style="${escapeAttr(safeStyle)}"`)

  const safeTitle = sanitizePlainAttr(attrMap.get('title'))
  if (safeTitle)
    emitted.push(`title="${escapeAttr(safeTitle)}"`)

  const safeAriaLabel = sanitizePlainAttr(attrMap.get('aria-label'))
  if (safeAriaLabel)
    emitted.push(`aria-label="${escapeAttr(safeAriaLabel)}"`)

  if (tagName === 'a') {
    const safeHref = sanitizeFooterHref(attrMap.get('href'))
    if (safeHref)
      emitted.push(`href="${escapeAttr(safeHref)}"`)

    const rawTarget = (attrMap.get('target') || '').trim().toLowerCase()
    const safeTarget = rawTarget === '_blank' || rawTarget === '_self' ? rawTarget : ''
    if (safeTarget)
      emitted.push(`target="${safeTarget}"`)

    const safeRel = sanitizeRelAttr(attrMap.get('rel'), safeTarget === '_blank')
    if (safeRel)
      emitted.push(`rel="${safeRel}"`)
  }

  if (tagName === 'img') {
    const safeSrc = sanitizeFooterImgSrc(attrMap.get('src'))
    if (safeSrc)
      emitted.push(`src="${escapeAttr(safeSrc)}"`)

    const safeAlt = sanitizePlainAttr(attrMap.get('alt'))
    if (safeAlt)
      emitted.push(`alt="${escapeAttr(safeAlt)}"`)

    const safeWidth = sanitizeDimensionAttr(attrMap.get('width'))
    if (safeWidth)
      emitted.push(`width="${safeWidth}"`)

    const safeHeight = sanitizeDimensionAttr(attrMap.get('height'))
    if (safeHeight)
      emitted.push(`height="${safeHeight}"`)

    const rawLoading = (attrMap.get('loading') || '').trim().toLowerCase()
    if (rawLoading === 'lazy' || rawLoading === 'eager')
      emitted.push(`loading="${rawLoading}"`)
  }

  return emitted
}

function sanitizeClassAttr(raw?: string): string {
  if (!raw)
    return ''
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const part of raw.split(/\s+/)) {
    const token = part.trim()
    if (!token || seen.has(token) || !ALLOWED_FOOTER_CLASSES.has(token))
      continue
    seen.add(token)
    tokens.push(token)
  }
  return tokens.join(' ')
}

function sanitizePlainAttr(raw?: string): string {
  if (!raw)
    return ''
  const cleaned = stripControlChars(raw).trim()
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
}

function sanitizeDimensionAttr(raw?: string): string {
  if (!raw)
    return ''
  const trimmed = raw.trim().toLowerCase()
  return /^\d{1,4}(?:px)?$/.test(trimmed) ? trimmed : ''
}

function sanitizeRelAttr(raw: string | undefined, forceNoOpener: boolean): string {
  const tokens = new Set<string>()
  if (raw) {
    for (const part of raw.toLowerCase().split(/\s+/)) {
      if (ALLOWED_REL_TOKENS.has(part))
        tokens.add(part)
    }
  }
  if (forceNoOpener) {
    tokens.add('noopener')
    tokens.add('noreferrer')
  }
  return Array.from(tokens).join(' ')
}

function sanitizeStyleAttr(raw?: string): string {
  if (!raw)
    return ''
  // Strip CSS comments and disallow backslash escapes or nested blocks.
  const withoutComments = raw.replace(/\/\*[\s\S]*?\*\//g, '')
  if (/[\\{}<>]/.test(withoutComments))
    return ''

  const declarations: string[] = []
  for (const part of withoutComments.split(';')) {
    const colon = part.indexOf(':')
    if (colon === -1)
      continue
    const prop = stripControlChars(part.slice(0, colon)).trim().toLowerCase()
    if (!ALLOWED_STYLE_PROPERTIES.has(prop))
      continue

    const value = stripControlChars(part.slice(colon + 1)).trim()
    if (!value || value.length > 120)
      continue
    if (!isSafeCssValue(prop, value))
      continue

    declarations.push(`${prop}: ${value}`)
  }
  return declarations.join('; ')
}

const NON_NEGATIVE_BOUNDED_LENGTH_PROPS = new Set([
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'column-gap',
  'row-gap',
  'width',
  'max-width',
  'height',
  'max-height',
  'font-size',
  'border-radius',
])

function isSafeCssValue(prop: string, value: string): boolean {
  const lower = value.toLowerCase()
  if (
    lower.includes('url(')
    || lower.includes('expression(')
    || lower.includes('@import')
    || lower.includes('javascript:')
    || lower.includes('vbscript:')
    || lower.includes('behavior')
    || lower.includes('-moz-binding')
    || /["'\\{}<>]/.test(value)
  ) {
    return false
  }

  // Only allow safe color functions (rgb/rgba/hsl/hsla); reject arbitrary CSS functions.
  const fnMatches = lower.match(/[a-z_-]+\s*\(/g)
  if (fnMatches) {
    for (const fn of fnMatches) {
      const fnName = fn.slice(0, -1).trim()
      if (fnName !== 'rgb' && fnName !== 'rgba' && fnName !== 'hsl' && fnName !== 'hsla')
        return false
    }
  }

  // Reject viewport units (vh/vw/dvh/svh/lvh/vmin/vmax) so footer cannot span the screen.
  if (/\d(?:d|s|l)?v[hw]\b|\dv(?:min|max)\b/.test(lower))
    return false

  if (prop === 'display')
    return ALLOWED_DISPLAY_VALUES.has(lower)

  if (NON_NEGATIVE_BOUNDED_LENGTH_PROPS.has(prop))
    return isSafeBoundedLengthList(prop, lower)

  return /^[A-Za-z0-9\s#%.,()+\-/]+$/.test(value)
}

function isSafeBoundedLengthList(prop: string, value: string): boolean {
  const tokens = value.split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 4)
    return false

  const maxPx = (prop === 'width' || prop === 'max-width')
    ? 1200
    : (prop === 'height' || prop === 'max-height')
        ? 120
        : (prop === 'font-size')
            ? 32
            : 200

  for (const token of tokens) {
    if (token === 'auto' && (prop === 'margin' || prop === 'margin-left' || prop === 'margin-right' || prop === 'width' || prop === 'height'))
      continue
    if (token === '0')
      continue
    const m = /^(\d+(?:\.\d+)?)(px|rem|em|%)$/.exec(token)
    if (!m)
      return false
    const num = Number.parseFloat(m[1])
    const unit = m[2]
    if (!Number.isFinite(num) || num < 0)
      return false
    if (unit === 'px' && num > maxPx)
      return false
    if ((unit === 'rem' || unit === 'em') && num * 16 > maxPx)
      return false
    if (unit === '%') {
      if (prop !== 'width' && prop !== 'max-width' && prop !== 'border-radius')
        return false
      if (num > 100)
        return false
    }
  }
  return true
}

function sanitizeFooterHref(raw?: string): string {
  if (!raw)
    return ''
  const cleaned = stripControlChars(raw).trim()
  if (!cleaned || cleaned.length > 1000 || /\s/.test(cleaned) || cleaned.includes('\\'))
    return ''
  if (cleaned.startsWith('#'))
    return cleaned
  if (cleaned.startsWith('/') && !cleaned.startsWith('//'))
    return cleaned

  let parsed: URL
  try {
    parsed = new URL(cleaned)
  }
  catch {
    return ''
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:')
    return parsed.hostname ? cleaned : ''
  if (parsed.protocol === 'mailto:')
    return cleaned
  return ''
}

function sanitizeFooterImgSrc(raw?: string): string {
  if (!raw)
    return ''
  const cleaned = stripControlChars(raw).trim()
  if (!cleaned || cleaned.length > 1000 || /\s/.test(cleaned) || cleaned.includes('\\'))
    return ''
  if (cleaned.startsWith('/') && !cleaned.startsWith('//'))
    return cleaned

  let parsed: URL
  try {
    parsed = new URL(cleaned)
  }
  catch {
    return ''
  }
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname)
    return cleaned
  return ''
}

function decodeHtmlEntities(input: string): string {
  if (!input.includes('&'))
    return input
  return input.replace(/&(?:#[xX]0*([0-9a-fA-F]{1,6})|#0*(\d{1,7})|([A-Za-z]{2,12}));?/g, (match, hex, dec, named) => {
    if (hex) {
      const code = Number.parseInt(hex, 16)
      return safeFromCodePoint(code)
    }
    if (dec) {
      const code = Number.parseInt(dec, 10)
      return safeFromCodePoint(code)
    }
    if (named) {
      const resolved = NAMED_ENTITIES[named.toLowerCase()]
      if (resolved !== undefined)
        return resolved
    }
    return match
  })
}

function safeFromCodePoint(code: number): string {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF))
    return '\uFFFD'
  return String.fromCodePoint(code)
}

function stripControlChars(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    if (code <= 31 || code === 127)
      continue
    out += input[i]
  }
  return out
}

function escapeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(input: string): string {
  return escapeText(input).replace(/"/g, '&quot;')
}
