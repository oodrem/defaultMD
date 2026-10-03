<script lang="ts">
  import { hideMenu, menu } from '../app/ui.svelte'

  let box = $state<HTMLDivElement>()
  let pos = $state({ x: 0, y: 0 })

  // 화면 밖으로 나가지 않게 위치 보정
  $effect(() => {
    const m = menu.current
    if (!m || !box) return
    const r = box.getBoundingClientRect()
    pos = {
      x: Math.min(m.x, window.innerWidth - r.width - 4),
      y: Math.min(m.y, window.innerHeight - r.height - 4),
    }
  })

  function onKeydown(e: KeyboardEvent) {
    if (menu.current && e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      hideMenu()
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (menu.current && box && !box.contains(e.target as Node)) hideMenu()
  }
</script>

<svelte:window onkeydowncapture={onKeydown} onpointerdowncapture={onPointerDown} onblur={hideMenu} onresize={hideMenu} />

{#if menu.current}
  <div class="menu" role="menu" bind:this={box} style:left="{pos.x}px" style:top="{pos.y}px">
    {#each menu.current.items as item, i (i)}
      {#if item.separator}<div class="sep"></div>{/if}
      <button
        role="menuitem"
        disabled={item.disabled || !item.action}
        onclick={() => {
          hideMenu()
          item.action?.()
        }}>{item.label}</button
      >
    {/each}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 90;
    min-width: 180px;
    max-width: 420px;
    max-height: 70vh;
    overflow-y: auto;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.2);
  }
  button {
    display: block;
    width: 100%;
    padding: 5px 12px;
    font: inherit;
    text-align: left;
    color: var(--fg);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  button:disabled {
    color: var(--fg-muted);
    cursor: default;
  }
  .sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--border);
  }
</style>
