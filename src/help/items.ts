// Markdown 문법 가이드 항목 (한/영)

export interface HelpItem {
  ko: string
  en: string
  md: { ko: string; en: string }
  /** 블록 요소: 앞뒤를 빈 줄로 띄워 삽입 */
  block?: boolean
}

export interface HelpGroup {
  ko: string
  en: string
  items: HelpItem[]
}

const same = (s: string) => ({ ko: s, en: s })

export const HELP: HelpGroup[] = [
  {
    ko: '제목',
    en: 'Headings',
    items: [
      { ko: '제목 1', en: 'Heading 1', md: { ko: '# 제목 1', en: '# Heading 1' }, block: true },
      { ko: '제목 2', en: 'Heading 2', md: { ko: '## 제목 2', en: '## Heading 2' }, block: true },
      { ko: '제목 3', en: 'Heading 3', md: { ko: '### 제목 3', en: '### Heading 3' }, block: true },
    ],
  },
  {
    ko: '글자 강조',
    en: 'Emphasis',
    items: [
      { ko: '굵게', en: 'Bold', md: { ko: '**굵게**', en: '**bold**' } },
      { ko: '기울임', en: 'Italic', md: { ko: '*기울임*', en: '*italic*' } },
      { ko: '취소선', en: 'Strikethrough', md: { ko: '~~취소선~~', en: '~~strikethrough~~' } },
      { ko: '굵은 기울임', en: 'Bold italic', md: { ko: '***굵은 기울임***', en: '***bold italic***' } },
      { ko: '인라인 코드', en: 'Inline code', md: same('`code`') },
      { ko: '키보드 키', en: 'Keyboard key', md: same('<kbd>Ctrl</kbd>+<kbd>S</kbd>') },
    ],
  },
  {
    ko: '목록',
    en: 'Lists',
    items: [
      { ko: '글머리 목록', en: 'Bullet list', md: { ko: '- 항목\n- 항목\n  - 하위 항목', en: '- item\n- item\n  - sub item' }, block: true },
      { ko: '번호 목록', en: 'Numbered list', md: { ko: '1. 첫째\n2. 둘째', en: '1. first\n2. second' }, block: true },
      { ko: '체크리스트', en: 'Checklist', md: { ko: '- [x] 완료\n- [ ] 할 일', en: '- [x] done\n- [ ] to do' }, block: true },
    ],
  },
  {
    ko: '링크 · 이미지',
    en: 'Links & images',
    items: [
      { ko: '링크', en: 'Link', md: { ko: '[링크 텍스트](https://example.com)', en: '[link text](https://example.com)' } },
      { ko: '자동 링크', en: 'Autolink', md: same('https://example.com') },
      { ko: '이미지', en: 'Image', md: { ko: '![설명](image.png)', en: '![description](image.png)' } },
      { ko: '문서 안 이동', en: 'Jump to heading', md: { ko: '[표로 이동](#표)', en: '[go to tables](#tables)' } },
    ],
  },
  {
    ko: '표',
    en: 'Tables',
    items: [
      {
        ko: '표 (정렬: 왼쪽·가운데·오른쪽)',
        en: 'Table (left / center / right)',
        md: {
          ko: '| 이름 | 수량 | 가격 |\n| :--- | :---: | ---: |\n| 사과 | 3 | 1,500 |',
          en: '| Name | Qty | Price |\n| :--- | :---: | ---: |\n| Apple | 3 | 1.50 |',
        },
        block: true,
      },
    ],
  },
  {
    ko: '블록',
    en: 'Blocks',
    items: [
      { ko: '인용', en: 'Quote', md: { ko: '> 인용문', en: '> quoted text' }, block: true },
      { ko: '코드 블록', en: 'Code block', md: same('```js\nconsole.log("hello")\n```'), block: true },
      { ko: '구분선', en: 'Horizontal rule', md: same('---'), block: true },
      {
        ko: '접기/펼치기',
        en: 'Collapsible',
        md: { ko: '<details>\n<summary>요약</summary>\n\n숨겨진 내용\n\n</details>', en: '<details>\n<summary>Summary</summary>\n\nHidden content\n\n</details>' },
        block: true,
      },
    ],
  },
  {
    ko: '수식 · 다이어그램',
    en: 'Math & diagrams',
    items: [
      { ko: '인라인 수식', en: 'Inline math', md: same('$E = mc^2$') },
      {
        ko: '블록 수식',
        en: 'Block math',
        md: same('$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$'),
        block: true,
      },
      {
        ko: '다이어그램 (Mermaid)',
        en: 'Diagram (Mermaid)',
        md: {
          ko: '```mermaid\ngraph LR\n  A[시작] --> B{조건}\n  B -->|예| C[처리]\n  B -->|아니오| D[끝]\n```',
          en: '```mermaid\ngraph LR\n  A[Start] --> B{Check}\n  B -->|yes| C[Run]\n  B -->|no| D[End]\n```',
        },
        block: true,
      },
      { ko: '쪽 나누기 (PDF)', en: 'Page break (PDF)', md: same('<!-- pagebreak -->'), block: true },
    ],
  },
  {
    ko: '기타',
    en: 'Other',
    items: [
      { ko: '각주', en: 'Footnote', md: { ko: '본문[^1]\n\n[^1]: 각주 내용', en: 'Text[^1]\n\n[^1]: Footnote text' }, block: true },
      { ko: '줄바꿈 (줄 끝 공백 2개 또는 \\)', en: 'Line break (two spaces or \\ at end)', md: { ko: '첫 줄\\\n둘째 줄', en: 'first line\\\nsecond line' }, block: true },
      { ko: '기호 그대로 쓰기', en: 'Escape characters', md: same('\\*별표\\* \\# \\|') },
    ],
  },
]

export const SHORTCUTS: [string, { ko: string; en: string }][] = [
  ['Ctrl+N / O / S', { ko: '새 파일 / 열기 / 저장', en: 'New / Open / Save' }],
  ['Ctrl+P', { ko: 'PDF로 저장 (인쇄)', en: 'Save as PDF (print)' }],
  ['Ctrl+Shift+S', { ko: '다른 이름으로 저장', en: 'Save as' }],
  ['Ctrl+W', { ko: '탭 닫기', en: 'Close tab' }],
  ['Ctrl+E', { ko: '읽기 ⇄ 수정', en: 'Read ⇄ Edit' }],
  ['Ctrl+/', { ko: 'Raw ⇄ 미리보기', en: 'Raw ⇄ Preview' }],
  ['Ctrl+Shift+/', { ko: 'Raw·미리보기 나란히 보기', en: 'Raw and preview side by side' }],
  ['Ctrl+\\', { ko: '옆 화면에서 열기', en: 'Open to the side' }],
  ['Ctrl+Tab · Ctrl+1~9', { ko: '탭 전환', en: 'Switch tabs' }],
  ['F6', { ko: '분할 화면 이동', en: 'Next pane' }],
  ['Ctrl+B / I / K', { ko: '굵게 / 기울임 / 링크', en: 'Bold / Italic / Link' }],
  ['Ctrl+Shift+X · Ctrl+`', { ko: '취소선 · 인라인 코드', en: 'Strikethrough · Inline code' }],
  ['Ctrl+F', { ko: '찾기 (Raw)', en: 'Find (Raw)' }],
  [
    'Tab · Shift+Tab · Enter',
    { ko: '표 안: 다음 칸 · 이전 칸 · 아래 칸 (자동 정렬)', en: 'In a table: next · previous · cell below (auto-format)' },
  ],
  ['F1', { ko: '이 가이드', en: 'This guide' }],
]
