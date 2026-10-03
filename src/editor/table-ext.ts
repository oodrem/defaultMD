// Raw 에디터의 표 지원: Tab/Enter 셀 이동 + 자동 정렬, 우클릭 메뉴(행/열 조작), 스프레드시트 붙여넣기 변환
import { EditorSelection, Prec, type EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { editTable } from '../app/tableDialog.svelte'
import { notify, showMenu, type MenuItem } from '../app/ui.svelte'
import { t } from '../i18n/index.svelte'
import {
  cellAt,
  cellRange,
  colCount,
  createTable,
  csvToTable,
  deleteCol,
  deleteRow,
  formatTable,
  insertCol,
  insertRow,
  isSeparator,
  moveCol,
  moveRow,
  parseTable,
  rowsToTable,
  setAlign,
  tsvToTable,
  type Table,
} from '../markdown/table'

interface Located {
  /** 표 첫 줄/마지막 줄 번호 (1부터) */
  first: number
  last: number
  table: Table
  /** table.rows 기준 행 (0 = 머리글) */
  row: number
  col: number
  onSeparator: boolean
}

/** pos가 표 안이면 표 정보 */
export function locateTable(state: EditorState, pos = state.selection.main.head): Located | null {
  const doc = state.doc
  const line = doc.lineAt(pos)
  const isRow = (n: number) => {
    const text = doc.line(n).text
    return text.includes('|') && text.trim() !== ''
  }
  if (!isRow(line.number)) return null
  let first = line.number
  let last = line.number
  while (first > 1 && isRow(first - 1)) first--
  while (last < doc.lines && isRow(last + 1)) last++

  // 머리글 바로 아래가 구분선이어야 함. 위쪽에 파이프가 들어간 다른 줄이 붙어 있으면 건너뜀
  while (first < last && !isSeparator(doc.line(first + 1).text)) first++
  if (first >= last || line.number < first) return null

  const lines: string[] = []
  for (let n = first; n <= last; n++) lines.push(doc.line(n).text)
  const table = parseTable(lines)
  const idx = line.number - first
  return {
    first,
    last,
    table,
    row: idx === 0 ? 0 : Math.max(1, idx - 1),
    col: Math.min(cellAt(line.text, pos - line.from), colCount(table) - 1),
    onSeparator: idx === 1,
  }
}

/** 표를 정렬해서 다시 쓰고 (row, col) 셀 내용을 선택 */
function writeTable(view: EditorView, loc: Pick<Located, 'first' | 'last'>, table: Table, row: number, col: number) {
  const lines = formatTable(table)
  const doc = view.state.doc
  const from = doc.line(loc.first).from
  const to = doc.line(loc.last).to
  const li = row === 0 ? 0 : row + 1
  let offset = 0
  for (let i = 0; i < li; i++) offset += lines[i].length + 1
  const [s, e] = cellRange(lines[li], col)
  view.dispatch({
    changes: { from, to, insert: lines.join('\n') },
    selection: EditorSelection.range(from + offset + s, from + offset + e),
    scrollIntoView: true,
    userEvent: 'input.table',
  })
}

function withTable(fn: (view: EditorView, loc: Located) => boolean) {
  return (view: EditorView) => {
    if (view.state.readOnly) return false
    const loc = locateTable(view.state)
    return loc ? fn(view, loc) : false
  }
}

/** Tab: 다음 셀 (마지막 셀이면 새 행) */
const nextCell = withTable((view, loc) => {
  let { table, row, col } = loc
  if (loc.onSeparator) col = -1
  if (col + 1 < colCount(table)) col++
  else {
    row++
    col = 0
    if (row >= table.rows.length) table = insertRow(table, row)
  }
  writeTable(view, loc, table, row, col)
  return true
})

/** Shift+Tab: 이전 셀 */
const prevCell = withTable((view, loc) => {
  let { row, col } = loc
  if (col > 0) col--
  else if (row > 0) {
    row = loc.onSeparator ? 0 : row - 1
    col = colCount(loc.table) - 1
  }
  writeTable(view, loc, loc.table, row, col)
  return true
})

/** Enter: 아래 셀 (마지막 행이면 새 행, 빈 마지막 행에서 누르면 표 밖으로) */
const nextRow = withTable((view, loc) => {
  let { table, row } = loc
  const lastRow = row === table.rows.length - 1
  if (lastRow && row > 1 && table.rows[row].every((c) => !c.trim())) {
    // 빈 행 삭제 후 표 밖으로. GFM 표는 빈 줄에서 끝나므로 표 아래에 빈 줄을 확보
    table = deleteRow(table, row)
    const doc = view.state.doc
    const from = doc.line(loc.first).from
    const to = doc.line(loc.last).to
    const body = formatTable(table).join('\n')
    const nextBlank = loc.last < doc.lines && !doc.line(loc.last + 1).text.trim()
    // 다음 줄이 빈 줄이면 그 아래 새 줄에서, 아니면 빈 줄 + 새 줄을 넣어서 시작
    const text = body + (nextBlank ? '\n' : '\n\n')
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length + (nextBlank ? 1 : 0) },
      scrollIntoView: true,
      userEvent: 'input.table',
    })
    return true
  }
  row = loc.onSeparator ? 1 : row + 1
  if (row >= table.rows.length) table = insertRow(table, row)
  writeTable(view, loc, table, row, loc.col)
  return true
})

