// 파일 바이트 ⇄ 텍스트 변환. 인코딩·BOM·줄바꿈을 감지해 두었다가 저장 시 되돌린다.

export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'euc-kr'
export type Eol = '\n' | '\r\n'

export interface TextInfo {
  encoding: Encoding
  bom: boolean
  eol: Eol
}

export interface Decoded extends TextInfo {
  /** 줄바꿈은 항상 \n으로 정규화 */
  text: string
}

export function decode(buf: ArrayBuffer | Uint8Array): Decoded {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let encoding: Encoding = 'utf-8'
  let bom = false
  let text: string

  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    bom = true
    text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(b.subarray(3))
  } else if (b[0] === 0xff && b[1] === 0xfe) {
    encoding = 'utf-16le'
    bom = true
    text = new TextDecoder('utf-16le', { ignoreBOM: true }).decode(b.subarray(2))
  } else if (b[0] === 0xfe && b[1] === 0xff) {
    encoding = 'utf-16be'
    bom = true
    text = new TextDecoder('utf-16be', { ignoreBOM: true }).decode(b.subarray(2))
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(b)
    } catch {
      // UTF-8이 아니면 한글 레거시 인코딩(CP949/EUC-KR)으로 간주
      encoding = 'euc-kr'
      text = new TextDecoder('euc-kr').decode(b)
    }
  }

  const crlf = text.match(/\r\n/g)?.length ?? 0
  const lf = (text.match(/\n/g)?.length ?? 0) - crlf
  return { text: text.replace(/\r\n?/g, '\n'), encoding, bom, eol: crlf > lf ? '\r\n' : '\n' }
}

/**
 * 텍스트를 원래 형식으로 인코딩. 브라우저에는 EUC-KR 인코더가 없으므로
 * EUC-KR 문서는 UTF-8로 저장된다 (호출 측에서 사용자에게 알림).
 */
export function encode(text: string, info: TextInfo): Uint8Array {
  const body = info.eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text

  if (info.encoding === 'utf-16le' || info.encoding === 'utf-16be') {
    const le = info.encoding === 'utf-16le'
    const out = new Uint8Array(2 + body.length * 2)
    const dv = new DataView(out.buffer)
    dv.setUint16(0, 0xfeff, le)
    for (let i = 0; i < body.length; i++) dv.setUint16(2 + i * 2, body.charCodeAt(i), le)
    return out
  }

  const utf8 = new TextEncoder().encode(body)
  if (!info.bom) return utf8
  const out = new Uint8Array(utf8.length + 3)
  out.set([0xef, 0xbb, 0xbf])
  out.set(utf8, 3)
  return out
}

export function encodingLabel(info: TextInfo): string {
  switch (info.encoding) {
    case 'utf-8':
      return info.bom ? 'UTF-8 BOM' : 'UTF-8'
    case 'utf-16le':
      return 'UTF-16 LE'
    case 'utf-16be':
      return 'UTF-16 BE'
    case 'euc-kr':
      return 'EUC-KR'
  }
}
