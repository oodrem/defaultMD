// 탭별로 떠 있는 편집기(Raw = CodeMirror, 미리보기-수정 = Milkdown)의 공통 인터페이스.
// 서식 툴바·문법 가이드는 이 인터페이스만 사용하고, 편집기 라이브러리는 import하지 않는다(메인 번들 경량).
import { tick } from 'svelte'
import { current } from '../app/workspace.svelte'

export type LineKind = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'quote' | 'ul' | 'ol' | 'task'
export type WrapKind = 'bold' | 'italic' | 'strike' | 'code'

export interface EditorAdapter {
  kind: 'raw' | 'wysiwyg'
  focus(): void
  wrap(kind: WrapKind): void
  line(kind: LineKind): void
  link(): void
  image(): void
  codeBlock(): void
  hr(): void
  insertTable(rows: number, cols: number): void
  /** 표 편집기 (Raw만) */
  tableEditor?(): void
  /** Markdown 조각 삽입. block = 앞뒤 빈 줄 */
  insertMarkdown(md: string, block: boolean): void
}

/** 탭 key → 화면에 떠 있는 수정 가능한 편집기 */
export const adapters = new Map<number, EditorAdapter>()

/** 포커스된 영역의 편집기 */
export function activeAdapter(): EditorAdapter | undefined {
  const c = current()
  return c?.tab.edit ? adapters.get(c.tab.key) : undefined
}

/** 삽입 기능용: 현재 탭을 수정 모드로 바꾸고(보기 방식은 유지) 편집기가 뜰 때까지 기다림 */
export async function ensureEditable(): Promise<EditorAdapter | undefined> {
  const c = current()
  if (!c) return undefined
  c.tab.edit = true
  await tick()
  for (let i = 0; i < 120; i++) {
    const a = adapters.get(c.tab.key)
    if (a) return a
    await new Promise(requestAnimationFrame)
  }
  return undefined
}
