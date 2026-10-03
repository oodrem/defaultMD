<script lang="ts">
  import {
    activeTab,
    docById,
    ignoreExternal,
    moveTab,
    reloadDoc,
    ws,
    type Pane,
  } from '../app/workspace.svelte'
  import { t } from '../i18n/index.svelte'
  import type { Platform } from '../platform'
  import Preview from './Preview.svelte'
  import SplitView from './SplitView.svelte'
  import Welcome from './Welcome.svelte'
  import TabBar, { TAB_MIME, readTabDrag } from './TabBar.svelte'

  let { pane, platform }: { pane: Pane; platform: Platform } = $props()

  // 편집기는 처음 쓸 때 로드 (초기 기동 경량화): Raw = CodeMirror, 미리보기-수정 = Milkdown
  let rawEditor: Promise<typeof import('./RawEditor.svelte')> | undefined
  const loadRawEditor = () => (rawEditor ??= import('./RawEditor.svelte'))
  let wysiwygEditor: Promise<typeof import('./WysiwygEditor.svelte')> | undefined
  const loadWysiwyg = () => (wysiwygEditor ??= import('./WysiwygEditor.svelte'))

  let tab = $derived(activeTab(pane))
  let doc = $derived(tab && docById(tab.docId))
  let focused = $derived(ws.focused === pane.id)
  let tabOver = $state(false)

  // 본문 영역에 탭을 놓으면 이 영역 끝으로 이동
  function onDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes(TAB_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    tabOver = true
  }
  function onDrop(e: DragEvent) {
    tabOver = false
    const src = readTabDrag(e)
    if (!src) return
    e.preventDefault()
    moveTab(src.paneId, src.key, pane.id, pane.tabs.length)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  class="pane"
  class:focused
  class:multi={ws.panes.length > 1}
  data-pane={pane.id}
  onpointerdowncapture={() => (ws.focused = pane.id)}
  onfocusin={() => (ws.focused = pane.id)}
>
  {#if pane.tabs.length}
    <TabBar {pane} />
  {/if}

  <div
    class="body"
    ondragover={onDragOver}
    ondragleave={() => (tabOver = false)}
    ondrop={onDrop}
  >
    {#if tab && doc}
      {#if doc.external}
        <div class="banner warn">
          <span>{t('ext.changed')}</span>
          <button onclick={() => doc && reloadDoc(doc)}>{t('ext.reload')}</button>
          <button onclick={() => doc && ignoreExternal(doc)}>{t('ext.ignore')}</button>
        </div>
      {/if}
      <div class="content">
        {#key `${tab.key}:${tab.view}:${tab.view === 'preview' && tab.edit}`}
          {#if tab.view === 'raw'}
            {#await loadRawEditor() then m}
              <m.default {doc} {tab} {focused} />
            {/await}
          {:else if tab.view === 'split'}
            <SplitView {doc} {tab} {platform} {focused} {loadRawEditor} />
          {:else if tab.edit}
            {#await loadWysiwyg() then m}
              <m.default {doc} {tab} {platform} {focused} />
            {/await}
          {:else}
            <Preview {doc} {tab} {platform} />
          {/if}
        {/key}
      </div>
    {:else if ws.docs.length === 0 && ws.panes[0].id === pane.id}
      <Welcome {platform} paneId={pane.id} />
    {:else}
      <div class="empty">{t('app.empty')}</div>
    {/if}
    {#if tabOver}
      <div class="tab-drop">{t('pane.moveHere')}</div>
    {/if}
  </div>
</section>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }
  /* 여러 영역일 때 포커스된 영역 표시 */
  .pane.multi.focused {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .body {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }
  .content {
    flex: 1;
    min-height: 0;
  }
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    font-size: 13px;
    color: var(--fg-muted);
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
  }
  .banner.warn {
    color: var(--fg);
    background: color-mix(in srgb, #d29922 18%, var(--bg));
  }
  .banner button {
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 10px;
    cursor: pointer;
  }
  .empty {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 16px;
    text-align: center;
    color: var(--fg-muted);
  }
  .tab-drop {
    position: absolute;
    inset: 6px;
    display: grid;
    place-items: center;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 2px dashed var(--accent);
    border-radius: 6px;
    pointer-events: none;
  }
</style>
