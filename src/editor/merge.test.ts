import { describe, expect, it } from 'vitest'
import { mergeBlocks, sourceBlocks, tidyBlock } from './merge'

// 편집기 직렬화를 흉내: 목록 기호를 '-'로, 표 공백을 다르게 바꿈
const serialize = (block: string) => block.replace(/^\* /gm, '- ').replace(/ \| /g, '|')

const ORIGINAL = [
  '# 제목',
  '',
  '* 항목 1',
  '* 항목 2',
  '1. 첫째',
  '',
  '',
  '| 이름 | 수량 |',
  '|:--|--:|',
  '| 사과 | 3 |',
  '',
  '문단입니다.',
  '',
  '[^1]: 각주',
  '',
].join('\n')

function blocksOf(md: string) {
  const src = sourceBlocks(md)
  return src.ranges.map(([s, e]) => serialize(src.lines.slice(s, e).join('\n')))
}

describe('sourceBlocks', () => {
  it('최상위 블록 범위 (목록 종류가 바뀌면 다른 블록, 각주 정의는 문단)', () => {
    const src = sourceBlocks(ORIGINAL)
    expect(src.ranges.map(([s, e]) => src.lines.slice(s, e).join('\n'))).toEqual([
      '# 제목',
      '* 항목 1\n* 항목 2',
      '1. 첫째',
      '| 이름 | 수량 |\n|:--|--:|\n| 사과 | 3 |',
      '문단입니다.',
      '[^1]: 각주',
    ])
  })
})

describe('mergeBlocks', () => {
  const src = sourceBlocks(ORIGINAL)
  const baseline = blocksOf(ORIGINAL)

  it('바뀐 것이 없으면 원문 그대로', () => {
    expect(mergeBlocks(src, baseline, [...baseline])).toBe(ORIGINAL)
  })

  it('한 블록만 바뀌면 그 블록만 교체, 나머지·공백은 원문 유지', () => {
    const current = [...baseline]
    current[4] = '문단을 고쳤습니다.'
    const out = mergeBlocks(src, baseline, current)!
    expect(out).toBe(ORIGINAL.replace('문단입니다.', '문단을 고쳤습니다.'))
  })

  it('블록 추가/삭제', () => {
    const added = [...baseline.slice(0, 1), '새 문단', ...baseline.slice(1)]
    expect(mergeBlocks(src, baseline, added)!.startsWith('# 제목\n\n새 문단\n\n* 항목 1\n* 항목 2\n1. 첫째')).toBe(true)
    const removed = baseline.filter((_, i) => i !== 2) // "1. 첫째" 삭제
    // 사이 블록이 사라지면 앞뒤 블록이 붙지 않도록 빈 줄 하나
    expect(mergeBlocks(src, baseline, removed)).toBe(ORIGINAL.replace('1. 첫째\n\n\n', '\n'))
  })

  it('바뀐 표는 한글 폭으로 다시 정렬', () => {
    const current = [...baseline]
    current[3] = '| 이름|수량 |\n| :-- | --: |\n| 바나나|12 |'
    const out = mergeBlocks(src, baseline, current)!
    expect(out).toContain('| 이름   | 수량 |\n| :----- | ---: |\n| 바나나 |   12 |')
  })

  it('블록 수가 맞지 않으면 null (전체 직렬화로 대체)', () => {
    expect(mergeBlocks(src, baseline.slice(1), baseline)).toBeNull()
  })
})

describe('tidyBlock', () => {
  it('표가 아니면 그대로', () => {
    expect(tidyBlock('a | b')).toBe('a | b')
  })
})
