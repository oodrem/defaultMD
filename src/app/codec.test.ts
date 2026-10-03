import { describe, expect, it } from 'vitest'
import { decode, encode } from './codec'

const bytes = (...n: number[]) => new Uint8Array(n)

describe('decode', () => {
  it('UTF-8 (BOM 없음, LF)', () => {
    const d = decode(new TextEncoder().encode('# 제목\n본문\n'))
    expect(d).toEqual({ text: '# 제목\n본문\n', encoding: 'utf-8', bom: false, eol: '\n' })
  })

  it('UTF-8 BOM + CRLF는 정규화하고 정보를 보존', () => {
    const d = decode(bytes(0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62))
    expect(d).toEqual({ text: 'a\nb', encoding: 'utf-8', bom: true, eol: '\r\n' })
  })

  it('EUC-KR 감지', () => {
    // "한글" in EUC-KR
    const d = decode(bytes(0xc7, 0xd1, 0xb1, 0xdb))
    expect(d.encoding).toBe('euc-kr')
    expect(d.text).toBe('한글')
  })

  it('UTF-16 LE BOM', () => {
    const d = decode(bytes(0xff, 0xfe, 0x61, 0x00, 0x5c, 0xd5))
    expect(d).toMatchObject({ text: 'a한', encoding: 'utf-16le', bom: true })
  })
})

describe('encode → decode 왕복', () => {
  const cases = [
    { encoding: 'utf-8', bom: false, eol: '\n' },
    { encoding: 'utf-8', bom: true, eol: '\r\n' },
    { encoding: 'utf-16le', bom: true, eol: '\r\n' },
    { encoding: 'utf-16be', bom: true, eol: '\n' },
  ] as const

  for (const info of cases) {
    it(`${info.encoding} bom=${info.bom} eol=${JSON.stringify(info.eol)}`, () => {
      const text = '# 한글 제목\n\n| a | b |\n|---|---|\n| 1 | 2 |\n'
      expect(decode(encode(text, info))).toEqual({ text, ...info })
    })
  }

  it('CRLF 저장 시 바이트에 \\r\\n 포함', () => {
    const out = encode('a\nb', { encoding: 'utf-8', bom: false, eol: '\r\n' })
    expect(Array.from(out)).toEqual([0x61, 0x0d, 0x0a, 0x62])
  })
})
