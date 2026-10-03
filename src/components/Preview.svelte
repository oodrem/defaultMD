<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { publishScroll, scrollSync, shouldFollow, type Doc, type Tab } from '../app/workspace.svelte'
  import { t } from '../i18n/index.svelte'
  import { currentDiagramTheme, enhance, renderDiagrams } from '../markdown/enhance'
  import { renderMarkdown } from '../markdown/render'
  import { renderState } from '../markdown/renderState.svelte'
  import { themeState } from '../theme/theme.svelte'
  import type { Platform } from '../platform'

  let { doc, tab, platform, syncId = tab.key }: { doc: Doc; tab: Tab; platform: Platform; syncId?: number } = $props()

  let scroller: HTMLElement
  let el: HTMLElement
  /** 렌더할 원문 — 다른 영역에서 타이핑 중이면 잠시 모아서 갱신 (debounce) */
  let source = $state(untrack(() => doc.text))
  // renderState.version: 수식 기능이 로드되면 다시 렌더
  let html = $derived((void renderState.version, renderMarkdown(source)))
  let ignoreScrollUntil = 0

  $effect(() => {
    const text = doc.text
    if (text === source) return
    const timer = setTimeout(() => (source = text), 150)
    return () => clearTimeout(timer)
  })
  let needAccess = $state(false)
  let denied = $state(false)

  $effect(() => {
    void html
    tick().then(postProcess)
  })

  onMount(() => tick().then(() => scrollToLine(tab.topLine)))

  // 같은 문서를 보는 다른 영역의 스크롤 따라가기
  $effect(() => {
    void scrollSync.seq
    if (shouldFollow(tab, syncId)) scrollToLine(scrollSync.line)
  })

  async function postProcess() {
    if (!el) return
    await resolveImages()
    await enhance(el)
  }

  // 테마가 바뀌면 다이어그램 색도 다시
  $effect(() => {
    void themeState.theme
    if (el) renderDiagrams(el, currentDiagramTheme())
  })

  async function resolveImages() {
    const imgs = Array.from(el.querySelectorAll<HTMLImageElement>('img[data-md-src]'))
    let missing = false
    await Promise.all(
      imgs.map(async (img) => {
        const url = await platform.resolveAsset(doc.handle, img.dataset.mdSrc!)
        if (url) img.src = url
        else missing = true
      }),
    )
    needAccess = missing && !!doc.handle
  }

  async function allow() {
    denied = !(await platform.requestAssetAccess(doc.handle))
    if (!denied) await resolveImages()
  }

  // ── 스크롤 위치 ⇄ 원문 줄 번호 (data-line) ──
  function lineElements() {
    return Array.from(el.querySelectorAll<HTMLElement>('[data-line]'))
  }

  function scrollToLine(line: number) {
    if (!scroller || !el) return // 이미 닫힌 탭
    ignoreScrollUntil = performance.now() + 150
    if (!line) {
      scroller.scrollTop = 0
      return
    }
    let target: HTMLElement | undefined
    for (const e of lineElements()) {
      if (Number(e.dataset.line) > line) break
      target = e
    }
    if (target) scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  }

  let raf = 0
  function onScroll() {
    if (performance.now() < ignoreScrollUntil) return
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const top = scroller.getBoundingClientRect().top
      const first = lineElements().find((e) => e.getBoundingClientRect().bottom > top)
      publishScroll(tab, first ? Number(first.dataset.line) : 0, syncId)
    })
  }

  // 문서 내 링크: 외부 링크는 새 창, 그 외(상대경로 .md 등)는 이후 단계에서 처리
  function onClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      e.preventDefault()
      const id = decodeURIComponent(href.slice(1))
      el.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth' })
    } else if (a.target !== '_blank') {
      e.preventDefault()
    }
  }
</script>

<div class="scroller" bind:this={scroller} onscroll={onScroll}>
  {#if needAccess}
    <div class="banner">
      <span>{denied ? t('img.denied') : t('img.needAccess')}</span>
      <button onclick={allow}>{t('img.allow')}</button>
    </div>
  {/if}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <article class="markdown-body" bind:this={el} onclick={onClick}>
    {@html html}
  </article>
</div>

<style>
  .scroller {
    height: 100%;
    overflow: auto;
    user-select: text;
  }
  .banner {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: 13px;
  }
  .banner button {
    font: inherit;
    color: #fff;
    background: var(--accent);
    border: 0;
    border-radius: 4px;
    padding: 3px 10px;
    cursor: pointer;
  }
</style>
