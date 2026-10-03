// 미리보기 편집 결과를 원문에 블록 단위로 합치기.
// 바뀐 블록(문단·표·목록 등)만 직렬화 결과로 바꾸고, 나머지 블록과 블록 사이 공백은 원문 그대로 둔다.
import MarkdownIt from 'markdown-it'
import { formatTable, isSeparator, parseTable } from '../markdown/table'

export interface SourceBlocks {
  lines: string[]
  /** 최상위 블록의 [시작 줄, 끝 줄) */
  ranges: [number, number][]
}

// 플러그인 없는 파서: 각주 정의도 일반 문단(최상위 블록 하나)으로 잡혀 편집기의 블록 구성과 맞는다
const parser = new MarkdownIt({ html: true })

const DEFINITION = /^ {0,3}\[[^\]]+\]:/

export function sourceBlocks(md: string): SourceBlocks {
  const lines = md.split('\n')
  const ranges: [number, number][] = []
  const covered = new Uint8Array(lines.length)
  for (const token of parser.parse(md, {})) {
    if (token.level !== 0 || !token.map || token.nesting === -1) continue
    let [s, e] = token.map
    while (e > s && !lines[e - 1].trim()) e-- // 목록 등은 뒤쪽 빈 줄까지 포함하므로 제외
    ranges.push([s, e])
    covered.fill(1, s, e)
  }
  // 토큰이 없는 내용 = 참조/각주 정의([^1]: …, [id]: url). 정의 하나를 블록 하나로
  for (let i = 0; i < lines.length; i++) {
    if (covered[i] || !lines[i].trim()) continue
    let e = i + 1
    while (e < lines.length && !covered[e] && lines[e].trim() && !DEFINITION.test(lines[e])) e++
    ranges.push([i, e])
    i = e - 1
  }
  ranges.sort((a, b) => a[0] - b[0])
  return { lines, ranges }
}

/** 최장 공통 부분열로 baseline[i] ↔ current[j] 짝 찾기 */
function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i++, j++])
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return pairs
}

/** 바뀐 표는 한글 폭을 고려해 다시 정렬 */
export function tidyBlock(block: string): string {
  const lines = block.split('\n')
  if (lines.length >= 2 && lines[0].includes('|') && isSeparator(lines[1])) {
    return formatTable(parseTable(lines)).join('\n')
  }
  return block
}

/**
 * @param src 원문 블록 정보
 * @param baseline 원문을 불러온 직후 편집기의 최상위 블록별 직렬화 결과
 * @param current 지금 편집기의 최상위 블록별 직렬화 결과
 * @returns 합친 Markdown. 원문 블록과 편집기 블록 수가 달라 대응시킬 수 없으면 null
 */
export function mergeBlocks(src: SourceBlocks, baseline: string[], current: string[]): string | null {
  if (src.ranges.length !== baseline.length) return null
  const { lines, ranges } = src
  const matchOf = new Map<number, number>() // current j → baseline i
  for (const [i, j] of lcsPairs(baseline, current)) matchOf.set(j, i)

  const out: string[] = ranges.length ? lines.slice(0, ranges[0][0]) : []
  let prev = -1 // 직전에 출력한 원문 블록 번호 (-1 = 없거나 새 블록)
  current.forEach((block, j) => {
    const i = matchOf.get(j)
    if (j > 0) {
      // 원문에서 연달아 있던 두 블록이면 원래 사이 공백, 아니면 빈 줄 하나
      if (i !== undefined && prev >= 0 && i === prev + 1) out.push(...lines.slice(ranges[prev][1], ranges[i][0]))
      else out.push('')
    }
    if (i !== undefined) out.push(...lines.slice(ranges[i][0], ranges[i][1]))
    else out.push(...tidyBlock(block.replace(/\n+$/, '')).split('\n'))
    prev = i ?? -1
  })
  const last = ranges.at(-1)
  out.push(...(last ? lines.slice(last[1]) : lines))
  return out.join('\n')
}
