<script lang="ts">
  import { onMount } from 'svelte'
  import { encodingLabel } from './app/codec'
  import { tableDialog } from './app/tableDialog.svelte'
  import { appState, askList, dialog, notify, showMenu, status } from './app/ui.svelte'
  import {
    checkExternalChanges,
    closeTab,
    current,
    cyclePane,
    cycleTab,
    initWorkspace,
    isDirty,
    newDoc,
    openDocs,
    restoreSnapshot,
    saveDoc,
    selectTab,
    sessionSnapshot,
    setTabClosedHandler,
    splitRight,
    ws,
  } from './app/workspace.svelte'
  import Dialog from './components/Dialog.svelte'
  import Menu from './components/Menu.svelte'
  import PaneGrid from './components/PaneGrid.svelte'
  import Toolbar from './components/Toolbar.svelte'
  import { i18n, setLang, t } from './i18n/index.svelte'
  import { setTheme, themeState, type Theme } from './theme/theme.svelte'
  import type { DropResult, Platform } from './platform'

  let { platform }: { platform: Platform } = $props()

  let cur = $derived(current())
  let dragDepth = $state(0)
  let helpOpen = $state(false)

  // CodeMirror 의존 UI는 필요할 때 로드 (초기 기동 경량화)
  let formatBar: Promise<typeof import('./components/FormatBar.svelte')> | undefined
  const loadFormatBar = () => (formatBar ??= import('./components/FormatBar.svelte'))
  let tableEditor: Promise<typeof import('./components/TableEditor.svelte')> | undefined
  const loadTableEditor = () => (tableEditor ??= import('./components/TableEditor.svelte'))
  let helpPanel: Promise<typeof import('./components/HelpPanel.svelte')> | undefined
  const loadHelpPanel = () => (helpPanel ??= import('./components/HelpPanel.svelte'))
  let guide: Promise<typeof import('./components/DefaultAppGuide.svelte')> | undefined
  const loadGuide = () => (guide ??= import('./components/DefaultAppGuide.svelte'))

  /** 설정 및 도움말 메뉴 (⋯) */
  function showSettings(anchor: HTMLElement) {
    const r = anchor.getBoundingClientRect()
    // 선택된 항목에 ✓, 나머지는 같은 폭의 공백(em space)으로 들여쓰기
    const check = (on: boolean, label: string) => `${on ? '✓' : ' '} ${label}`
    const themes: Theme[] = ['system', 'light', 'dark']
    showMenu(r.right - 220, r.bottom + 2, [
      ...themes.map((th) => ({
        label: check(themeState.theme === th, `${t('menu.theme')}: ${t(`theme.${th}`)}`),
        action: () => setTheme(th),
      })),
      { label: check(i18n.lang === 'ko', '한국어'), action: () => setLang('ko'), separator: true },
      { label: check(i18n.lang === 'en', 'English'), action: () => setLang('en') },
      { label: `${t('help.open')} (F1)`, action: () => (helpOpen = true), separator: true },
      ...(appState.installable && !appState.installed
        ? [{ label: t('menu.install'), action: () => platform.promptInstall().then((ok) => ok && (appState.installable = false)) }]
        : []),
      { label: t('menu.defaultApp'), action: () => (appState.guideOpen = true) },
      { label: `${t('menu.about')} — v${__APP_VERSION__}`, separator: true },
    ])
  }
  let restored = false

  onMount(async () => {
    initWorkspace(platform)
    appState.installed = platform.isInstalled()
    platform.onInstallAvailable((available) => (appState.installable = available))
    setTabClosedHandler((key) => import('./editor/setup').then((m) => m.editorStates.delete(key)))
    // 지난 세션(탭·화면 분할) 복원 → 그다음 파일 연결로 실행된 파일 (launchQueue는 소비자 등록 전까지 대기)
    const session = await platform.restoreSession()
    restoreSnapshot(session.files, session.meta)
    restored = true
    platform.onLaunchFiles((files) => openDocs(files))
  })

  // 열린 탭·화면 분할 기억 (디스크에 있는 파일만)
  let sessionTimer: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    const { handles, meta } = sessionSnapshot()
    clearTimeout(sessionTimer)
    sessionTimer = setTimeout(() => restored && platform.saveSession(handles, meta), 500)
  })

  $effect(() => {
    const doc = cur?.doc
    document.title = doc ? `${isDirty(doc) ? '● ' : ''}${doc.name} - defaultMD` : 'defaultMD'
  })

  async function exportPdf() {
    if (!cur) return
    notify(t('pdf.tip'))
    const { printDoc } = await import('./app/print')
    await printDoc(cur.doc, platform)
  }

  async function open() {
    openDocs(await platform.openFiles())
  }

  async function showRecent(anchor: HTMLElement) {
    const r = anchor.getBoundingClientRect()
    const list = await platform.listRecent()
    showMenu(r.left, r.bottom + 2, [
      ...(list.length
        ? list.map((entry) => ({
            label: entry.name,
            action: async () => {
              const data = await platform.openRecent(entry)
              if (data) openDocs([data])
              else notify(t('recent.missing'))
            },
          }))
        : [{ label: t('recent.empty') }]),
      { label: t('recent.clear'), action: list.length ? () => platform.clearRecent() : undefined, separator: true },
    ])
  }

  async function handleDrop(result: DropResult, paneId: number) {
    await openDocs(result.files, paneId)
    for (const folder of result.folders) {
      if (!folder.entries.length) {
        notify(t('folder.none', { name: folder.name }))
        continue
      }
      const message =
        t('folder.pick', { name: folder.name }) +
        (folder.truncated ? ` ${t('folder.truncated', { n: String(folder.entries.length) })}` : '')
      const picked = await askList(
        message,
        folder.entries.map((e) => e.path),
        t('file.open'),
        t('dlg.cancel'),
      )
      if (!picked?.length) continue
      const files = await Promise.all(picked.map((i) => platform.read(folder.entries[i].handle)))
      await openDocs(
        files.filter((f) => f !== null),
        paneId,
      )
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (dialog.current || tableDialog.current) return
    const run = (fn: () => unknown) => {
      e.preventDefault()
      fn()
    }
    if (e.key === 'F1') return run(() => (helpOpen = !helpOpen))
    // F6 / Shift+F6: 분할 영역 포커스 이동
    if (e.key === 'F6' && !e.ctrlKey && !e.altKey) return run(() => cyclePane(e.shiftKey ? -1 : 1))
    if (!e.ctrlKey || e.altKey) return

    const key = e.key.toLowerCase()
    if (key === 'tab' || key === 'pagedown' || key === 'pageup') {
      return run(() => cycleTab(key === 'pageup' || (key === 'tab' && e.shiftKey) ? -1 : 1))
    }
    // Ctrl+1~8: n번째 탭, Ctrl+9: 마지막 탭
    if (/^[1-9]$/.test(key)) return run(() => selectTab(key === '9' ? -1 : +key - 1))
    if (key === 'o' && !e.shiftKey) return run(open)
    if (key === 'n' && !e.shiftKey) return run(newDoc)

    const c = cur
    if (!c) return
    if (key === 's') run(() => saveDoc(c.doc, e.shiftKey))
    else if (key === 'p' && !e.shiftKey) run(exportPdf)
    else if (key === 'w' && !e.shiftKey) run(() => closeTab(c.pane.id, c.tab.key))
    else if (key === 'e' && !e.shiftKey) run(() => (c.tab.edit = !c.tab.edit))
    else if (key === '/' && !e.shiftKey) run(() => (c.tab.view = c.tab.view === 'raw' ? 'preview' : 'raw'))
    // Ctrl+Shift+/ (키보드에 따라 '?'): 나란히 보기 켜기/끄기
    else if ((key === '/' || key === '?') && e.shiftKey) run(() => (c.tab.view = c.tab.view === 'split' ? 'raw' : 'split'))
    else if (key === '\\') run(() => splitRight())
  }

  // 창을 닫을 때 저장 안 된 문서가 있으면 브라우저 확인창 표시
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (ws.docs.some(isDirty)) e.preventDefault()
  }

  // 브라우저 기본 동작(파일을 새 탭으로 열기) 차단 후 앱 안에서 열기
  // 파일 드래그만 처리: 탭 드래그(effectAllowed='move')의 dropEffect를 덮어쓰면 드롭이 거부됨
  function onDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  function onDragEnter(e: DragEvent) {
    if (e.dataTransfer?.types.includes('Files')) dragDepth++
  }
  function onDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1)
  }
  function onDrop(e: DragEvent) {
    dragDepth = 0
    if (!e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    // 놓은 위치의 분할 영역에서 열기
    const paneEl = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-pane]') : null
    const paneId = paneEl ? Number(paneEl.dataset.pane) : ws.focused
    platform.filesFromDrop(e.dataTransfer).then((r) => handleDrop(r, paneId))
  }

  let lineCount = $derived(cur ? cur.doc.text.split('\n').length : 0)
