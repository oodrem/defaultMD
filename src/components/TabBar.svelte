<script module lang="ts">
  /** 탭 드래그 데이터 형식: "영역id:탭key" */
  export const TAB_MIME = 'application/x-defaultmd-tab'

  export function readTabDrag(e: DragEvent): { paneId: number; key: number } | null {
    const [paneId, key] = (e.dataTransfer?.getData(TAB_MIME) ?? '').split(':').map(Number)
    return paneId && key ? { paneId, key } : null
  }
</script>

<script lang="ts">
  import { showMenu } from '../app/ui.svelte'
  import {
    closeTab,
    closeTabs,
    docById,
    isDirty,
    moveTab,
    splitRight,
    ws,
    type Pane,
  } from '../app/workspace.svelte'
  import { t } from '../i18n/index.svelte'

  let { pane }: { pane: Pane } = $props()

  let bar: HTMLDivElement
  let dropIndex = $state(-1)
  let focused = $derived(ws.focused === pane.id)

  // 활성 탭이 보이도록 스크롤
  $effect(() => {
    const key = pane.activeKey
    bar?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  function onDragStart(e: DragEvent, key: number) {
    e.dataTransfer?.setData(TAB_MIME, `${pane.id}:${key}`)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: DragEvent, index: number) {
    if (!e.dataTransfer?.types.includes(TAB_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dropIndex = e.clientX < r.left + r.width / 2 ? index : index + 1
  }

  /** 탭 줄의 빈 공간 = 맨 끝 */
  function onBarDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes(TAB_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (e.target === bar) dropIndex = pane.tabs.length
  }

  function onDrop(e: DragEvent) {
    const src = readTabDrag(e)
    if (!src || dropIndex < 0) return
    e.preventDefault()
    e.stopPropagation()
    moveTab(src.paneId, src.key, pane.id, dropIndex)
    dropIndex = -1
  }

  function onContextMenu(e: MouseEvent, key: number) {
    e.preventDefault()
    const i = pane.tabs.findIndex((x) => x.key === key)
    const keys = (list: typeof pane.tabs) => list.map((x) => x.key)
    const others = keys(pane.tabs.filter((x) => x.key !== key))
    const right = keys(pane.tabs.slice(i + 1))
    const saved = keys(pane.tabs.filter((x) => !isDirty(docById(x.docId)!)))
    showMenu(e.clientX, e.clientY, [
      { label: t('tab.splitRight'), action: () => splitRight(pane.id, key) },
      { label: t('tab.close'), action: () => closeTab(pane.id, key), separator: true },
      { label: t('tab.closeOthers'), action: others.length ? () => closeTabs(pane.id, others) : undefined },
      { label: t('tab.closeRight'), action: right.length ? () => closeTabs(pane.id, right) : undefined },
      { label: t('tab.closeSaved'), action: saved.length ? () => closeTabs(pane.id, saved) : undefined },
      { label: t('tab.closeAll'), action: () => closeTabs(pane.id, keys(pane.tabs)), separator: true },
    ])
  }

  // 세로 휠로 탭 목록 가로 스크롤
  function onWheel(e: WheelEvent) {
    if (!e.deltaX) bar.scrollLeft += e.deltaY
  }
</script>

<div
  class="tabs"
  class:focused
  role="tablist"
  tabindex="-1"
  bind:this={bar}
  onwheel={onWheel}
  ondragover={onBarDragOver}
  ondrop={onDrop}
  ondragleave={(e) => !bar.contains(e.relatedTarget as Node) && (dropIndex = -1)}
>
  {#each pane.tabs as tab, i (tab.key)}
    {@const doc = docById(tab.docId)}
    {#if doc}
      <div
        class="tab"
        class:active={tab.key === pane.activeKey}
        class:drop-before={dropIndex === i}
        class:drop-after={dropIndex === i + 1 && i === pane.tabs.length - 1}
        data-key={tab.key}
        role="tab"
        tabindex="0"
        aria-selected={tab.key === pane.activeKey}
        title={doc.name}
        draggable="true"
        ondragstart={(e) => onDragStart(e, tab.key)}
        ondragover={(e) => onDragOver(e, i)}
        ondrop={onDrop}
        ondragend={() => (dropIndex = -1)}
        onclick={() => (pane.activeKey = tab.key)}
        onkeydown={(e) => e.key === 'Enter' && (pane.activeKey = tab.key)}
        onauxclick={(e) => e.button === 1 && closeTab(pane.id, tab.key)}
        oncontextmenu={(e) => onContextMenu(e, tab.key)}
      >
        <span class="name">{doc.name}</span>
        <button
          class="close"
          class:dirty={isDirty(doc)}
          title={t('tab.close')}
          aria-label={t('tab.close')}
          onclick={(e) => {
            e.stopPropagation()
            closeTab(pane.id, tab.key)
          }}><span class="x">×</span><span class="dot">●</span></button
        >
      </div>
    {/if}
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    overflow-x: auto;
    scrollbar-width: thin;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    min-height: 32px;
  }
  .tab {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    max-width: 220px;
    padding: 0 6px 0 12px;
    border-right: 1px solid var(--border);
    color: var(--fg-muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .tab:hover {
    background: var(--bg-hover);
  }
  .tab.active {
    background: var(--bg);
    color: var(--fg);
    box-shadow: inset 0 2px 0 var(--border);
  }
  /* 포커스된 영역의 활성 탭만 강조색 */
  .focused .tab.active {
    box-shadow: inset 0 2px 0 var(--accent);
  }
  .tab.drop-before {
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .tab.drop-after {
    box-shadow: inset -3px 0 0 var(--accent);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .close {
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 15px;
    line-height: 1;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    visibility: hidden;
  }
  .tab:hover .close,
  .tab.active .close {
    visibility: visible;
  }
  .close:hover {
    background: var(--bg-hover);
  }
  /* 저장 안 된 탭: ● 표시, 마우스를 올리면 × */
  .dot {
    display: none;
    font-size: 10px;
  }
  .close.dirty {
    visibility: visible;
  }
  .close.dirty .dot {
    display: inline;
  }
  .close.dirty .x {
    display: none;
  }
  .close.dirty:hover .dot {
    display: none;
  }
  .close.dirty:hover .x {
    display: inline;
  }
</style>
