import assert from 'node:assert/strict'
import test from 'node:test'
import { isSafeModeActive } from '../studio/customCode.ts'
import { resolveSafeFooterHtml, sanitizeFooterHtml } from './footerHtml.ts'

test('sanitizeFooterHtml preserves default footer, compliant ICP/filing links, and safe typography', () => {
  const defaultFooter = '<div class="flex justify-center text-slate-400 text-xs" style="margin-top:80px">Powered by <a href="https://github.com/Tleon-H/leon-panel" target="_blank" class="ml-[5px]">Leon Panel</a></div>'
  const cleanedDefault = sanitizeFooterHtml(defaultFooter)
  assert.equal(
    cleanedDefault,
    '<div class="flex justify-center text-slate-400 text-xs" style="margin-top: 80px">Powered by <a class="ml-[5px]" href="https://github.com/Tleon-H/leon-panel" target="_blank" rel="noopener noreferrer">Leon Panel</a></div>',
  )

  const icpFooter = '<div class="flex justify-center gap-3 text-xs" style="text-align: center; color: rgba(148, 163, 184, 0.9)"><a href="https://beian.miit.gov.cn/" target="_blank" rel="nofollow">京ICP备20260001号</a><span>|</span><img src="/uploads/beian.png" alt="备案图标" width="16" height="16" loading="lazy"><a href="mailto:admin@example.com">联系管理员</a></div>'
  const cleanedIcp = sanitizeFooterHtml(icpFooter)
  assert.match(cleanedIcp, /href="https:\/\/beian\.miit\.gov\.cn\/"/)
  assert.match(cleanedIcp, /rel="nofollow noopener noreferrer"/)
  assert.match(cleanedIcp, /src="\/uploads\/beian\.png"/)
  assert.match(cleanedIcp, /alt="备案图标"/)
  assert.match(cleanedIcp, /href="mailto:admin@example\.com"/)
  assert.match(cleanedIcp, /color: rgba\(148, 163, 184, 0\.9\)/)
})

test('sanitizeFooterHtml strips scripts, event handlers, dangerous URLs, styles, and foreign containers', () => {
  const payloads = [
    '<script>alert(1)</script><span>Safe</span>',
    '<scr<script>ipt>alert(1)</script>',
    '<SCRIPT type="text/javascript">fetch("/api/panel/users/getList")</SCRIPT>OK',
    '<svg onload="alert(1)"><script>alert(2)</script></svg><p>Text</p>',
    '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
    '<iframe src="https://evil.example">fallback</iframe>',
    '<style>body{display:none!important}</style><div>Visible</div>',
    '<img src="x" onerror="alert(1)" onload="alert(2)">',
    '<img src="javascript:alert(1)" alt="bad">',
    '<img src="data:image/svg+xml,<svg onload=alert(1)>" alt="bad">',
    '<img src="//evil.example/a.png" alt="proto-rel">',
    '<a href="javascript:alert(1)" onclick="alert(2)">Click</a>',
    '<a href="java&#x09;script:alert(1)">Encoded</a>',
    '<a href="&#x00000006a;avascript:alert(1)">ZeroPaddedHex</a>',
    '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)">Decimal</a>',
    '<a href="data:text/html,<script>alert(1)</script>">Data</a>',
    '<a href="//evil.example/phish">ProtoRel</a>',
    '<div style="color: #94a3b8; background-image: url(javascript:alert(1)); width: expression(alert(1))">Styled</div>',
  ]

  for (const raw of payloads) {
    const out = sanitizeFooterHtml(raw)
    assert.doesNotMatch(out, /<script/i, `script leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /<svg/i, `svg leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /<math/i, `math leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /<iframe/i, `iframe leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /<style/i, `style leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /\bon[a-z]+\s*=/i, `event handler leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /javascript:/i, `javascript: leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /data:/i, `data: leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /expression\(/i, `expression() leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /url\(/i, `url() leaked for ${raw}: ${out}`)
    assert.doesNotMatch(out, /evil\.example/i, `blocked host leaked for ${raw}: ${out}`)
  }

  // Safe style property survives while dangerous declarations in the same style attribute are dropped.
  const mixedStyle = sanitizeFooterHtml('<div style="color: #94a3b8; background-image: url(javascript:alert(1))">Styled</div>')
  assert.equal(mixedStyle, '<div style="color: #94a3b8">Styled</div>')
})

test('sanitizeFooterHtml balances unclosed tags and ignores stray closing tags', () => {
  assert.equal(
    sanitizeFooterHtml('</div></div><div><a href="https://example.com">Hello'),
    '<div><a href="https://example.com">Hello</a></div>',
  )
  assert.equal(
    sanitizeFooterHtml('<!-- <script>alert(1)</script> --><span>2 &lt; 3 &amp; 4 &gt; 1</span>'),
    '<span>2 &lt; 3 &amp; 4 &gt; 1</span>',
  )
})

test('resolveSafeFooterHtml skips custom footer rendering in /?safe=1 and #/?safe=1 safe mode', () => {
  const sample = '<div><a href="https://example.com" target="_blank">Footer</a></div>'

  const safeFromSearch = isSafeModeActive({ search: '?safe=1', hash: '#/' })
  assert.equal(safeFromSearch, true)
  assert.equal(resolveSafeFooterHtml(sample, safeFromSearch), '')

  const safeFromHash = isSafeModeActive({ search: '', hash: '#/?safe=1' })
  assert.equal(safeFromHash, true)
  assert.equal(resolveSafeFooterHtml(sample, safeFromHash), '')

  const normalMode = isSafeModeActive({ search: '', hash: '#/' })
  assert.equal(normalMode, false)
  assert.equal(
    resolveSafeFooterHtml(sample, normalMode),
    '<div><a href="https://example.com" target="_blank" rel="noopener noreferrer">Footer</a></div>',
  )
})
