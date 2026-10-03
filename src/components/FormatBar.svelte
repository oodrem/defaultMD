<script lang="ts">
  // 서식 툴바 (수정 모드). Raw·미리보기 편집 모두 EditorAdapter로 동작
  import { showMenu } from '../app/ui.svelte'
  import { activeAdapter, type EditorAdapter, type LineKind } from '../editor/active'
  import { t } from '../i18n/index.svelte'

  let { onHelp }: { onHelp(): void } = $props()

  const run = (fn: (a: EditorAdapter) => unknown) => () => {
    const a = activeAdapter()
    if (a) fn(a)
  }
  let hasTableEditor = $derived(!!activeAdapter()?.tableEditor)

  function headingMenu(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const item = (kind: LineKind, label: string) => ({ label, action: run((a) => a.line(kind)) })
    showMenu(r.left, r.bottom + 2, [
      ...[1, 2, 3, 4, 5, 6].map((n) => item(`h${n}` as LineKind, `${'#'.repeat(n)}  ${t('fmt.heading')} ${n}`)),
      { ...item('p', t('fmt.paragraph')), separator: true },
    ])
  }

  // ── 표 칸 선택기 ──
  const MAX_R = 8
  const MAX_C = 8
  let picker = $state(false)
  let hover = $state({ r: 3, c: 3 })
  let pickerEl = $state<HTMLDivElement>()

  function pick(rows: number, cols: number) {
    picker = false
    activeAdapter()?.insertTable(rows, cols)
  }

  function onWindowPointer(e: PointerEvent) {
    if (picker && pickerEl && !pickerEl.contains(e.target as Node)) picker = false
  }

  // 아이콘: 16×16, stroke
  const ICON = {
    link: 'M6.5 9.5l3-3M5.2 8.3 3.6 9.9a2.2 2.2 0 0 0 3.1 3.1l1.6-1.6M10.8 7.7l1.6-1.6a2.2 2.2 0 0 0-3.1-3.1L7.7 4.6',
    image: 'M2.5 3.5h11v9h-11zM2.5 11l3.5-3.5 3 3 2-2 2.5 2.5M10.5 6.2h.01',
    quote: 'M3.5 3.5v9M6.5 5h7M6.5 8h7M6.5 11h5',
    ul: 'M6.5 4h7M6.5 8h7M6.5 12h7M3 4h.01M3 8h.01M3 12h.01',
    ol: 'M7 4h6.5M7 8h6.5M7 12h6.5M2.5 3h1v3M2.3 9.5h1.9l-1.9 2.5h1.9',
    task: 'M2.5 3.5h4v4h-4zM3.3 5.6l.9.9 1.6-1.9M8.5 5.5h5M2.5 10h4v3.5h-4zM8.5 11.8h5',
    code: 'M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4',
    inline: 'M6 5 3.5 8 6 11M10 5l2.5 3L10 11',
    hr: 'M2 8h12',
    table: 'M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6.2 3.5v9M9.8 3.5v9',
    help: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM6.3 6.2a1.8 1.8 0 0 1 3.5.6c0 1.2-1.8 1.5-1.8 2.7M8 11.5h.01',
  }
</script>

<svelte:window onpointerdowncapture={onWindowPointer} />