</script>

<svelte:window
  onkeydowncapture={onKeydown}
  onbeforeunload={onBeforeUnload}
  onfocus={checkExternalChanges}
  ondragover={onDragOver}
  ondragenter={onDragEnter}
  ondragleave={onDragLeave}
  ondrop={onDrop}
/>

<div class="shell">
  <Toolbar
    onNew={newDoc}
    onOpen={open}
    onSave={() => cur && saveDoc(cur.doc)}
    onSaveAs={() => cur && saveDoc(cur.doc, true)}
    onRecent={showRecent}
    onPdf={exportPdf}
    onSettings={showSettings}
  />

  {#if cur?.tab.edit}
    {#await loadFormatBar() then m}
      <m.default onHelp={() => (helpOpen = !helpOpen)} />
    {/await}
  {/if}

  <main>
    <div class="panes"><PaneGrid {platform} /></div>
    {#if helpOpen}
      {#await loadHelpPanel() then m}
        <m.default onClose={() => (helpOpen = false)} />
      {/await}
    {/if}
  </main>

  <footer class="status">
    {#if cur}
      {@const { doc, tab } = cur}
      <span>{doc.name}{isDirty(doc) ? ' ●' : ''}</span>
      <span>{lineCount.toLocaleString()} {t('status.lines')}</span>
      <span>{doc.text.length.toLocaleString()} {t('status.chars')}</span>
      <span>{encodingLabel(doc)}</span>
      <span>{doc.eol === '\r\n' ? 'CRLF' : 'LF'}</span>
      <span>{t(`view.${tab.view}`)} · {t(tab.edit ? 'mode.edit' : 'mode.read')}</span>
    {:else}
      <span>{t('app.ready')}</span>
    {/if}
    {#if status.message}
      <span class="msg">{status.message}</span>
    {/if}
    <span class="spacer"></span>
    <span>v{__APP_VERSION__} · {platform.kind}</span>
  </footer>

  {#if dragDepth > 0}
    <div class="drop-overlay">{t('app.drop')}</div>
  {/if}

  {#if tableDialog.current}
    {#await loadTableEditor() then m}
      <m.default />
    {/await}
  {/if}
  {#if appState.guideOpen}
    {#await loadGuide() then m}
      <m.default {platform} />
    {/await}
  {/if}
  <Menu />
  <Dialog />
</div>

<style>
  .shell {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  main {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .panes {
    flex: 1;
    min-width: 0;
  }
  .status {
    display: flex;
    gap: 16px;
    padding: 2px 8px;
    font-size: 12px;
    color: var(--fg-muted);
    background: var(--bg-elev);
    border-top: 1px solid var(--border);
    white-space: nowrap;
    overflow: hidden;
  }
  .status .msg {
    color: var(--accent);
  }
  .spacer {
    flex: 1;
  }
  .drop-overlay {
    position: absolute;
    inset: 8px;
    display: grid;
    place-items: center;
    font-size: 18px;
    color: var(--accent);
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    border: 2px dashed var(--accent);
    border-radius: 8px;
    pointer-events: none;
  }
</style>
