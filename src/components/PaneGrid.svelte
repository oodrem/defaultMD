<script lang="ts">
  import { ws } from '../app/workspace.svelte'
  import type { Platform } from '../platform'
  import Pane from './Pane.svelte'

  let { platform }: { platform: Platform } = $props()

  const GAP = '4px'
  const clamp = (v: number) => Math.min(0.85, Math.max(0.15, v))

  let grid: HTMLDivElement

  // 레이아웃별 격자: 분할선도 격자 칸(2번째 행/열)을 차지
  let cols = $derived(
    ws.layout === '2v' || ws.layout === '3' || ws.layout === '4'
      ? `${ws.sizes.col}fr ${GAP} ${1 - ws.sizes.col}fr`
      : '1fr',
  )
  let rows = $derived(
    ws.layout === '2h' || ws.layout === '3' || ws.layout === '4'
      ? `${ws.sizes.row}fr ${GAP} ${1 - ws.sizes.row}fr`
      : '1fr',
  )

  /** 영역 i의 grid-area (행 시작 / 열 시작 / 행 끝 / 열 끝) */
  function area(i: number): string {
    switch (ws.layout) {
      case '1':
        return '1 / 1 / 2 / 2'
      case '2v':
        return ['1 / 1 / 2 / 2', '1 / 3 / 2 / 4'][i]
      case '2h':
        return ['1 / 1 / 2 / 2', '3 / 1 / 4 / 2'][i]
      case '3':
        return ['1 / 1 / 4 / 2', '1 / 3 / 2 / 4', '3 / 3 / 4 / 4'][i]
      case '4':
        return ['1 / 1 / 2 / 2', '1 / 3 / 2 / 4', '3 / 1 / 4 / 2', '3 / 3 / 4 / 4'][i]
    }
  }

  let hasCol = $derived(ws.layout === '2v' || ws.layout === '3' || ws.layout === '4')
  let hasRow = $derived(ws.layout === '2h' || ws.layout === '3' || ws.layout === '4')
  // 3분할의 가로선은 오른쪽 열에만, 4분할은 十자로 가로지름
  let rowArea = $derived(ws.layout === '3' ? '2 / 3 / 3 / 4' : '2 / 1 / 3 / 4')

  function startDrag(e: PointerEvent, axis: 'col' | 'row') {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const rect = grid.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      if (axis === 'col') ws.sizes.col = clamp((ev.clientX - rect.left) / rect.width)
      else ws.sizes.row = clamp((ev.clientY - rect.top) / rect.height)
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }
</script>

<div class="grid" bind:this={grid} style:grid-template-columns={cols} style:grid-template-rows={rows}>
  {#each ws.panes as pane, i (pane.id)}
    <div class="cell" style:grid-area={area(i)}>
      <Pane {pane} {platform} />
    </div>
  {/each}

  {#if hasCol}
    <div
      class="splitter col"
      role="separator"
      aria-orientation="vertical"
      style:grid-area="1 / 2 / 4 / 3"
      onpointerdown={(e) => startDrag(e, 'col')}
      ondblclick={() => (ws.sizes.col = 0.5)}
    ></div>
  {/if}
  {#if hasRow}
    <div
      class="splitter row"
      role="separator"
      aria-orientation="horizontal"
      style:grid-area={rowArea}
      onpointerdown={(e) => startDrag(e, 'row')}
      ondblclick={() => (ws.sizes.row = 0.5)}
    ></div>
  {/if}
</div>

<style>
  .grid {
    display: grid;
    height: 100%;
    min-height: 0;
    background: var(--border);
  }
  .cell {
    display: flex;
    min-width: 0;
    min-height: 0;
  }
  .cell > :global(*) {
    flex: 1;
  }
  .splitter {
    z-index: 2;
    background: var(--border);
    touch-action: none;
  }
  .splitter:hover,
  .splitter:active {
    background: var(--accent);
  }
  .splitter.col {
    cursor: col-resize;
  }
  .splitter.row {
    cursor: row-resize;
  }
</style>
