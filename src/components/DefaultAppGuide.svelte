<script lang="ts">
  // .md 기본 앱 지정 안내 (설치 → Windows 기본 앱 → 첫 실행 허용)
  import { appState } from '../app/ui.svelte'
  import { t } from '../i18n/index.svelte'
  import type { Platform } from '../platform'

  let { platform }: { platform: Platform } = $props()

  const close = () => (appState.guideOpen = false)

  async function install() {
    if (await platform.promptInstall()) appState.installable = false
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }
</script>

<svelte:window onkeydowncapture={onKeydown} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label={t('guide.title')}>
    <h2>{t('guide.title')}</h2>
    <ol>
      <li class:done={appState.installed}>
        <strong>{t('guide.step1')}</strong>
        {#if appState.installed}
          <p>✓ {t('guide.step1.done')}</p>
        {:else}
          <p>{t('guide.step1.manual')}</p>
          {#if appState.installable}
            <button class="primary" onclick={install}>{t('guide.step1.button')}</button>
          {/if}
        {/if}
      </li>
      <li>
        <strong>{t('guide.step2')}</strong>
        <p>{t('guide.step2.desc')}</p>
        <!-- Windows 설정 앱의 '기본 앱' 화면 (Edge가 열기 확인을 물음) -->
        <a class="button" href="ms-settings:defaultapps">{t('guide.step2.button')}</a>
      </li>
      <li>
        <strong>{t('guide.step3')}</strong>
        <p>{t('guide.step3.desc')}</p>
      </li>
    </ol>
    <p class="note">{t('guide.note')}</p>
    <footer><button onclick={close}>{t('guide.close')}</button></footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.35);
  }
  .dialog {
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    padding: 20px 24px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.25);
    user-select: text;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 17px;
  }
  ol {
    margin: 0;
    padding-left: 1.4em;
  }
  li {
    margin-bottom: 14px;
  }
  li.done strong {
    color: var(--fg-muted);
  }
  p {
    margin: 4px 0 8px;
    line-height: 1.55;
    color: var(--fg-muted);
  }
  .note {
    font-size: 12px;
  }
  footer {
    display: flex;
    justify-content: flex-end;
  }
  button,
  .button {
    display: inline-block;
    font: inherit;
    padding: 5px 14px;
    color: var(--fg);
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 4px;
    text-decoration: none;
    cursor: pointer;
  }
  button:hover,
  .button:hover {
    background: var(--bg-hover);
  }
  .primary,
  .button {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }
  .primary:hover,
  .button:hover {
    background: var(--accent);
    filter: brightness(1.08);
  }
</style>
