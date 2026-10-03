<script module lang="ts">
  /** 서식 정리 안내를 이미 보여준 문서 */
  const noticed = new Set<number>()
</script>

<script lang="ts">
  // 미리보기-수정 모드 (Milkdown)
  import { onDestroy, onMount } from 'svelte'
  import { publishScroll, scrollSync, shouldFollow, type Doc, type Tab } from '../app/workspace.svelte'
  import { adapters } from '../editor/active'
  import { createWysiwyg, type WysiwygHandle } from '../editor/wysiwyg'
  import { t } from '../i18n/index.svelte'
  import type { Platform } from '../platform'

  let { doc, tab, platform, focused, syncId = tab.key }: { doc: Doc; tab: Tab; platform: Platform; focused: boolean; syncId?: number } = $props()

  let scroller: HTMLDivElement
  let root: HTMLDivElement
  let handle: WysiwygHandle | undefined
  let destroyed = false
  /** 편집기가 마지막으로 doc.text에 쓴 값 */
  let synced = ''
  let ignoreScrollUntil = 0

  // 서식 정리 안내: 문서마다 처음 편집할 때 한 번
  let notice = $state(false)
  let compat = $state<'ok' | 'whole' | 'readonly'>('ok')

  onMount(async () => {
    synced = doc.text
    const h = await createWysiwyg({
      root,
      markdown: doc.text,
      resolveImage: (src) => platform.resolveAsset(doc.handle, src),
      onChange(md) {
        if (md === doc.text) return
        synced = md
        doc.text = md
        if (!noticed.has(doc.id) && md !== doc.saved) {
          noticed.add(doc.id)
          notice = true
        }
      },
    })
    if (destroyed) return h.destroy()
    handle = h
    compat = h.compat
    // 편집을 막은 문서는 서식 툴바·삽입 대상에서 제외
    if (h.compat !== 'readonly') adapters.set(tab.key, h.adapter)
    applyExternal(doc.text)
    scrollToLine(tab.topLine)
    if (focused) h.adapter.focus()
  })

  onDestroy(() => {
    destroyed = true
    adapters.delete(tab.key)
    handle?.destroy()
  })

  function applyExternal(text: string) {
    if (!handle || text === synced) return
    synced = text
    handle.setMarkdown(text)
  }

  // 다른 영역에서 편집, 다시 불러오기 등
  $effect(() => applyExternal(doc.text))

  // ── 스크롤: 원문 줄 번호와 정확히 대응하지 않으므로 비율로 근사 ──
  const totalLines = () => Math.max(1, doc.text.split('\n').length - 1)

  function scrollToLine(line: number) {
    if (!scroller) return
    ignoreScrollUntil = performance.now() + 150
    scroller.scrollTop = (line / totalLines()) * (scroller.scrollHeight - scroller.clientHeight)
  }

  let raf = 0
  function onScroll() {
    if (performance.now() < ignoreScrollUntil) return
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const max = scroller.scrollHeight - scroller.clientHeight
      publishScroll(tab, max > 0 ? Math.round((scroller.scrollTop / max) * totalLines()) : 0, syncId)
    })
  }

  $effect(() => {
    void scrollSync.seq
    if (shouldFollow(tab, syncId)) scrollToLine(scrollSync.line)
  })
</script>

<div class="wrap">
  {#if compat === 'readonly'}
    <div class="notice warn">
      <span>{t('wysiwyg.readonly')}</span>
      <button onclick={() => (tab.view = 'raw')}>{t('wysiwyg.toRaw')}</button>
    </div>
  {:else if compat === 'whole'}
    <div class="notice warn"><span>{t('wysiwyg.whole')}</span></div>
  {/if}
  {#if notice}
    <div class="notice">
      <span>{t('wysiwyg.normalized')}</span>
      <button onclick={() => (notice = false)}>{t('wysiwyg.dismiss')}</button>
    </div>
  {/if}
  <div class="scroller" bind:this={scroller} onscroll={onScroll}>
    <div class="markdown-body wysiwyg" bind:this={root} title={t('wysiwyg.openLink')}></div>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 12px;
    font-size: 12px;
    color: var(--fg-muted);
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
  }
  .notice.warn {
    color: var(--fg);
    background: color-mix(in srgb, #d29922 18%, var(--bg));
  }
  .notice button {
    flex-shrink: 0;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 10px;
    cursor: pointer;
  }
  .scroller {
    flex: 1;
    min-height: 0;
    overflow: auto;
    user-select: text;
  }
  /* ProseMirror 필수 스타일 + 편집 표시 */
  .wysiwyg :global(.ProseMirror) {
    min-height: 60vh;
    outline: none;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-variant-ligatures: none;
  }
  .wysiwyg :global(.ProseMirror pre) {
    white-space: pre-wrap;
  }
  .wysiwyg :global(.ProseMirror-selectednode) {
    outline: 2px solid var(--accent);
  }
  .wysiwyg :global(.ProseMirror-gapcursor) {
    display: none;
    pointer-events: none;
    position: absolute;
  }
  .wysiwyg :global(.ProseMirror-focused .ProseMirror-gapcursor) {
    display: block;
  }
  .wysiwyg :global(.ProseMirror-gapcursor::after) {
    content: '';
    display: block;
    position: absolute;
    top: -2px;
    width: 20px;
    border-top: 1px solid var(--fg);
  }
  /* Milkdown은 목록 항목을 문단으로 감싸므로 간격을 미리보기와 맞춤 */
  .wysiwyg :global(li > p) {
    margin: 0;
  }
  /* 표: 선택된 칸 */
  .wysiwyg :global(.selectedCell) {
    background: color-mix(in srgb, var(--accent) 18%, transparent) !important;
  }
  .wysiwyg :global(td),
  .wysiwyg :global(th) {
    min-width: 3em;
    position: relative;
  }
  /* 체크리스트: Milkdown은 li[data-item-type=task]로 렌더 → 체크박스 그리기 */
  .wysiwyg :global(li[data-item-type='task']) {
    list-style: none;
    position: relative;
  }
  .wysiwyg :global(li[data-item-type='task'])::before {
    content: '';
    position: absolute;
    left: -1.5em;
    top: 0.35em;
    width: 0.95em;
    height: 0.95em;
    border: 1.5px solid var(--fg-muted);
    border-radius: 3px;
    cursor: pointer;
  }
  .wysiwyg :global(li[data-item-type='task'][data-checked='true'])::before {
    background: var(--accent);
    border-color: var(--accent);
  }
  .wysiwyg :global(li[data-item-type='task'][data-checked='true'])::after {
    content: '';
    position: absolute;
    left: -1.22em;
    top: 0.45em;
    width: 0.3em;
    height: 0.55em;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    pointer-events: none;
  }
</style>
