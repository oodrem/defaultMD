import { describe, expect, it } from 'vitest'
import { minimalChange } from './diff'

const apply = (a: string, c: ReturnType<typeof minimalChange>) =>
  c ? a.slice(0, c.from) + c.insert + a.slice(c.to) : a

describe('minimalChange', () => {
  const cases: [string, string][] = [
    ['abc', 'abc'],
    ['abc', 'abXc'],
    ['abc', 'ac'],
    ['', '# 제목'],
    ['# 제목\n본문', ''],
    ['aaaa', 'aaa'],
    ['한글 문서', '한글 표 문서'],
    ['x\ny\nz', 'x\nY\nz'],
  ]
  for (const [a, b] of cases) {
    it(`${JSON.stringify(a)} → ${JSON.stringify(b)}`, () => {
      expect(apply(a, minimalChange(a, b))).toBe(b)
    })
  }

  it('삽입만 있을 때 범위가 최소', () => {
    expect(minimalChange('hello world', 'hello big world')).toEqual({ from: 6, to: 6, insert: 'big ' })
  })
})