export function formatTableAt(view: EditorView): boolean {
  return withTable((v, loc) => {
    writeTable(v, loc, loc.table, loc.row, loc.col)
    return true
  })(view)
}

/** 커서 위치에 표 삽입 (앞뒤 빈 줄 확보), 첫 머리글 셀 선택 */
export function insertTable(view: EditorView, table: Table) {
  if (view.state.readOnly) return
  const { state } = view
  const r = state.selection.main
  const line = state.doc.lineAt(r.from)
  const prefix = line.text.trim() ? '\n\n' : line.number > 1 && state.doc.line(line.number - 1).text.trim() ? '\n' : ''
  const insertAt = line.text.trim() ? line.to : r.from
  const lines = formatTable(table)
  const text = prefix + lines.join('\n') + '\n'
  const [s, e] = cellRange(lines[0], 0)
  const start = insertAt + prefix.length
  view.dispatch({
    changes: { from: insertAt, to: line.text.trim() ? line.to : r.to, insert: text },
    selection: EditorSelection.range(start + s, start + e),
    scrollIntoView: true,
    userEvent: 'input.table',
  })
  view.focus()
}

export const defaultHeader = (i: number) => `${t('table.header')}${i + 1}`

export function newTable(rows: number, cols: number): Table {
  return createTable(rows, cols, defaultHeader)
}

/** 표 편집기: 커서가 표 안이면 그 표를, 아니면 새 표(3×3)를 편집 */
export async function openTableEditor(view: EditorView) {
  const loc = locateTable(view.state)
  const result = await editTable(loc?.table ?? newTable(3, 3), !loc)
  if (!result) return view.focus()
  if (loc) writeTable(view, loc, result, Math.min(loc.row, result.rows.length - 1), 0)
  else insertTable(view, result)
  view.focus()
}

// ── 우클릭 메뉴 ──

function tableMenu(view: EditorView, loc: Located): MenuItem[] {
  const ro = view.state.readOnly
  const op = (fn: (tb: Table) => Table, row = loc.row, col = loc.col) =>
    ro ? undefined : () => writeTable(view, loc, fn(loc.table), row, col)
  const { row, col, table } = loc
  const body = row >= 1
  const cols = colCount(table)
  return [
    { label: t('table.editor'), action: ro ? undefined : () => openTableEditor(view) },
    { label: t('table.format'), action: op((tb) => tb) },
    { label: t('table.rowAbove'), action: body ? op((tb) => insertRow(tb, row), row) : undefined, separator: true },
    { label: t('table.rowBelow'), action: op((tb) => insertRow(tb, row + 1), row + 1) },
    { label: t('table.rowDelete'), action: body ? op((tb) => deleteRow(tb, row), Math.min(row, table.rows.length - 2)) : undefined },
    { label: t('table.rowUp'), action: row > 1 ? op((tb) => moveRow(tb, row, row - 1), row - 1) : undefined },
    { label: t('table.rowDown'), action: body && row < table.rows.length - 1 ? op((tb) => moveRow(tb, row, row + 1), row + 1) : undefined },
    { label: t('table.colLeft'), action: op((tb) => insertCol(tb, col), row, col), separator: true },
    { label: t('table.colRight'), action: op((tb) => insertCol(tb, col + 1), row, col + 1) },
    { label: t('table.colDelete'), action: cols > 1 ? op((tb) => deleteCol(tb, col), row, Math.min(col, cols - 2)) : undefined },
    { label: t('table.colMoveLeft'), action: col > 0 ? op((tb) => moveCol(tb, col, col - 1), row, col - 1) : undefined },
    { label: t('table.colMoveRight'), action: col < cols - 1 ? op((tb) => moveCol(tb, col, col + 1), row, col + 1) : undefined },
    { label: t('table.alignLeft'), action: op((tb) => setAlign(tb, col, 'left')), separator: true },
    { label: t('table.alignCenter'), action: op((tb) => setAlign(tb, col, 'center')) },
    { label: t('table.alignRight'), action: op((tb) => setAlign(tb, col, 'right')) },
    { label: t('table.alignNone'), action: op((tb) => setAlign(tb, col, 'none')) },
  ]
}

