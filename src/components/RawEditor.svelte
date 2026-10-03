<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { Transaction } from '@codemirror/state'
  import { EditorView } from '@codemirror/view'
  import { publishScroll, scrollSync, shouldFollow, type Doc, type Tab } from '../app/workspace.svelte'
  import { minimalChange } from '../editor/diff'
  import { adapters } from '../editor/active'
  import { rawAdapter } from '../editor/raw-adapter'
  import { createEditorState, editableCompartment, editableExt, editorStates } from '../editor/setup'

  let { doc, tab, focused, syncId = tab.key }: { doc: Doc; tab: Tab; focused: boolean; syncId?: number } = $props()

  let host: HTMLDivElement
  let view: EditorView | undefined
  /** 에디터가 마지막으로 doc.text에 반영한 값 (외부 갱신 감지용) */
  let synced = ''
  /** 프로그램이 스크롤한 직후의 scroll 이벤트는 무시 (동기화 핑퐁 방지) */
  let ignoreScrollUntil = 0

  onMount(() => {
    const state = editorStates.get(tab.key) ?? createEditorState(doc.text, tab.edit)
    synced = state.doc.toString()

    view = new EditorView({
      state,
      parent: host,
      dispatchTransactions(trs, v) {
        v.update(trs)
        if (trs.some((tr) => tr.docChanged)) {
          synced = v.state.doc.toString()
          doc.text = synced
        }
      },
    })
    view.dispatch({ effects: editableCompartment.reconfigure(editableExt(tab.edit)) })
    adapters.set(tab.key, rawAdapter(view))
    // 숨겨져 있던 동안 다른 영역에서 바뀐 내용 반영
    applyExternal(doc.text)
    scrollToLine(tab.topLine)
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
    if (tab.edit && focused) view.focus()
  })

  onDestroy(() => {
    if (!view) return
    adapters.delete(tab.key)
    editorStates.set(tab.key, view.state)
    view.destroy()
  })

  function applyExternal(text: string) {
    if (!view || text === synced) return
    const change = minimalChange(synced, text)
    synced = text
    // 다른 영역의 편집은 이 에디터의 실행 취소 기록에 넣지 않음. 커서는 변경 위치에 맞춰 이동
    if (change) view.dispatch({ changes: change, annotations: Transaction.addToHistory.of(false) })
  }

  function scrollToLine(line: number) {
    if (!view) return
    const n = Math.min(line + 1, view.state.doc.lines)
    ignoreScrollUntil = performance.now() + 150
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(n).from, { y: 'start' }) })
  }

  let raf = 0
  function onScroll() {
    if (performance.now() < ignoreScrollUntil) return
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      if (!view) return
      const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop)
      publishScroll(tab, view.state.doc.lineAt(block.from).number - 1, syncId)
    })
  }

  // 읽기/수정 전환
  $effect(() => {
    const edit = tab.edit
    view?.dispatch({ effects: editableCompartment.reconfigure(editableExt(edit)) })
    if (edit && focused) view?.focus()
  })

  // 다른 영역에서 편집, 다시 불러오기 등 이 에디터 밖에서 doc.text가 바뀐 경우
  $effect(() => applyExternal(doc.text))

  // 같은 문서를 보는 다른 영역의 스크롤 따라가기
  $effect(() => {
    void scrollSync.seq
    if (shouldFollow(tab, syncId)) scrollToLine(scrollSync.line)
  })
</script>

<div class="raw" bind:this={host}></div>

<style>
  .raw {
    height: 100%;
    user-select: text;
  }
</style>
