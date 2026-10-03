// 미리보기-수정(WYSIWYG) 편집기: Milkdown(ProseMirror + remark). 미리보기에서 수정 모드일 때만 지연 로드된다.
//
// 원문 보존 정책: Markdown → 문서 트리 → Markdown 왕복 시 서식이 정리될 수 있으므로
//  - 사용자가 실제로 편집했을 때만 doc.text에 반영
//  - 블록 단위로 합침: 바뀐 블록만 직렬화 결과로, 나머지 블록·빈 줄은 원문 그대로 (merge.ts)
//  - 목록 기호·강조 기호 등은 원문에서 감지한 스타일로 직렬화
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/kit/core'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { history } from '@milkdown/kit/plugin/history'
import {
  commonmark,
  createCodeBlockCommand,
  imageSchema,
  insertHrCommand,
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark'
import { gfm, insertTableCommand, setAlignCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { Plugin, TextSelection } from '@milkdown/kit/prose/state'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
} from '@milkdown/kit/prose/tables'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose, $view, callCommand, insert, replaceAll } from '@milkdown/kit/utils'
import { askText, showMenu } from '../app/ui.svelte'
import { t } from '../i18n/index.svelte'
import type { EditorAdapter, LineKind } from './active'
import { mergeBlocks, sourceBlocks, type SourceBlocks } from './merge'

export interface WysiwygOptions {
  root: HTMLElement
  markdown: string
  /** 상대경로 이미지 → 표시용 URL */
  resolveImage(src: string): Promise<string | null>
  /** 사용자가 편집했을 때 (원문 보존 정책 적용 후의 Markdown) */
  onChange(markdown: string): void
}

export interface WysiwygHandle {
  adapter: EditorAdapter
  /** 밖에서 내용이 바뀐 경우 (다른 영역 편집, 다시 불러오기) */
  setMarkdown(markdown: string): void
  destroy(): void
  /** 'readonly' = 편집 시 내용 손실 위험(참조 링크 정의)으로 편집 막음, 'whole' = 블록 대응 불가로 편집 시 전체 서식이 바뀔 수 있음 */
  compat: 'ok' | 'whole' | 'readonly'
}

/** 참조 링크 정의 `[id]: url` (각주 `[^1]:` 제외) — 편집기가 보존하지 못함 */
const REF_DEFINITION = /^ {0,3}\[(?!\^)[^\]]+\]:\s*\S/m

