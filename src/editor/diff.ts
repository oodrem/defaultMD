/** 두 문자열의 최소 변경 범위 (공통 접두/접미 제외). 다른 분할 영역의 편집을 반영할 때 커서 유지용 */
export function minimalChange(a: string, b: string): { from: number; to: number; insert: string } | null {
  if (a === b) return null
  const max = Math.min(a.length, b.length)
  let start = 0
  while (start < max && a.charCodeAt(start) === b.charCodeAt(start)) start++
  let end = 0
  while (end < max - start && a.charCodeAt(a.length - 1 - end) === b.charCodeAt(b.length - 1 - end)) end++
  return { from: start, to: a.length - end, insert: b.slice(start, b.length - end) }
}
