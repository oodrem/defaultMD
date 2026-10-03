import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'dompurify'
import { renderState } from './renderState.svelte'

const md = new MarkdownIt({ html: true, linkify: true, breaks: false })
  .use(footnote)
  .use(taskLists, { enabled: false, label: true })

// 블록 시작 줄 번호(M2 스크롤 동기화용) + GitHub 방식 제목 id(#앵커 링크용)
md.core.ruler.push('source_line_and_slug', (state) => {
  const used = new Map<string, number>()
  state.tokens.forEach((token, i) => {
    if (token.map && token.nesting === 1) token.attrSet('data-line', String(token.map[0]))
    if (token.type === 'heading_open') {
      const text = state.tokens[i + 1]?.content ?? ''
      const base = text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-')
      const n = used.get(base) ?? 0
      used.set(base, n + 1)
      token.attrSet('id', n ? `${base}-${n}` : base)
    }
  })
})

const EXTERNAL = /^(https?:|mailto:)/i
const INLINE_SRC = /^(https?:|data:|blob:)/i

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? ''
    if (EXTERNAL.test(href)) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  } else if (node.tagName === 'IMG') {
    // 상대경로 이미지는 앱 주소 기준으로 로드되지 않도록 보류 → Preview에서 해석
    const src = node.getAttribute('src') ?? ''
    if (src && !INLINE_SRC.test(src)) {
      node.setAttribute('data-md-src', src)
      node.removeAttribute('src')
    }
    node.setAttribute('loading', 'lazy')
  }
})

// ── 수식: 문법이 보이면 KaTeX를 지연 로드한 뒤 renderState.version을 올려 다시 그리게 함 ──
const MATH_HINT = /\$\$|\$[^\s$][^$\n]*\$|```math|\\\(|\\\[/
let mathReady = false
let mathLoading: Promise<void> | undefined

export function hasMath(source: string): boolean {
  return MATH_HINT.test(source)
}

export function loadMath(): Promise<void> {
  return (mathLoading ??= import('./math').then((m) => {
    m.install(md)
    mathReady = true
    renderState.version++
  }))
}

/** 줄 하나에 `<!-- pagebreak -->` → PDF/인쇄 시 쪽 나눔 (줄 수는 그대로 유지) */
const PAGE_BREAK = /^[ \t]*<!--\s*page-?break\s*-->[ \t]*$/gim

export function renderMarkdown(source: string): string {
  if (!mathReady && hasMath(source)) loadMath()
  const src = source.replace(PAGE_BREAK, '<div class="page-break"></div>')
  return DOMPurify.sanitize(md.render(src), { ADD_ATTR: ['target', 'data-line', 'data-md-src'] })
}
