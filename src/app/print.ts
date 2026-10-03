// PDF 저장(인쇄): 현재 문서를 인쇄 전용 영역에 라이트 테마로 다시 렌더한 뒤 window.print().
// Edge 인쇄 대화상자에서 대상 "PDF로 저장"을 고르면 PDF가 된다. (Tauri 버전은 M10에서 WebView2 PrintToPdf)
import { enhance } from '../markdown/enhance'
import { hasMath, loadMath, renderMarkdown } from '../markdown/render'
import type { Platform } from '../platform'
import type { Doc } from './workspace.svelte'

const MD_EXT = /\.(md|markdown|mdown|mkd)$/i

function waitImages(root: HTMLElement, timeout = 4000): Promise<void> {
  const pending = Array.from(root.querySelectorAll('img')).filter((img) => img.src && !img.complete)
  if (!pending.length) return Promise.resolve()
  const loaded = (img: HTMLImageElement) =>
    new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true })
      img.addEventListener('error', () => resolve(), { once: true })
    })
  return Promise.race([
    Promise.all(pending.map(loaded)).then(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, timeout)),
  ])
}

export async function printDoc(doc: Doc, platform: Platform) {
  if (hasMath(doc.text)) await loadMath()

  document.getElementById('print-root')?.remove()
  const root = document.createElement('article')
  root.id = 'print-root'
  root.className = 'markdown-body'
  root.innerHTML = renderMarkdown(doc.text)
  document.body.append(root)

  // 상대경로 이미지 해석 (허용한 폴더가 있을 때) + 지연 로딩 해제
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>('img')).map(async (img) => {
      img.removeAttribute('loading')
      const rel = img.dataset.mdSrc
      if (!rel) return
      const url = await platform.resolveAsset(doc.handle, rel)
      if (url) img.src = url
      else img.remove()
    }),
  )
  await enhance(root, 'default') // 다이어그램은 인쇄용 밝은 테마
  await waitImages(root)

  // 저장 파일 이름의 기본값은 문서 제목
  const title = document.title
  document.title = doc.name.replace(MD_EXT, '')
  const cleanup = () => {
    document.title = title
    root.remove()
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}
