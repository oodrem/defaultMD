// 서식 명령 (서식 툴바·단축키·문법 가이드에서 사용)
import { EditorSelection, type ChangeSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { t } from '../i18n/index.svelte'

function done(view: EditorView) {
  view.focus()
  return true
}

/** 선택 영역을 기호로 감싸거나(없으면 커서를 기호 사이에) 이미 감싸져 있으면 해제 */
export function toggleWrap(view: EditorView, marker: string): boolean {
  if (view.state.readOnly) return false
  const { state } = view
  const m = marker.length
  view.dispatch(
    state.update(
      state.changeByRange((range) => {
        const before = state.sliceDoc(range.from - m, range.from)
        const after = state.sliceDoc(range.to, range.to + m)
        if (before === marker && after === marker) {
          return {
            changes: [
              { from: range.from - m, to: range.from },
              { from: range.to, to: range.to + m },
            ],
            range: EditorSelection.range(range.from - m, range.to - m),
          }
        }
        const text = state.sliceDoc(range.from, range.to)
        if (text.length >= 2 * m && text.startsWith(marker) && text.endsWith(marker)) {
          return {
            changes: { from: range.from, to: range.to, insert: text.slice(m, -m) },
            range: EditorSelection.range(range.from, range.to - 2 * m),
          }
        }
        return {
          changes: { from: range.from, to: range.to, insert: marker + text + marker },
          range: EditorSelection.range(range.from + m, range.to + m),
        }
      }),
      { scrollIntoView: true, userEvent: 'input.format' },
    ),
  )
  return done(view)
}

export type LineKind = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'quote' | 'ul' | 'ol' | 'task'

const PREFIX = /^(\s*)(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/

function hasKind(prefix: string, kind: LineKind): boolean {
  if (kind.startsWith('h')) return new RegExp(`^#{${kind[1]}}\\s`).test(prefix)
  if (kind === 'quote') return prefix.startsWith('>')
  if (kind === 'task') return /^[-*+]\s+\[/.test(prefix)
  if (kind === 'ul') return /^[-*+]\s/.test(prefix) && !prefix.includes('[')
  if (kind === 'ol') return /^\d/.test(prefix)
  return false
}

/** 선택한 줄들의 머리 기호(제목·인용·목록) 설정. 모두 이미 그 형식이면 해제 */
export function setLineKind(view: EditorView, kind: LineKind): boolean {
  if (view.state.readOnly) return false
  const { state } = view
  const lines = new Map<number, { from: number; text: string }>()
  for (const r of state.selection.ranges) {
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) {
      const line = state.doc.line(n)
      lines.set(n, { from: line.from, text: line.text })
    }
  }
  const targets = [...lines.values()].filter((l, _, all) => all.length === 1 || l.text.trim())
  const parsed = targets.map((l) => ({ ...l, m: PREFIX.exec(l.text)! }))
  const off = kind !== 'p' && parsed.every((p) => hasKind(p.m[2] ?? '', kind))

  const changes: ChangeSpec[] = parsed.map((p, i) => {
    const indent = p.m[1]
    const existing = p.m[2] ?? ''
    let insert = ''
    if (!off) {
      if (kind.startsWith('h')) insert = '#'.repeat(+kind[1]) + ' '
      else if (kind === 'quote') insert = '> '
      else if (kind === 'ul') insert = '- '
      else if (kind === 'ol') insert = `${i + 1}. `
      else if (kind === 'task') insert = '- [ ] '
    }
    return { from: p.from + indent.length, to: p.from + indent.length + existing.length, insert }
  })
  view.dispatch({ changes, scrollIntoView: true, userEvent: 'input.format' })
  return done(view)
}

/** 커서 위치에 텍스트 삽입. select = 삽입 텍스트 안에서 선택할 [시작, 끝] */
export function insertText(view: EditorView, text: string, select?: [number, number]): boolean {
  if (view.state.readOnly) return false
  const r = view.state.selection.main
  const sel = select ?? [text.length, text.length]
  view.dispatch({
    changes: { from: r.from, to: r.to, insert: text },
    selection: EditorSelection.range(r.from + sel[0], r.from + sel[1]),
    scrollIntoView: true,
    userEvent: 'input.format',
  })
  return done(view)
}

/** 블록 요소 삽입: 앞뒤를 빈 줄로 띄움 */
export function insertBlock(view: EditorView, block: string, select?: [number, number]): boolean {
  if (view.state.readOnly) return false
  const { state } = view
  const r = state.selection.main
  const line = state.doc.lineAt(r.from)
  const atStart = r.from === line.from
  const prevBlank = line.number === 1 || !state.doc.line(line.number - 1).text.trim()
  const before = line.text.trim() ? (atStart ? (prevBlank ? '' : '\n') : '\n\n') : prevBlank ? '' : '\n'
  const text = before + block + '\n'
  const sel = select ?? [block.length, block.length]
  return insertText(view, text, [before.length + sel[0], before.length + sel[1]])
}

export function insertLink(view: EditorView, image = false): boolean {
  const sel = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
  const label = sel || t(image ? 'fmt.imageAlt' : 'fmt.linkText')
  const url = image ? t('fmt.imagePath') : 'https://'
  const text = `${image ? '!' : ''}[${label}](${url})`
  const labelStart = image ? 2 : 1
  // 선택한 텍스트가 있으면 주소를, 없으면 링크 텍스트를 선택
  const urlStart = labelStart + label.length + 2
  return insertText(view, text, sel ? [urlStart, urlStart + url.length] : [labelStart, labelStart + label.length])
}

export function insertCodeBlock(view: EditorView): boolean {
  const sel = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
  const block = '```\n' + sel + '\n```'
  return insertBlock(view, block, [3, 3])
}

export const insertRule = (view: EditorView) => insertBlock(view, '---')
