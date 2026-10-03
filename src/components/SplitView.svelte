<script lang="ts">
  // 나란히 보기: 한 탭 안에서 왼쪽 Raw(편집기) + 오른쪽 미리보기. 스크롤은 항상 서로 따라감
  import { ws, type Doc, type Tab } from '../app/workspace.svelte'
  import type { Platform } from '../platform'
  import Preview from './Preview.svelte'

  let {
    doc,
    tab,
    platform,
    focused,
    loadRawEditor,
  }: {
    doc: Doc
    tab: Tab
    platform: Platform
    focused: boolean
    loadRawEditor: () => Promise<typeof import('./RawEditor.svelte')>
  } = $props()

  let box: HTMLDivElement
  const clamp = (v: number) => Math.min(0.85, Math.max(0.15, v))
  let ratio = $derived(ws.sizes.inner ?? 0.5)

  function startDrag(e: PointerEvent) {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const rect = box.getBoundingClientRect()
    const move = (ev: PointerEvent) => (ws.sizes.inner = clamp((ev.clientX - rect.left) / rect.width))
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }
</script>

<div class="sbs" bind:this={box} style:grid-template-columns="{ratio}fr 4px {1 - ratio}fr">
  <div class="side">
    {#await loadRawEditor() then m}
      <m.default {doc} {tab} {focused} syncId={tab.key} />
    {/await}
  </div>
  <div
    class="divider"
    role="separator"
    aria-orientation="vertical"
    onpointerdown={startDrag}
    ondblclick={() => (ws.sizes.inner = 0.5)}
  ></div>
  <div class="side">
    <Preview {doc} {tab} {platform} syncId={-tab.key} />
  </div>
</div>

<style>
  .sbs {
    display: grid;
    height: 100%;
    min-height: 0;
  }
  .side {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  /* 반쪽 화면에서는 미리보기 여백을 줄임 */
  .side :global(.markdown-body) {
    padding: 16px 20px 48px;
  }
  .divider {
    background: var(--border);
    cursor: col-resize;
    touch-action: none;
  }
  .divider:hover,
  .divider:active {
    background: var(--accent);
  }
</style>
