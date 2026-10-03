<script lang="ts">
  import { LAYOUTS, current, setLayout, splitRight, ws, type Layout } from '../app/workspace.svelte'
  import { t } from '../i18n/index.svelte'

  let {
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    onRecent,
    onPdf,
    onSettings,
  }: {
    onNew(): void
    onOpen(): void
    onSave(): void
    onSaveAs(): void
    onRecent(anchor: HTMLElement): void
    onPdf(): void
    onSettings(anchor: HTMLElement): void
  } = $props()

  let cur = $derived(current())

  // 레이아웃 아이콘 (16×16 사각형 분할)
  const ICONS: Record<Layout, string> = {
    '1': '',
    '2v': 'M8 2v12',
    '2h': 'M2 8h12',
    '3': 'M7 2v12M7 8h7',
    '4': 'M8 2v12M2 8h12',
  }
</script>

<header class="toolbar">
  <span class="brand">defaultMD</span>
  <button title="{t('file.new')} (Ctrl+N)" onclick={onNew}>{t('file.new')}</button>
  <span class="split">
    <button title="{t('file.open')} (Ctrl+O)" onclick={onOpen}>{t('file.open')}</button>
    <button
      class="more"
      title={t('recent.title')}
      aria-label={t('recent.title')}
      onclick={(e) => onRecent(e.currentTarget)}>▾</button
    >
  </span>
  <button title="{t('file.save')} (Ctrl+S)" onclick={onSave} disabled={!cur}>{t('file.save')}</button>
  <button title="{t('file.saveAs')} (Ctrl+Shift+S)" onclick={onSaveAs} disabled={!cur}>{t('file.saveAs')}</button>
  <button title="{t('pdf.hint')} (Ctrl+P)" onclick={onPdf} disabled={!cur}>PDF</button>

  {#if cur}
    {@const tab = cur.tab}
    <span class="sep"></span>
    <div class="seg" role="group">
      <button class:on={tab.view === 'raw'} title="{t('view.toggle')} (Ctrl+/)" onclick={() => (tab.view = 'raw')}
        >{t('view.raw')}</button
      >
      <button class:on={tab.view === 'split'} title="{t('view.splitHint')} (Ctrl+Shift+/)" onclick={() => (tab.view = 'split')}
        >{t('view.split')}</button
      >
      <button class:on={tab.view === 'preview'} title="{t('view.toggle')} (Ctrl+/)" onclick={() => (tab.view = 'preview')}
        >{t('view.preview')}</button
      >
    </div>
    <div class="seg" role="group" title="{t('mode.toggle')} (Ctrl+E)">
      <button class:on={!tab.edit} onclick={() => (tab.edit = false)}>{t('mode.read')}</button>
      <button class:on={tab.edit} onclick={() => (tab.edit = true)}>{t('mode.edit')}</button>
    </div>
  {/if}

  <span class="sep"></span>
  <div class="seg" role="group">
    {#each LAYOUTS as layout (layout)}
      <button
        class="icon"
        class:on={ws.layout === layout}
        title={t(`layout.${layout}`)}
        aria-label={t(`layout.${layout}`)}
        onclick={() => setLayout(layout)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          {#if ICONS[layout]}<path d={ICONS[layout]} />{/if}
        </svg>
      </button>
    {/each}
  </div>
  <button
    class="icon"
    title="{t('tab.splitRight')} (Ctrl+\)"
    aria-label={t('tab.splitRight')}
    onclick={() => splitRight()}
    disabled={!cur}
  >
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M8 2v12M10 8h3M11.5 6.5v3" />
    </svg>
  </button>
  {#if ws.panes.length > 1}
    <button class:on={ws.syncScroll} title={t('sync.scrollHint')} onclick={() => (ws.syncScroll = !ws.syncScroll)}
      >{t('sync.scroll')}</button
    >
  {/if}

  <span class="spacer"></span>
  <button
    class="icon"
    title={t('menu.settings')}
    aria-label={t('menu.settings')}
    onclick={(e) => onSettings(e.currentTarget)}
  >
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="3.5" cy="8" r="0.6" /><circle cx="8" cy="8" r="0.6" /><circle cx="12.5" cy="8" r="0.6" />
    </svg>
  </button>
</header>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-weight: 600;
    margin-right: 8px;
  }
  .spacer {
    flex: 1;
  }
  .sep {
    width: 1px;
    height: 18px;
    margin: 0 6px;
    background: var(--border);
  }
  button {
    font: inherit;
    color: var(--fg);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 10px;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button.on,
  button.on:hover:not(:disabled) {
    position: relative;
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }
  button.icon {
    display: inline-grid;
    place-items: center;
    padding: 2px 5px;
  }
  svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
  }
  .split {
    display: inline-flex;
  }
  .split button:first-child {
    border-radius: 4px 0 0 4px;
  }
  .split .more {
    margin-left: -1px;
    padding: 2px 5px;
    border-radius: 0 4px 4px 0;
    font-size: 10px;
  }
  .seg {
    display: inline-flex;
    margin-right: 4px;
  }
  .seg button {
    border-radius: 0;
  }
  .seg button + button {
    margin-left: -1px;
  }
  .seg button:first-child {
    border-radius: 4px 0 0 4px;
  }
  .seg button:last-child {
    border-radius: 0 4px 4px 0;
  }
</style>