/** 원문의 Markdown 작성 스타일 감지 → remark-stringify 옵션 */
export function styleFrom(md: string) {
  const bullet = (/^\s*([-*+])\s+(?!\[[ xX]\]\s*$)/m.exec(md)?.[1] ?? '-') as '-' | '*' | '+'
  const underscoreEm = /(^|[^\w_])_[^_\s][^_\n]*_(?![\w_])/m.test(md)
  const starEm = /(^|[^*])\*[^*\s][^*\n]*\*(?!\*)/m.test(md)
  const rule = (/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/m.exec(md)?.[1] ?? '-') as '-' | '*' | '_'
  return {
    bullet,
    emphasis: (underscoreEm && !starEm ? '_' : '*') as '_' | '*',
    strong: (/__[^_\n]+__/.test(md) && !/\*\*[^*\n]+\*\*/.test(md) ? '_' : '*') as '_' | '*',
    fence: (/^ {0,3}~~~/m.test(md) && !/^ {0,3}```/m.test(md) ? '~' : '`') as '~' | '`',
    rule,
    listItemIndent: 'one' as const,
  }
}

const INLINE_SRC = /^(https?:|data:|blob:)/i

export async function createWysiwyg(opts: WysiwygOptions): Promise<WysiwygHandle> {
  const readonly = REF_DEFINITION.test(opts.markdown)
  let original = opts.markdown
  let source: SourceBlocks = sourceBlocks(original)
  /** 불러온 직후 최상위 블록별 직렬화 결과 */
  let baseline: string[] = []
  let suppress = false
  let timer: ReturnType<typeof setTimeout> | undefined

  // 사용자 편집만 감지 (밖에서 넣은 내용은 suppress)
  const changeWatcher = $prose(
    () =>
      new Plugin({
        view: () => ({
          update(view, prev) {
            if (suppress || view.state.doc.eq(prev.doc)) return
            clearTimeout(timer)
            timer = setTimeout(emit, 120)
          },
        }),
      }),
  )

  // 상대경로 이미지는 플랫폼을 통해 해석 (PWA: 허용한 폴더)
  const imageView = $view(imageSchema.node, () => (node) => {
    const img = document.createElement('img')
    img.alt = node.attrs.alt ?? ''
    if (node.attrs.title) img.title = node.attrs.title
    const src: string = node.attrs.src ?? ''
    if (INLINE_SRC.test(src)) img.src = src
    else opts.resolveImage(src).then((url) => url && (img.src = url))
    return { dom: img, ignoreMutation: () => true }
  })

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, opts.root)
      ctx.set(defaultValueCtx, opts.markdown)
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({ ...prev, ...styleFrom(opts.markdown) }))
      if (readonly) ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, editable: () => false }))
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(clipboard)
    .use(changeWatcher)
    .use(imageView)
    .create()

  const view = () => editor.action((ctx) => ctx.get(editorViewCtx))

  /** 문서 전체 직렬화 (원문과 블록 대응이 안 될 때 사용) */
  const serializeAll = () =>
    editor.action((ctx) => {
      const md = ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc)
      // 원문 끝 줄바꿈 유무 맞춤
      return original.endsWith('\n') ? md.replace(/\n*$/, '\n') : md.replace(/\n+$/, '')
    })

  /** 최상위 블록별 직렬화 */
  const serializeBlocks = () =>
    editor.action((ctx) => {
      const serializer = ctx.get(serializerCtx)
      const doc = ctx.get(editorViewCtx).state.doc
      const out: string[] = []
      doc.forEach((node) => out.push(serializer(doc.type.create(null, node)).replace(/\n+$/, '')))
      return out
    })

  /** 현재 편집 내용을 원문에 합친 Markdown */
  const merged = () => mergeBlocks(source, baseline, serializeBlocks()) ?? serializeAll()
  baseline = serializeBlocks()

  function emit() {
    opts.onChange(merged())
  }

  const run = (fn: (ctx: Parameters<Parameters<typeof editor.action>[0]>[0]) => unknown) => {
    editor.action(fn)
    view().focus()
  }

  /** 커서가 있는 목록 항목을 체크리스트로 */
  function makeTask(v: EditorView) {
    const { $from } = v.state.selection
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d)
      if (node.type.name === 'list_item') {
        v.dispatch(v.state.tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, checked: false }))
        return
      }
    }
  }

  async function link() {
    const v = view()
    const { from, to } = v.state.selection
    const url = await askText(t('wysiwyg.linkUrl'), 'https://', t('dlg.ok'), t('dlg.cancel'))
    if (!url) return v.focus()
    if (from === to) run(insert(`[${url}](${url})`, true))
    else run(callCommand(toggleLinkCommand.key, { href: url }))
  }

  async function image() {
    const src = await askText(t('wysiwyg.imageSrc'), '', t('dlg.ok'), t('dlg.cancel'), 'image.png')
    if (!src) return view().focus()
    run(callCommand(insertImageCommand.key, { src, alt: '' }))
  }

  const adapter: EditorAdapter = {
    kind: 'wysiwyg',
    focus: () => view().focus(),
    wrap(kind) {
      const key = {
        bold: toggleStrongCommand.key,
        italic: toggleEmphasisCommand.key,
        strike: toggleStrikethroughCommand.key,
        code: toggleInlineCodeCommand.key,
      }[kind]
      run(callCommand(key))
    },
    line(kind: LineKind) {
      if (kind.startsWith('h')) run(callCommand(wrapInHeadingCommand.key, +kind[1]))
      else if (kind === 'p') run(callCommand(turnIntoTextCommand.key))
      else if (kind === 'quote') run(callCommand(wrapInBlockquoteCommand.key))
      else if (kind === 'ul') run(callCommand(wrapInBulletListCommand.key))
      else if (kind === 'ol') run(callCommand(wrapInOrderedListCommand.key))
      else if (kind === 'task') {
        run(callCommand(wrapInBulletListCommand.key))
        makeTask(view())
      }
    },
    link,
    image,
    codeBlock: () => run(callCommand(createCodeBlockCommand.key)),
    hr: () => run(callCommand(insertHrCommand.key)),
    insertTable: (rows, cols) => run(callCommand(insertTableCommand.key, { row: rows, col: cols })),
    insertMarkdown: (md, block) => run(insert(md, !block)),
  }

  // ── 표 우클릭 메뉴 · 체크박스 클릭 · Ctrl+클릭 링크 ──
  const root = opts.root

  function onContextMenu(e: MouseEvent) {
    const cell = (e.target as HTMLElement).closest('td, th')
    if (!cell) return
    e.preventDefault()
    const v = view()
    // 우클릭한 칸으로 커서 이동 (명령은 커서가 있는 칸 기준)
    const pos = v.posAtCoords({ left: e.clientX, top: e.clientY })
    if (pos) {
      const $pos = v.state.doc.resolve(pos.pos)
      if (!v.state.selection.$from.sameParent($pos)) v.dispatch(v.state.tr.setSelection(TextSelection.near($pos)))
    }
    const cmd = (fn: (state: EditorView['state'], dispatch: EditorView['dispatch']) => boolean) => () => {
      fn(v.state, v.dispatch)
      v.focus()
    }
    const align = (a: 'left' | 'center' | 'right') => () => run(callCommand(setAlignCommand.key, a))
    showMenu(e.clientX, e.clientY, [
      { label: t('table.rowAbove'), action: cmd(addRowBefore) },
      { label: t('table.rowBelow'), action: cmd(addRowAfter) },
      { label: t('table.rowDelete'), action: cmd(deleteRow) },
      { label: t('table.colLeft'), action: cmd(addColumnBefore), separator: true },
      { label: t('table.colRight'), action: cmd(addColumnAfter) },
      { label: t('table.colDelete'), action: cmd(deleteColumn) },
      { label: t('table.alignLeft'), action: align('left'), separator: true },
      { label: t('table.alignCenter'), action: align('center') },
      { label: t('table.alignRight'), action: align('right') },
    ])
  }

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    // 체크리스트: 항목 왼쪽(체크박스 영역) 클릭으로 토글
    const li = target.closest<HTMLElement>('li[data-item-type="task"]')
    if (li && e.clientX < li.getBoundingClientRect().left + 4) {
      const v = view()
      const pos = v.posAtDOM(li, 0) - 1
      const node = v.state.doc.nodeAt(pos)
      if (node?.type.name === 'list_item') {
        e.preventDefault()
        v.dispatch(v.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: !node.attrs.checked }))
      }
      return
    }
    const a = target.closest('a')
    if (a && (e.ctrlKey || e.metaKey)) {
      const href = a.getAttribute('href') ?? ''
      if (/^(https?:|mailto:)/i.test(href)) window.open(href, '_blank', 'noopener')
      e.preventDefault()
    }
  }

  root.addEventListener('contextmenu', onContextMenu)
  root.addEventListener('click', onClick)

  return {
    adapter,
    compat: readonly ? 'readonly' : source.ranges.length === baseline.length ? 'ok' : 'whole',
    setMarkdown(markdown) {
      // 같은 내용이거나 이 편집기가 보낸 결과가 되돌아온 경우는 무시
      if (markdown === original || markdown === merged()) return
      original = markdown
      source = sourceBlocks(markdown)
      suppress = true
      try {
        editor.action(replaceAll(markdown, true))
      } finally {
        suppress = false
      }
      baseline = serializeBlocks()
    },
    destroy() {
      clearTimeout(timer)
      root.removeEventListener('contextmenu', onContextMenu)
      root.removeEventListener('click', onClick)
      editor.destroy()
    },
  }
}
