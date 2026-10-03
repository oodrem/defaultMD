<script lang="ts">
  import { dialog } from '../app/ui.svelte'

  let box = $state<HTMLDivElement>()

  $effect(() => {
    if (!dialog.current) return
    const input = box?.querySelector<HTMLInputElement>('input.text')
    if (input) {
      input.focus()
      input.select()
    } else box?.querySelector<HTMLButtonElement>('button.primary')?.focus()
  })

  function onKeydown(e: KeyboardEvent) {
    if (!dialog.current) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      dialog.current.resolve('cancel')
    }
  }
</script>

<svelte:window onkeydowncapture={onKeydown} />

{#if dialog.current}
  {@const req = dialog.current}
  <div class="backdrop">
    <div class="box" role="alertdialog" aria-modal="true" aria-label={req.message} bind:this={box}>
      <p>{req.message}</p>
      {#if req.input}
        <input
          class="text"
          bind:value={req.input.value}
          placeholder={req.input.placeholder}
          onkeydown={(e) => e.key === 'Enter' && req.resolve(req.buttons.find((b) => b.primary)?.id ?? 'ok')}
        />
      {/if}
      {#if req.items}
        {@const all = req.items.every((it) => it.checked)}
        <label class="all">
          <input
            type="checkbox"
            checked={all}
            onchange={() => req.items!.forEach((it) => (it.checked = !all))}
          />
          {req.items.filter((it) => it.checked).length} / {req.items.length}
        </label>
        <div class="items">
          {#each req.items as item, i (i)}
            <label><input type="checkbox" bind:checked={item.checked} /> {item.label}</label>
          {/each}
        </div>
      {/if}
      <div class="buttons">
        {#each req.buttons as b (b.id)}
          <button class:primary={b.primary} onclick={() => req.resolve(b.id)}>{b.label}</button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.35);
  }
  .box {
    min-width: 320px;
    max-width: min(560px, calc(100vw - 32px));
    padding: 20px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.25);
  }
  p {
    margin: 0 0 20px;
    line-height: 1.5;
  }
  input.text {
    display: block;
    width: 100%;
    margin: -8px 0 18px;
    padding: 6px 8px;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  input.text:focus {
    outline: 2px solid color-mix(in srgb, var(--accent) 50%, transparent);
    border-color: var(--accent);
  }
  .all {
    display: block;
    margin: -8px 0 6px;
    font-size: 12px;
    color: var(--fg-muted);
  }
  .items {
    max-height: 50vh;
    overflow-y: auto;
    margin: 0 0 16px;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .items label {
    display: block;
    padding: 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  button {
    font: inherit;
    padding: 5px 14px;
    color: var(--fg);
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    background: var(--bg-hover);
  }
  button.primary {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }
</style>
