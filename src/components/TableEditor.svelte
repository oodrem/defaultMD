<script lang="ts">
  // 스프레드시트형 표 편집기 (모달)
  import { tick } from 'svelte'
  import { tableDialog } from '../app/tableDialog.svelte'
  import { t } from '../i18n/index.svelte'
  import { parseDelimited, type Align } from '../markdown/table'

  const req = tableDialog.current!
  let rows = $state(req.table.rows.map((r) => [...r]))
  let aligns = $state<Align[]>([...req.table.aligns])
  let grid: HTMLDivElement

  const cols = () => aligns.length

  async function focusCell(r: number, c: number) {
    await tick()
    grid.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`)?.focus()
  }

  function addRow(at = rows.length) {
    rows.splice(at, 0, Array<string>(cols()).fill(''))
    focusCell(at, 0)
  }
  function addCol(at = cols()) {
    rows.forEach((r) => r.splice(at, 0, ''))
    aligns.splice(at, 0, 'none')
    focusCell(0, at)
  }
  function delRow(r: number) {
    if (r > 0 && rows.length > 1) rows.splice(r, 1)
  }
  function delCol(c: number) {
    if (cols() <= 1) return
    rows.forEach((r) => r.splice(c, 1))
    aligns.splice(c, 1)
  }
  function cycleAlign(c: number) {
    const order: Align[] = ['none', 'left', 'center', 'right']
    aligns[c] = order[(order.indexOf(aligns[c]) + 1) % order.length]
  }

  function onCellKey(e: KeyboardEvent, r: number, c: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (r + 1 >= rows.length) addRow()
      else focusCell(r + 1, c)
    }
  }

  // Excel에서 복사한 여러 셀을 붙여넣으면 그 칸부터 채움 (필요하면 행/열 추가)
  function onPaste(e: ClipboardEvent, r: number, c: number) {
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()
    const data = parseDelimited(text, '\t')
    const needCols = c + Math.max(...data.map((d) => d.length))
    while (cols() < needCols) addCol()
    while (rows.length < r + data.length) rows.push(Array<string>(cols()).fill(''))
    data.forEach((line, i) =>
      line.forEach((v, j) => (rows[r + i][c + j] = v.trim().replace(/\|/g, '\\|').replace(/\n/g, '<br>'))),
    )
  }

  function apply() {
    req.resolve({ rows: rows.map((r) => [...r]), aligns: [...aligns] })
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      req.resolve(null)
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      apply()
    }
  }

  $effect(() => {
    focusCell(0, 0)
  })

  // 정렬 표시 (누를 때마다 없음 → 왼쪽 → 가운데 → 오른쪽)
  const ALIGN_ICON: Record<Align, string> = { none: '·', left: '⇤', center: '↔', right: '⇥' }
  const alignLabel = (a: Align) =>
    t(a === 'left' ? 'table.alignLeft' : a === 'center' ? 'table.alignCenter' : a === 'right' ? 'table.alignRight' : 'table.alignNone')
</script>

<svelte:window onkeydowncapture={onKeydown} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label={t('table.title')}>
    <header>
      <strong>{t('table.title')}</strong>
      <span class="dims">{rows.length - 1} × {aligns.length}</span>
    </header>

    <div class="scroll">
      <div class="grid" bind:this={grid} style:grid-template-columns="28px repeat({aligns.length}, minmax(110px, 1fr)) 28px">
        <!-- 열 머리: 정렬 · 삭제 -->
        <span></span>
        {#each aligns as a, c (c)}
          <div class="colhead">
            <button class="mini" title={alignLabel(a)} onclick={() => cycleAlign(c)}>{ALIGN_ICON[a]}</button>
            <button class="mini" title={t('table.delCol')} disabled={aligns.length <= 1} onclick={() => delCol(c)}>×</button>
          </div>
        {/each}
        <button class="mini add" title={t('table.addCol')} onclick={() => addCol()}>+</button>

        {#each rows as row, r (r)}
          <span class="rowhead">{r === 0 ? 'H' : r}</span>
          {#each row as _, c (c)}
            <input
              class:header={r === 0}
              style:text-align={aligns[c] === 'none' ? 'left' : aligns[c]}
              data-r={r}
              data-c={c}
              placeholder={r === 0 ? t('table.headerRow') : ''}
              bind:value={rows[r][c]}
              onkeydown={(e) => onCellKey(e, r, c)}
              onpaste={(e) => onPaste(e, r, c)}
            />
          {/each}
          <button class="mini" title={t('table.delRow')} disabled={r === 0} onclick={() => delRow(r)}>×</button>
        {/each}
      </div>
    </div>
    <button class="add-row" onclick={() => addRow()}>+ {t('table.addRow')}</button>

    <p class="tip">{t('table.tipKeys')}</p>
    <footer>
      <button onclick={() => req.resolve(null)}>{t('dlg.cancel')}</button>
      <button class="primary" title="Ctrl+Enter" onclick={apply}>{req.isNew ? t('table.insert') : t('table.apply')}</button>
    </footer>
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
    display: flex;
    flex-direction: column;
    width: min(900px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    padding: 16px 20px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.25);
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 12px;
  }
  .dims {
    font-size: 12px;
    color: var(--fg-muted);
  }
  .scroll {
    min-height: 0;
    overflow: auto;
  }
  .grid {
    display: grid;
    gap: 4px;
    align-items: center;
  }
  .colhead {
    display: flex;
    justify-content: center;
    gap: 2px;
  }
  .rowhead {
    font-size: 11px;
    text-align: center;
    color: var(--fg-muted);
  }
  input {
    width: 100%;
    min-width: 0;
    padding: 5px 7px;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  input:focus {
    outline: 2px solid color-mix(in srgb, var(--accent) 50%, transparent);
    border-color: var(--accent);
  }
  input.header {
    font-weight: 600;
    background: var(--bg-elev);
  }
  button {
    font: inherit;
    color: var(--fg);
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 5px 14px;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .mini {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 13px;
    line-height: 1;
    background: transparent;
  }
  .add {
    color: var(--accent);
  }
  .add-row {
    align-self: flex-start;
    margin: 8px 0 0 32px;
    padding: 3px 10px;
    font-size: 13px;
    color: var(--accent);
    background: transparent;
  }
  .tip {
    margin: 10px 0;
    font-size: 12px;
    color: var(--fg-muted);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .primary {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }
  .primary:hover:not(:disabled) {
    background: var(--accent);
  }
</style>
