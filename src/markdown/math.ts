// 수식(KaTeX): 문서에 수식 문법이 있을 때만 지연 로드
import katex from 'katex'
import 'katex/dist/katex.min.css'
import mdKatex from '@vscode/markdown-it-katex'

export function install(md: Parameters<typeof mdKatex>[0]) {
  // CJS 모듈이라 번들러에 따라 default가 한 번 더 감싸질 수 있음
  const plugin = ((mdKatex as unknown as { default?: typeof mdKatex }).default ?? mdKatex) as typeof mdKatex
  md.use(plugin, { katex, throwOnError: false, enableFencedBlocks: true })
}
