// Markdown(GFM) 표 모델: 해석 · 정렬 출력 · 행/열 조작 · TSV/CSV 변환 (DOM·에디터 의존 없음)

export type Align = 'none' | 'left' | 'center' | 'right'

export interface Table {
  /** rows[0] = 머리글 행 */
  rows: string[][]
  aligns: Align[]
}

// ── 표시 폭: 한글·한자·전각 문자는 2칸 (고정폭 글꼴에서 열을 맞추기 위함) ──
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u
const ZERO = /[\p{M}​-‏️]/u

export function strWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ZERO.test(ch) ? 0 : WIDE.test(ch) ? 2 : 1
  return w
}

// ── 해석 ──

const SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

export function isSeparator(line: string): boolean {
  return line.includes('-') && SEPARATOR.test(line)
}

/** 한 행을 셀로 분리. `\|`는 셀 내용으로 유지 */
export function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '\\|'
      i++
    } else if (s[i] === '|') {
      cells.push(cur.trim())
      cur = ''
    } else cur += s[i]
  }
  cells.push(cur.trim())
  return cells
}

function parseAlign(cell: string): Align {
  const l = cell.startsWith(':')
  const r = cell.endsWith(':')
  return l && r ? 'center' : l ? 'left' : r ? 'right' : 'none'
}

/** lines[0] = 머리글, lines[1] = 구분선, 나머지 = 본문 */
export function parseTable(lines: string[]): Table {
  const aligns = splitRow(lines[1]).map(parseAlign)
  const rows = [lines[0], ...lines.slice(2)].map(splitRow)
  const cols = Math.max(aligns.length, ...rows.map((r) => r.length))
  return normalize({ rows, aligns }, cols)
}

function normalize(t: Table, cols: number): Table {
  return {
    rows: t.rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? '')),
    aligns: Array.from({ length: cols }, (_, i) => t.aligns[i] ?? 'none'),
  }
}

export const colCount = (t: Table) => t.aligns.length

// ── 출력 (열 너비 맞춤) ──

function pad(text: string, width: number, align: Align): string {
  const gap = width - strWidth(text)
  if (gap <= 0) return text
  if (align === 'right') return ' '.repeat(gap) + text
  if (align === 'center') return ' '.repeat(gap >> 1) + text + ' '.repeat(gap - (gap >> 1))
  return text + ' '.repeat(gap)
}

function separatorCell(width: number, align: Align): string {
  switch (align) {
    case 'left':
      return ':' + '-'.repeat(width - 1)
    case 'right':
      return '-'.repeat(width - 1) + ':'
    case 'center':
      return ':' + '-'.repeat(width - 2) + ':'
    default:
      return '-'.repeat(width)
  }
}

