// CodeMirror 6 구성 (Raw 모드에서만 지연 로드됨)
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { insertLink, toggleWrap } from './format'
import { slashSource } from './slash'
import { tableExtension } from './table-ext'

/** 탭별 에디터 상태(실행 취소 기록 포함) — 탭 전환 시 보존 */
export const editorStates = new Map<number, EditorState>()

export const editableCompartment = new Compartment()

export function editableExt(edit: boolean): Extension {
  // 읽기 모드에서도 커서 이동·선택·검색(Ctrl+F)은 가능하도록 readOnly만 설정
  return EditorState.readOnly.of(!edit)
}

const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.4em', fontWeight: '700', color: 'var(--hl-title)' },
  { tag: tags.heading2, fontSize: '1.2em', fontWeight: '700', color: 'var(--hl-title)' },
  { tag: tags.heading, fontWeight: '700', color: 'var(--hl-title)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--accent)' },
  { tag: tags.monospace, color: 'var(--hl-string)' },
  { tag: tags.quote, color: 'var(--fg-muted)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.meta], color: 'var(--fg-muted)' },
  // 코드 블록 내부 언어
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'var(--hl-keyword)' },
  { tag: [tags.string, tags.regexp, tags.special(tags.string)], color: 'var(--hl-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--hl-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.className, tags.typeName], color: 'var(--hl-title)' },
  { tag: [tags.propertyName, tags.attributeName, tags.tagName], color: 'var(--hl-builtin)' },
])

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: 'var(--bg)', color: 'var(--fg)' },
  '&.cm-focused': { outline: 'none' },
  // 합자(ligature) 끄기: Raw에서는 `---`, `<=` 등 원문 문자가 그대로 보여야 함
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', fontVariantLigatures: 'none' },
  '.cm-content': { caretColor: 'var(--fg)', padding: '12px 0 40vh' },
  '.cm-line': { padding: '0 16px 0 8px' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-elev)',
    color: 'var(--fg-muted)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)', color: 'var(--fg)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)' },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--accent) 14%, transparent)' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, #f2cc60 45%, transparent)' },
  '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, #f2cc60 80%, transparent)' },
  '.cm-panels': { backgroundColor: 'var(--bg-elev)', color: 'var(--fg)', borderColor: 'var(--border)' },
  '.cm-panels input, .cm-panels button': { font: 'inherit', color: 'inherit' },
  '.cm-textfield': { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--bg)', border: '1px solid var(--border)' },
  // 슬래시 명령 자동완성 목록
  '.cm-tooltip': { backgroundColor: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '6px' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-ui)', maxHeight: '18em' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px !important' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent)', color: '#fff' },
  '.cm-completionDetail': { marginLeft: '12px', fontStyle: 'normal', opacity: '0.75' },
})

// 서식 단축키
const formatKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => toggleWrap(v, '**') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
  { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~') },
  { key: 'Mod-`', run: (v) => toggleWrap(v, '`') },
  { key: 'Mod-k', run: (v) => insertLink(v) },
])

// 파일·탭 드롭은 CodeMirror가 텍스트로 삽입하지 않고 앱(파일 열기 / 탭 이동)으로 넘긴다
const passthrough = (e: DragEvent) =>
  !!e.dataTransfer?.types.some((type) => type === 'Files' || type === 'application/x-defaultmd-tab')
const fileDropPassthrough = EditorView.domEventHandlers({ drop: passthrough, dragover: passthrough })

export function createEditorState(text: string, edit: boolean): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(highlight),
      theme,
      fileDropPassthrough,
      editableCompartment.of(editableExt(edit)),
      tableExtension(),
      autocompletion({ override: [slashSource], icons: false }),
      formatKeymap,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
    ],
  })
}
