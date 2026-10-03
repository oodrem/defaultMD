// 렌더된 HTML 후처리: 다이어그램(Mermaid) → 코드 강조. 각각 필요할 때만 지연 로드

export type DiagramTheme = 'default' | 'dark'

/** 현재 화면 테마 (data-theme 또는 시스템 설정) */
export function currentDiagramTheme(): DiagramTheme {
  const t = document.documentElement.dataset.theme
  if (t) return t === 'dark' ? 'dark' : 'default'
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
}

let seq = 0

/** ```mermaid 코드 블록 → SVG 다이어그램. 이미 그린 다이어그램은 테마만 바꿔 다시 그림 */
export async function renderDiagrams(root: HTMLElement, theme: DiagramTheme) {
  for (const code of root.querySelectorAll<HTMLElement>('pre > code.language-mermaid')) {
    const box = document.createElement('div')
    box.className = 'mermaid'
    box.dataset.code = code.textContent ?? ''
    code.parentElement!.replaceWith(box)
  }
  const boxes = Array.from(root.querySelectorAll<HTMLElement>('div.mermaid[data-code]'))
  if (!boxes.length) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme, fontFamily: 'inherit' })
  for (const box of boxes) {
    if (box.dataset.theme === theme && box.firstElementChild) continue
    try {
      const { svg } = await mermaid.render(`mmd-${++seq}`, box.dataset.code!)
      box.innerHTML = svg // securityLevel 'strict': Mermaid가 내부에서 살균
      box.dataset.theme = theme
    } catch (e) {
      const pre = document.createElement('pre')
      pre.className = 'mermaid-error'
      pre.textContent = `Mermaid: ${(e as Error).message ?? e}`
      box.replaceChildren(pre)
    }
  }
}

export async function highlightCode(root: HTMLElement) {
  if (!root.querySelector('pre code:not(.hljs)')) return
  const { highlightAll } = await import('./highlight')
  highlightAll(root)
}

export async function enhance(root: HTMLElement, theme: DiagramTheme = currentDiagramTheme()) {
  await renderDiagrams(root, theme)
  await highlightCode(root)
}