<div class="bar" role="toolbar" aria-label={t('help.title')}>
  <button class="txt" title={t('fmt.heading')} onclick={headingMenu}>H▾</button>
  <span class="sep"></span>
  <button class="txt b" title="{t('fmt.bold')} (Ctrl+B)" onclick={run((a) => a.wrap('bold'))}>B</button>
  <button class="txt i" title="{t('fmt.italic')} (Ctrl+I)" onclick={run((a) => a.wrap('italic'))}>I</button>
  <button class="txt s" title="{t('fmt.strike')} (Ctrl+Shift+X)" onclick={run((a) => a.wrap('strike'))}>S</button>
  <button title={t('fmt.code') + ' (Ctrl+`)'} aria-label={t('fmt.code')} onclick={run((a) => a.wrap('code'))}>
    <svg viewBox="0 0 16 16"><path d={ICON.inline} /></svg>
  </button>
  <span class="sep"></span>
  <button title="{t('fmt.link')} (Ctrl+K)" aria-label={t('fmt.link')} onclick={run((a) => a.link())}>
    <svg viewBox="0 0 16 16"><path d={ICON.link} /></svg>
  </button>
  <button title={t('fmt.image')} aria-label={t('fmt.image')} onclick={run((a) => a.image())}>
    <svg viewBox="0 0 16 16"><path d={ICON.image} /></svg>
  </button>
  <span class="sep"></span>
  <button title={t('fmt.quote')} aria-label={t('fmt.quote')} onclick={run((a) => a.line('quote'))}>
    <svg viewBox="0 0 16 16"><path d={ICON.quote} /></svg>
  </button>
  <button title={t('fmt.ul')} aria-label={t('fmt.ul')} onclick={run((a) => a.line('ul'))}>
    <svg viewBox="0 0 16 16"><path d={ICON.ul} /></svg>
  </button>
  <button title={t('fmt.ol')} aria-label={t('fmt.ol')} onclick={run((a) => a.line('ol'))}>
    <svg viewBox="0 0 16 16"><path d={ICON.ol} /></svg>
  </button>
  <button title={t('fmt.task')} aria-label={t('fmt.task')} onclick={run((a) => a.line('task'))}>
    <svg viewBox="0 0 16 16"><path d={ICON.task} /></svg>
  </button>
  <span class="sep"></span>
  <button title={t('fmt.codeBlock')} aria-label={t('fmt.codeBlock')} onclick={run((a) => a.codeBlock())}>
    <svg viewBox="0 0 16 16"><path d={ICON.code} /></svg>
  </button>
  <button title={t('fmt.hr')} aria-label={t('fmt.hr')} onclick={run((a) => a.hr())}>
    <svg viewBox="0 0 16 16"><path d={ICON.hr} /></svg>
  </button>

  <div class="picker-wrap" bind:this={pickerEl}>
    <button
      class="table-btn"
      class:on={picker}
      title={t('fmt.table')}
      aria-label={t('fmt.table')}
      aria-expanded={picker}
      onclick={() => (picker = !picker)}
    >
      <svg viewBox="0 0 16 16"><path d={ICON.table} /></svg><span>{t('fmt.table')} ▾</span>
    </button>
    {#if picker}
      <div class="picker">
        <div class="grid" role="grid" style:grid-template-columns="repeat({MAX_C}, 18px)">
          {#each { length: MAX_R } as _, r (r)}
            {#each { length: MAX_C } as _, c (c)}
              <button
                class="cell"
                class:sel={r < hover.r && c < hover.c}
                aria-label={t('table.pick', { rows: String(r + 1), cols: String(c + 1) })}
                onpointerenter={() => (hover = { r: r + 1, c: c + 1 })}
                onclick={() => pick(r + 1, c + 1)}
              ></button>
            {/each}
          {/each}
        </div>
        <div class="size">{t('table.pick', { rows: String(hover.r), cols: String(hover.c) })}</div>
        {#if hasTableEditor}
          <button
            class="more"
            onclick={() => {
              picker = false
              activeAdapter()?.tableEditor?.()
            }}>{t('table.editorNew')}</button
          >
        {/if}
      </div>
    {/if}
  </div>

  <span class="spacer"></span>
  <button title="{t('help.open')} (F1)" aria-label={t('help.open')} onclick={onHelp}>
    <svg viewBox="0 0 16 16"><path d={ICON.help} /></svg>
  </button>
</div>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 3px 8px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  .sep {
    width: 1px;
    height: 16px;
    margin: 0 5px;
    background: var(--border);
  }
  .spacer {
    flex: 1;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 26px;
    height: 26px;
    justify-content: center;
    padding: 0 5px;
    font: inherit;
    color: var(--fg);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover,
  button.on {
    background: var(--bg-hover);
    border-color: var(--border);
  }
  .txt {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 15px;
  }
  .b {
    font-weight: 700;
  }
  .i {
    font-style: italic;
  }
  .s {
    text-decoration: line-through;
  }
  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .picker-wrap {
    position: relative;
  }
  .table-btn span {
    font-size: 13px;
  }
  .picker {
    position: absolute;
    z-index: 50;
    top: calc(100% + 4px);
    left: 0;
    padding: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.2);
  }
  .grid {
    display: grid;
    gap: 3px;
  }
  .cell {
    min-width: 0;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 2px;
  }
  .cell.sel {
    background: color-mix(in srgb, var(--accent) 35%, transparent);
    border-color: var(--accent);
  }
  .size {
    margin: 8px 0 6px;
    text-align: center;
    font-size: 12px;
    color: var(--fg-muted);
  }
  .more {
    width: 100%;
    height: auto;
    padding: 4px 8px;
    font-size: 13px;
    border-color: var(--border);
  }
</style>
