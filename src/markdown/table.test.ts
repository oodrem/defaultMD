import { describe, expect, it } from 'vitest'
import {
  cellAt,
  cellRange,
  createTable,
  csvToTable,
  deleteCol,
  formatTable,
  insertCol,
  insertRow,
  isSeparator,
  moveCol,
  moveRow,
  parseTable,
  setAlign,
  splitRow,
  strWidth,
  tsvToTable,
} from './table'

describe('strWidth', () => {
  it('한글·한자는 2칸, 영문은 1칸', () => {
    expect(strWidth('abc')).toBe(3)
    expect(strWidth('한글')).toBe(4)
    expect(strWidth('漢字a')).toBe(5)
  })
})

describe('해석', () => {
  it('splitRow: 앞뒤 파이프, 이스케이프', () => {
    expect(splitRow('| a | b\\|c |  d |')).toEqual(['a', 'b\\|c', 'd'])
    expect(splitRow('a | b')).toEqual(['a', 'b'])
  })

  it('isSeparator', () => {
    expect(isSeparator('|:---|:-:|--:|')).toBe(true)
    expect(isSeparator('--- | ---')).toBe(true)
    expect(isSeparator('| a | b |')).toBe(false)
  })

  it('parseTable: 정렬 + 부족한 셀 채움', () => {
    const t = parseTable(['| 이름 | 수량 | 가격 |', '|:--|:-:|--:|', '| 사과 | 3 |'])
    expect(t.aligns).toEqual(['left', 'center', 'right'])
    expect(t.rows).toEqual([
      ['이름', '수량', '가격'],
      ['사과', '3', ''],
    ])
  })
})

describe('formatTable', () => {
  it('한글 폭을 고려해 열 정렬', () => {
    const t = parseTable(['| 이름 | n |', '|---|--:|', '| 바나나 | 12 |', '| a | 3 |'])
    expect(formatTable(t)).toEqual([
      '| 이름   |   n |',
      '| ------ | --: |',
      '| 바나나 |  12 |',
      '| a      |   3 |',
    ])
  })

  it('가운데 정렬', () => {
    const t = setAlign(createTable(2, 1, () => 'h'), 0, 'center')
    t.rows[1][0] = 'x'
    expect(formatTable(t)).toEqual(['|  h  |', '| :-: |', '|  x  |'])
  })

  it('해석 ⇄ 출력 왕복이 안정적', () => {
    const lines = formatTable(parseTable(['|a|bb|', '|:-|-:|', '|한글|1|']))
    expect(formatTable(parseTable(lines))).toEqual(lines)
  })
})

describe('커서 ⇄ 셀', () => {
  const line = '| 이름   |   n |'
  it('cellAt', () => {
    expect(cellAt(line, 0)).toBe(0)
    expect(cellAt(line, 3)).toBe(0)
    expect(cellAt(line, 11)).toBe(1)
    expect(cellAt('a | b', 4)).toBe(1)
  })
  it('cellRange: 내용 위치 (오른쪽 정렬 포함)', () => {
    expect(cellRange(line, 0)).toEqual([2, 4])
    expect(cellRange(line, 1)).toEqual([11, 12])
    expect(cellRange('|     |', 0)).toEqual([2, 2])
  })
})

describe('행/열 조작', () => {
  const base = createTable(3, 2, (i) => `h${i}`)
  it('insertRow / insertCol / deleteCol', () => {
    expect(insertRow(base, 1).rows.length).toBe(4)
    const c = insertCol(base, 1)
    expect(c.rows[0]).toEqual(['h0', '', 'h1'])
    expect(c.aligns.length).toBe(3)
    expect(deleteCol(c, 1).rows[0]).toEqual(['h0', 'h1'])
    expect(deleteCol(createTable(1, 1, () => 'x'), 0).rows[0]).toEqual(['x']) // 마지막 열은 유지
  })
  it('moveRow는 머리글을 건드리지 않음, moveCol은 정렬도 이동', () => {
    const t = { rows: [['h'], ['a'], ['b']], aligns: ['none' as const] }
    expect(moveRow(t, 2, 1).rows).toEqual([['h'], ['b'], ['a']])
    expect(moveRow(t, 1, 0)).toBe(t)
    const m = moveCol(setAlign(base, 0, 'right'), 0, 1)
    expect(m.rows[0]).toEqual(['h1', 'h0'])
    expect(m.aligns).toEqual(['none', 'right'])
  })
})

describe('붙여넣기 변환', () => {
  it('Excel TSV → 표 (따옴표 안 줄바꿈, 파이프 이스케이프)', () => {
    const t = tsvToTable('이름\t메모\r\n사과\t"빨강\n둥근"\r\n바나나\ta|b\r\n')
    expect(t?.rows).toEqual([
      ['이름', '메모'],
      ['사과', '빨강<br>둥근'],
      ['바나나', 'a\\|b'],
    ])
  })
  it('탭이 섞인 일반 텍스트는 변환하지 않음', () => {
    expect(tsvToTable('한 줄\t텍스트')).toBeNull()
    expect(tsvToTable('a\tb\nc')).toBeNull()
  })
  it('CSV', () => {
    expect(csvToTable('a,"b,c"\n1,2')?.rows).toEqual([
      ['a', 'b,c'],
      ['1', '2'],
    ])
  })
})
