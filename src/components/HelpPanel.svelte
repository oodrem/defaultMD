<script lang="ts">
  // Markdown 문법 가이드 (F1). 항목을 누르면 현재 문서의 커서 위치에 삽입
  import { HELP, SHORTCUTS, type HelpItem } from '../help/items'
  import { ensureEditable } from '../editor/active'
  import { i18n, t } from '../i18n/index.svelte'
  import { renderMarkdown } from '../markdown/render'
  import { current } from '../app/workspace.svelte'

  let { onClose }: { onClose(): void } = $props()

  let lang = $derived(i18n.lang)
  let canInsert = $derived(!!current())

  async function insert(item: HelpItem) {
    // 보기 방식은 유지하고 수정 모드로 (Raw → CodeMirror, 미리보기 → 미리보기 편집)
    const editor = await ensureEditable()
    editor?.insertMarkdown(item.md[lang], !!item.block)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside class="panel" aria-label={t('help.title')} onkeydown={onKeydown}>
  <header>
    <strong>{t('help.title')}</strong>
    <button class="close" title="{t('help.close')} (Esc)" aria-label={t('help.close')} onclick={onClose}>×</button>
  </header>
  <div class="body">
    <p class="hint">{canInsert ? t('help.clickHint') : ''}</p>
    <p class="hint">{t('help.slash')}</p>

    {#each HELP as group (group.en)}
      <h3>{group[lang]}</h3>
      {#each group.items as item (item.en)}
        <button class="item" disabled={!canInsert} title={canInsert ? t('help.insert') : ''} onclick={() => insert(item)}>
          <span class="label">{item[lang]}</span>
          <code>{item.md[lang]}</code>
          <div class="result markdown-body">{@html renderMarkdown(item.md[lang])}</div>
        </button>
      {/each}
    {/each}

    <h3>{t('help.shortcuts')}</h3>
    <table class="keys">
      <tbody>
        {#each SHORTCUTS as [keys, desc] (keys)}
          <tr><td><kbd>{keys}</kbd></td><td>{desc[lang]}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: min(380px, 45vw);
    min-height: 0;
    background: var(--bg);
    border-left: 1px solid var(--border);
    user-select: text;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
  }
  .close {
    width: 26px;
    height: 26px;
    font-size: 18px;
    line-height: 1;
    color: var(--fg);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .close:hover {
    background: var(--bg-hover);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 12px 24px;
  }
  .hint {
    margin: 6px 0;
    font-size: 12px;
    color: var(--fg-muted);
  }
  h3 {
    margin: 18px 0 6px;
    font-size: 13px;
    color: var(--fg-muted);
  }
  .item {
    display: grid;
    gap: 4px;
    width: 100%;
    margin-bottom: 6px;
    padding: 8px 10px;
    font: inherit;
    text-align: left;
    color: var(--fg);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }
  .item:hover:not(:disabled) {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 5%, transparent);
  }
  .item:disabled {
    cursor: default;
  }
  .label {
    font-size: 12px;
    font-weight: 600;
  }
  code {
    display: block;
    padding: 4px 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: pre-wrap;
    background: var(--code-bg);
    border-radius: 4px;
    font-variant-ligatures: none;
  }
  /* 미리보기 결과: 본문 스타일을 작게 */
  .result {
    max-width: none;
    margin: 0;
    padding: 2px 0 0;
    font-size: 13px;
    line-height: 1.5;
    pointer-events: none;
  }
  .result :global(> *) {
    margin-bottom: 4px;
  }
  .result :global(h1),
  .result :global(h2),
  .result :global(h3) {
    margin: 0;
    padding: 0;
    border: 0;
  }
  .keys {
    width: 100%;
    font-size: 12px;
    border-collapse: collapse;
  }
  .keys td {
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .keys td:first-child {
    width: 46%;
    padding-right: 8px;
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
