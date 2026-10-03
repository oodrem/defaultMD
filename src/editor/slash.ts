// 슬래시 명령: 줄 처음(또는 공백 뒤)에서 "/"를 입력하면 Markdown 요소 삽입 목록
import { snippet, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { i18n } from '../i18n/index.svelte'

interface Item {
  names: string[]
  ko: string
  en: string
  /** CodeMirror snippet 문법: ${이름} = 입력 칸(Tab으로 이동), ${} = 마지막 커서 */
  template: string
  /** 블록 요소: 윗줄에 내용이 있으면 빈 줄을 하나 띄움 */
  block?: boolean
}

const ITEMS: Item[] = [
  { names: ['h1', '제목1'], ko: '제목 1', en: 'Heading 1', template: '# ${}' },
  { names: ['h2', '제목2'], ko: '제목 2', en: 'Heading 2', template: '## ${}' },
  { names: ['h3', '제목3'], ko: '제목 3', en: 'Heading 3', template: '### ${}' },
  {
    names: ['table', '표'],
    ko: '표 (3열)',
    en: 'Table (3 columns)',
    template: '| ${제목1} | ${제목2} | ${제목3} |\n| --- | --- | --- |\n| ${} |  |  |',
    block: true,
  },
  { names: ['code', '코드'], ko: '코드 블록', en: 'Code block', template: '```${lang}\n${}\n```', block: true },
  { names: ['todo', '할일'], ko: '체크리스트', en: 'Checklist', template: '- [ ] ${}' },
  { names: ['ul', '목록'], ko: '글머리 목록', en: 'Bullet list', template: '- ${}' },
  { names: ['ol', '번호'], ko: '번호 목록', en: 'Numbered list', template: '1. ${}' },
  { names: ['quote', '인용'], ko: '인용', en: 'Quote', template: '> ${}' },
  { names: ['link', '링크'], ko: '링크', en: 'Link', template: '[${텍스트}](${https://})' },
  { names: ['image', '이미지'], ko: '이미지', en: 'Image', template: '![${설명}](${image.png})' },
  { names: ['hr', '구분선'], ko: '구분선', en: 'Horizontal rule', template: '---\n${}', block: true },
  { names: ['math', '수식'], ko: '블록 수식 (KaTeX)', en: 'Math block (KaTeX)', template: '$$\n${}\n$$', block: true },
  {
    names: ['mermaid', '다이어그램'],
    ko: '다이어그램 (Mermaid)',
    en: 'Diagram (Mermaid)',
    template: '```mermaid\ngraph TD\n  A[${시작}] --> B[${끝}]\n```',
    block: true,
  },
  {
    names: ['pagebreak', '쪽나눔'],
    ko: '쪽 나누기 (PDF)',
    en: 'Page break (PDF)',
    template: '<!-- pagebreak -->\n${}',
    block: true,
  },
  { names: ['footnote', '각주'], ko: '각주', en: 'Footnote', template: '[^${1}]\n\n[^${1}]: ${}' },
  {
    names: ['details', '접기'],
    ko: '접기/펼치기',
    en: 'Collapsible section',
    template: '<details>\n<summary>${요약}</summary>\n\n${}\n\n</details>',
    block: true,
  },
]

/** 템플릿 입력 칸 이름의 영어 표기 (UI가 영어일 때) */
const PLACEHOLDER_EN: Record<string, string> = {
  제목1: 'Header1',
  제목2: 'Header2',
  제목3: 'Header3',
  텍스트: 'text',
  설명: 'description',
  시작: 'Start',
  끝: 'End',
  요약: 'Summary',
}

function localize(template: string): string {
  if (i18n.lang === 'ko') return template
  return template.replace(/\$\{([^}]+)\}/g, (m, name: string) => (PLACEHOLDER_EN[name] ? `\${${PLACEHOLDER_EN[name]}}` : m))
}

function apply(item: Item) {
  return (view: EditorView, completion: Completion, from: number, to: number) => {
    const doc = view.state.doc
    const line = doc.lineAt(from)
    const textBefore = line.text.slice(0, from - line.from).trim()
    const prevFilled = line.number > 1 && doc.line(line.number - 1).text.trim() !== ''
    // 표·코드 블록 등은 바로 위 문단/표와 붙으면 하나로 해석되므로 빈 줄을 띄움
    const lead = item.block && (prevFilled || textBefore) ? '\n' : ''
    snippet(lead + localize(item.template))(view, completion, from, to)
  }
}

export function slashSource(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos)
  const before = line.text.slice(0, ctx.pos - line.from)
  const m = /(^|\s)(\/[\p{L}\d]*)$/u.exec(before)
  if (!m) return null
  const ko = i18n.lang === 'ko'
  return {
    from: ctx.pos - m[2].length,
    options: ITEMS.flatMap((item) =>
      item.names.map(
        (name, i): Completion => ({
          label: '/' + name,
          detail: ko ? item.ko : item.en,
          // 영문 이름을 먼저, 한글 별칭은 뒤에
          boost: i === 0 ? 1 : 0,
          apply: apply(item),
        }),
      ),
    ),
    validFor: /^\/[\p{L}\d]*$/u,
  }
}
