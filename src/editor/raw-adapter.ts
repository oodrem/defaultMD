// CodeMirror(Raw) 편집기용 EditorAdapter
import type { EditorView } from '@codemirror/view'
import type { EditorAdapter } from './active'
import { insertBlock, insertCodeBlock, insertLink, insertRule, insertText, setLineKind, toggleWrap } from './format'
import { insertTable, newTable, openTableEditor } from './table-ext'

const MARKERS = { bold: '**', italic: '*', strike: '~~', code: '`' } as const

export function rawAdapter(view: EditorView): EditorAdapter {
  return {
    kind: 'raw',
    focus: () => view.focus(),
    wrap: (kind) => toggleWrap(view, MARKERS[kind]),
    line: (kind) => setLineKind(view, kind),
    link: () => insertLink(view),
    image: () => insertLink(view, true),
    codeBlock: () => insertCodeBlock(view),
    hr: () => insertRule(view),
    insertTable: (rows, cols) => insertTable(view, newTable(rows, cols)),
    tableEditor: () => openTableEditor(view),
    insertMarkdown: (md, block) => (block ? insertBlock(view, md) : insertText(view, md)),
  }
}