/** 표 밖에서 선택 영역이 CSV/TSV처럼 보이면 변환 메뉴 */
function selectionMenu(view: EditorView): MenuItem[] | null {
  const r = view.state.selection.main
  if (r.empty || view.state.readOnly) return null
  const text = view.state.sliceDoc(r.from, r.to)
  if (!text.includes('\n') || !/[,\t]/.test(text)) return null
  const convert = (table: Table | null) => () => {
    if (!table) return
    view.dispatch({ changes: { from: r.from, to: r.to, insert: '' } })
    insertTable(view, table)
  }
  return [
    { label: t('table.fromCsv'), action: convert(csvToTable(text)) },
    { label: t('table.fromTsv'), action: text.includes('\t') ? convert(tsvToTable(text)) : undefined },
  ]
}

// ── 붙여넣기: Excel/Google Sheets(TSV) · 웹 페이지 표(HTML) → Markdown 표 ──

function htmlToTable(html: string): Table | null {
  if (!/<table[\s>]/i.test(html)) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = doc.querySelectorAll('table')
  if (tables.length !== 1) return null
  const el = tables[0]
  // 표 외에 다른 내용이 많으면(문단 + 표 복사) 일반 붙여넣기
  const total = doc.body.textContent?.trim().length ?? 0
  const inTable = el.textContent?.trim().length ?? 0
  if (total && inTable / total < 0.9) return null
  const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).flatMap((cell) => {
      const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
      const span = Number(cell.getAttribute('colspan')) || 1
      return [text, ...Array<string>(span - 1).fill('')]
    }),
  )
  return rows.length ? rowsToTable(rows.filter((r) => r.length)) : null
}

/** Ctrl+Shift+V(서식 없이 붙여넣기)는 변환하지 않음 */
let plainPaste = false

const pasteHandler = EditorView.domEventHandlers({
  keydown(e) {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
      plainPaste = true
      setTimeout(() => (plainPaste = false), 500)
    }
    return false
  },
  paste(e, view) {
    if (view.state.readOnly || plainPaste || !e.clipboardData) return false
    if (locateTable(view.state)) return false // 표 안에서는 일반 붙여넣기
    const text = e.clipboardData.getData('text/plain')
    const table = tsvToTable(text) ?? htmlToTable(e.clipboardData.getData('text/html'))
    if (!table) return false
    e.preventDefault()
    insertTable(view, table)
    notify(t('table.pasted'))
    return true
  },
  contextmenu(e, view) {
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
    if (pos === null) return false
    const r = view.state.selection.main
    // 선택 영역 밖을 우클릭하면 커서를 그 위치로
    if (pos < r.from || pos > r.to) view.dispatch({ selection: { anchor: pos } })
    const loc = locateTable(view.state, pos)
    const items = loc ? tableMenu(view, loc) : selectionMenu(view)
    if (!items) return false
    e.preventDefault()
    showMenu(e.clientX, e.clientY, items)
    return true
  },
})

export function tableExtension() {
  return [
    Prec.high(
      keymap.of([
        { key: 'Tab', run: nextCell, shift: prevCell },
        { key: 'Enter', run: nextRow },
      ]),
    ),
    pasteHandler,
  ]
}
