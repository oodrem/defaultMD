<script lang="ts">
  // 열린 문서가 없을 때의 첫 화면: 새 파일 · 열기 · 최근 파일 · 기본 앱 안내
  import { onMount } from 'svelte'
  import { appState, notify } from '../app/ui.svelte'
  import { newDoc, openDocs } from '../app/workspace.svelte'
  import { t } from '../i18n/index.svelte'
  import type { Platform, RecentEntry } from '../platform'

  let { platform, paneId }: { platform: Platform; paneId: number } = $props()

  let recent = $state<RecentEntry[]>([])
  onMount(async () => (recent = await platform.listRecent()))

  async function open() {
    openDocs(await platform.openFiles(), paneId)
  }

  async function openRecent(entry: RecentEntry) {
    const data = await platform.openRecent(entry)
    if (data) openDocs([data], paneId)
    else notify(t('recent.missing'))
  }
</script>

<div class="welcome">
  <div class="inner">
    <h1>defaultMD</h1>
    <p class="sub">{t('welcome.subtitle')}</p>
    <div class="actions">
      <button class="primary" onclick={() => newDoc()}>{t('file.new')} <kbd>Ctrl+N</kbd></button>
      <button onclick={open}>{t('file.open')} <kbd>Ctrl+O</kbd></button>
    </div>
    <p class="hint">{t('welcome.drop')}</p>

    {#if recent.length}
      <h2>{t('welcome.recent')}</h2>
      <ul>
        {#each recent as entry, i (i)}
          <li><button class="link" onclick={() => openRecent(entry)}>{entry.name}</button></li>
        {/each}
      </ul>
    {/if}

    {#if platform.kind === 'web'}
      <button class="link small" onclick={() => (appState.guideOpen = true)}>{t('welcome.defaultApp')} →</button>
    {/if}
  </div>
</div>

<style>
  .welcome {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 24px;
    overflow: auto;
  }
  .inner {
    width: min(360px, 100%);
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
  }
  .sub {
    margin: 4px 0 20px;
    color: var(--fg-muted);
  }
  .actions {
    display: flex;
    justify-content: center;
    gap: 8px;
  }
  button {
    font: inherit;
    padding: 6px 14px;
    color: var(--fg);
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }
  button:hover {
    background: var(--bg-hover);
  }
  .primary {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }
  .primary:hover {
    background: var(--accent);
    filter: brightness(1.08);
  }
  kbd {
    margin-left: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    opacity: 0.75;
  }
  .hint {
    margin: 12px 0 0;
    font-size: 12px;
    color: var(--fg-muted);
  }
  h2 {
    margin: 28px 0 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-muted);
    text-align: left;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    text-align: left;
    border-top: 1px solid var(--border);
  }
  li {
    border-bottom: 1px solid var(--border);
  }
  .link {
    width: 100%;
    padding: 6px 4px;
    text-align: left;
    color: var(--accent);
    background: transparent;
    border: 0;
    border-radius: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .link:hover {
    background: var(--bg-hover);
  }
  .small {
    width: auto;
    margin-top: 24px;
    font-size: 13px;
  }
</style>