export function formatTable(t: Table): string[] {
  const widths = t.aligns.map((_, c) => Math.max(3, ...t.rows.map((r) => strWidth(r[c]))))
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`
  const row = (r: string[]) => line(r.map((cell, c) => pad(cell, widths[c], t.aligns[c])))
  return [row(t.rows[0]), line(t.aligns.map((a, c) => separatorCell(widths[c], a))), ...t.rows.slice(1).map(row)]
}

// ── 커서 ⇄ 셀 ──

/** 행 텍스트의 ch 위치가 몇 번째 셀인지 (0부터) */
export function cellAt(line: string, ch: number): number {
  const lead = line.trimStart().startsWith('|') ? 1 : 0
  let pipes = 0
  for (let i = 0; i < ch && i < line.length; i++) {
    if (line[i] === '\\') i++
    else if (line[i] === '|') pipes++
  }
  return Math.max(0, pipes - lead)
}

/** 정렬된 행에서 col번째 셀 내용의 [시작, 끝] 위치 (내용이 없으면 시작 = 끝) */
export function cellRange(line: string, col: number): [number, number] {
  const bounds: number[] = []
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') i++
    else if (line[i] === '|') bounds.push(i)
  }
  const start = (bounds[col] ?? line.length) + 1
  const end = bounds[col + 1] ?? line.length
  const cell = line.slice(start, end)
  const lead = cell.length - cell.trimStart().length
  const text = cell.trim()
  const s = start + (text ? lead : Math.min(1, cell.length))
  return [s, s + text.length]
}

// ── 만들기 · 조작 (모두 새 객체 반환) ──

export function createTable(rows: number, cols: number, header: (i: number) => string): Table {
  return {
    rows: [
      Array.from({ length: cols }, (_, i) => header(i)),
      ...Array.from({ length: Math.max(0, rows - 1) }, () => Array<string>(cols).fill('')),
    ],
    aligns: Array<Align>(cols).fill('none'),
  }
}

const clone = (t: Table): Table => ({ rows: t.rows.map((r) => [...r]), aligns: [...t.aligns] })

/** at: 새 행이 들어갈 행 인덱스 (1 이상 = 본문) */
export function insertRow(t: Table, at: number): Table {
  const n = clone(t)
  n.rows.splice(Math.max(1, Math.min(at, n.rows.length)), 0, Array<string>(colCount(t)).fill(''))
  return n
}

export function deleteRow(t: Table, at: number): Table {
  if (at < 1 || at >= t.rows.length) return t
  const n = clone(t)
  n.rows.splice(at, 1)
  return n
}

export function insertCol(t: Table, at: number): Table {
  const n = clone(t)
  const i = Math.max(0, Math.min(at, colCount(t)))
  n.rows.forEach((r) => r.splice(i, 0, ''))
  n.aligns.splice(i, 0, 'none')
  return n
}

export function deleteCol(t: Table, at: number): Table {
  if (colCount(t) <= 1) return t
  const n = clone(t)
  n.rows.forEach((r) => r.splice(at, 1))
  n.aligns.splice(at, 1)
  return n
}

export function moveRow(t: Table, from: number, to: number): Table {
  if (from < 1 || to < 1 || from >= t.rows.length || to >= t.rows.length) return t
  const n = clone(t)
  n.rows.splice(to, 0, ...n.rows.splice(from, 1))
  return n
}

export function moveCol(t: Table, from: number, to: number): Table {
  const cols = colCount(t)
  if (from < 0 || to < 0 || from >= cols || to >= cols) return t
  const n = clone(t)
  n.rows.forEach((r) => r.splice(to, 0, ...r.splice(from, 1)))
  n.aligns.splice(to, 0, ...n.aligns.splice(from, 1))
  return n
}

export function setAlign(t: Table, col: number, align: Align): Table {
  const n = clone(t)
  n.aligns[col] = align
  return n
}

// ── TSV(Excel·Google Sheets 복사) / CSV ──

/** 따옴표 처리를 포함한 구분자 텍스트 해석 */
export function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  rows.push(row)
  return rows
}

/** 셀 텍스트를 표 안에 안전하게: | 이스케이프, 줄바꿈 → <br> */
const cellText = (s: string) => s.trim().replace(/\|/g, '\\|').replace(/\n/g, '<br>')

export function rowsToTable(rows: string[][]): Table | null {
  const cols = Math.max(...rows.map((r) => r.length))
  if (!rows.length || cols < 1) return null
  return normalize({ rows: rows.map((r) => r.map(cellText)), aligns: [] }, cols)
}

/** 붙여넣은 텍스트가 스프레드시트에서 복사한 표(TSV)로 보이면 표로 변환 */
export function tsvToTable(text: string): Table | null {
  if (!text.includes('\t')) return null
  const rows = parseDelimited(text, '\t')
  // 2행 이상, 모든 행의 열 수가 같고 2열 이상일 때만 (일반 텍스트 오인 방지)
  if (rows.length < 2 || rows[0].length < 2 || rows.some((r) => r.length !== rows[0].length)) return null
  return rowsToTable(rows)
}

export function csvToTable(text: string): Table | null {
  const rows = parseDelimited(text, ',')
  return rows.length && rows[0].length ? rowsToTable(rows) : null
}
