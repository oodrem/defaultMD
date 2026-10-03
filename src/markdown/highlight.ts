// 코드 블록이 있을 때만 지연 로드되는 구문 강조
import hljs from 'highlight.js/lib/common'
import '../theme/hljs.css'

export function highlightAll(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('pre code:not(.hljs)').forEach((code) => {
    const lang = /language-([\w-]+)/.exec(code.className)?.[1]
    if (lang && !hljs.getLanguage(lang)) {
      code.classList.add('hljs') // 미지원 언어는 원문 그대로
      return
    }
    hljs.highlightElement(code)
  })
}
