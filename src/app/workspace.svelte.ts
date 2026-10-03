// 작업 공간 상태: 열린 문서(내용 공유) + 분할 영역(Pane)별 탭 목록.
// 같은 문서를 여러 영역에 서로 다른 모드(예: 왼쪽 Raw-수정, 오른쪽 미리보기)로 띄울 수 있다.

import { t } from '../i18n/index.svelte'
import type { FileData, FileHandle, Platform, SavedFile } from '../platform'
import { decode, encode, type Encoding, type Eol } from './codec'
import { ask, notify } from './ui.svelte'

/** split = 한 탭 안에서 Raw(왼쪽)와 미리보기(오른쪽)를 나란히 */
export type View = 'raw' | 'preview' | 'split'
export type Layout = '1' | '2v' | '2h' | '3' | '4'
export const LAYOUTS: Layout[] = ['1', '2v', '2h', '3', '4']
export const PANE_COUNT: Record<Layout, number> = { '1': 1, '2v': 2, '2h': 2, '3': 3, '4': 4 }

export interface Doc {
  id: number
  name: string
  handle: FileHandle
  /** 현재 편집 중인 내용 (줄바꿈 \n) */
  text: string
  /** 마지막으로 저장/로드한 내용 */
  saved: string
  encoding: Encoding
  bom: boolean
  eol: Eol
  lastModified: number
  /** 편집 중에 외부에서 파일이 바뀜 */
  external: boolean
}

/** 분할 영역 안의 탭 하나 = 문서 + 보기 모드 */
export interface Tab {
  key: number
  docId: number
  view: View
  edit: boolean
  /** 스크롤 위치 (0부터 시작하는 원문 줄 번호) */
  topLine: number
}

export interface Pane {
  id: number
  tabs: Tab[]
  activeKey: number
}

let platform: Platform
let nextDocId = 1
let nextTabKey = 1
let nextPaneId = 1
let untitledCount = 0

const newPane = (): Pane => ({ id: nextPaneId++, tabs: [], activeKey: 0 })

export const ws = $state({
  docs: [] as Doc[],
  panes: [newPane()] as Pane[],
  focused: 1,
  layout: '1' as Layout,
  /** 분할선 위치 비율 (세로선 = col, 가로선 = row, 나란히 보기 안쪽 = inner) */
  sizes: { col: 0.5, row: 0.5, inner: 0.5 },
  syncScroll: true,
})

export function initWorkspace(p: Platform) {
  platform = p
}

// ── 조회 ──

export const isDirty = (d: Doc) => d.text !== d.saved
export const docById = (id: number) => ws.docs.find((d) => d.id === id)
export const paneById = (id: number) => ws.panes.find((p) => p.id === id)
export const activeTab = (pane: Pane) => pane.tabs.find((tab) => tab.key === pane.activeKey)
export const focusedPane = () => paneById(ws.focused) ?? ws.panes[0]

/** 포커스된 영역의 활성 탭과 문서 */
export function current(): { pane: Pane; tab: Tab; doc: Doc } | undefined {
  const pane = focusedPane()
  const tab = activeTab(pane)
  const doc = tab && docById(tab.docId)
  return tab && doc ? { pane, tab, doc } : undefined
}

function refCount(docId: number) {
  return ws.panes.reduce((n, p) => n + p.tabs.filter((tab) => tab.docId === docId).length, 0)
}

// ── 문서 열기/만들기 ──

function fromData(data: FileData): Omit<Doc, 'id'> {
  const { text, encoding, bom, eol } = decode(data.bytes)
  return {
    name: data.name,
    handle: data.handle,
    text,
    saved: text,
    encoding,
    bom,
    eol,
    lastModified: data.lastModified,
    external: false,
  }
}

async function findSame(handle: FileHandle): Promise<Doc | undefined> {
  if (!(handle instanceof FileSystemFileHandle)) return undefined
  for (const d of ws.docs) {
    if (d.handle instanceof FileSystemFileHandle && (await handle.isSameEntry(d.handle))) return d
  }
  return undefined
}

/** 영역에 문서 탭 추가 (이미 그 영역에 있으면 활성화만) */
function showDoc(pane: Pane, docId: number, view: View = 'preview', edit = false): Tab {
  let tab = pane.tabs.find((x) => x.docId === docId)
  if (!tab) {
    tab = { key: nextTabKey++, docId, view, edit, topLine: 0 }
    pane.tabs.push(tab)
  }
  pane.activeKey = tab.key
  return tab
}

/** 파일 열기 (기본: 포커스된 영역). 이미 열린 파일은 내용을 공유하는 탭으로 */
export async function openDocs(files: FileData[], paneId = ws.focused) {
  const pane = paneById(paneId) ?? focusedPane()
  for (const data of files) {
    let doc = await findSame(data.handle)
    if (!doc) {
      doc = { id: nextDocId++, ...fromData(data) }
      ws.docs.push(doc)
    }
    showDoc(pane, doc.id)
    if (data.handle) platform.addRecent({ name: data.name, handle: data.handle })
  }
  ws.focused = pane.id
}

export function newDoc() {
  const doc: Doc = {
    id: nextDocId++,
    name: `${t('doc.untitled')}-${++untitledCount}.md`,
    handle: null,
    text: '',
    saved: '',
    encoding: 'utf-8',
    bom: false,
    eol: '\n',
    lastModified: 0,
    external: false,
  }
  ws.docs.push(doc)
  showDoc(focusedPane(), doc.id, 'raw', true)
}

// ── 저장 ──

/** 저장. as=true이거나 디스크에 없는 문서면 다른 이름으로 저장. 성공 여부 반환 */
export async function saveDoc(doc: Doc, as = false): Promise<boolean> {
  const text = doc.text
  const converted = doc.encoding === 'euc-kr'
  const info = { encoding: converted ? 'utf-8' : doc.encoding, bom: doc.bom, eol: doc.eol } as const
  const bytes = encode(text, info)

  let result: SavedFile | null = null
  if (!as && doc.handle) result = await platform.save(doc.handle, bytes)
  // 덮어쓰기 권한이 거부되었거나 새 문서면 저장 위치를 묻는다
  if (!result) result = await platform.saveAs(doc.name, bytes)
  if (!result) {
    if (!as && doc.handle) notify(t('msg.saveFailed'))
    return false
  }

  if (result.handle !== doc.handle) platform.addRecent({ name: result.name, handle: result.handle })
  Object.assign(doc, {
    name: result.name,
    handle: result.handle,
    saved: text,
    encoding: info.encoding,
    lastModified: result.lastModified,
    external: false,
  })
  notify(converted ? t('msg.converted') : t('msg.saved'))
  return true
}

// ── 탭 닫기/이동 ──

/** 탭이 닫힐 때 에디터 상태 정리용 콜백 */
let onTabClosed: ((key: number) => void) | undefined
export function setTabClosedHandler(cb: (key: number) => void) {
  onTabClosed = cb
}

function removeTab(pane: Pane, key: number) {
  const i = pane.tabs.findIndex((x) => x.key === key)
  if (i < 0) return
  pane.tabs.splice(i, 1)
  if (pane.activeKey === key) pane.activeKey = pane.tabs[Math.min(i, pane.tabs.length - 1)]?.key ?? 0
}

/**
 * 탭 닫기. 그 문서를 보여주는 마지막 탭이고 저장 안 된 변경이 있으면 확인.
 * 닫았으면 true
 */
export async function closeTab(paneId: number, key: number): Promise<boolean> {
  const pane = paneById(paneId)
  const tab = pane?.tabs.find((x) => x.key === key)
  if (!pane || !tab) return false
  const doc = docById(tab.docId)
  const last = refCount(tab.docId) === 1

  if (last && doc && isDirty(doc)) {
    pane.activeKey = key
    ws.focused = pane.id
    const choice = await ask(t('dlg.unsaved', { name: doc.name }), [
      { id: 'save', label: t('dlg.save'), primary: true },
      { id: 'discard', label: t('dlg.discard') },
      { id: 'cancel', label: t('dlg.cancel') },
    ])
    if (choice === 'cancel') return false
    if (choice === 'save' && !(await saveDoc(doc))) return false
  }

  removeTab(pane, key)
  if (last) ws.docs = ws.docs.filter((d) => d.id !== tab.docId)
  onTabClosed?.(key)
  return true
}

/** 여러 탭 닫기 (각각 저장 확인). 도중에 취소하면 중단 */
export async function closeTabs(paneId: number, keys: number[]) {
  for (const key of keys) if (!(await closeTab(paneId, key))) return
}

/**
 * 탭 이동: from 영역의 key 탭을 to 영역의 index 위치(이동 전 기준)로.
 * 대상 영역에 같은 문서가 이미 있으면 그 탭을 활성화하고 원래 탭은 없앤다.
 */
export function moveTab(fromId: number, key: number, toId: number, index: number) {
  const from = paneById(fromId)
  const to = paneById(toId)
  const tab = from?.tabs.find((x) => x.key === key)
  if (!from || !to || !tab) return

  if (from === to) {
    const i = from.tabs.indexOf(tab)
    from.tabs.splice(i, 1)
    from.tabs.splice(i < index ? index - 1 : index, 0, tab)
  } else {
    const existing = to.tabs.find((x) => x.docId === tab.docId)
    removeTab(from, key)
    if (existing) {
      onTabClosed?.(key)
      to.activeKey = existing.key
      ws.focused = to.id
      return
    }
    to.tabs.splice(Math.min(index, to.tabs.length), 0, tab)
  }
  to.activeKey = tab.key
  ws.focused = to.id
}

/** 현재 탭의 문서를 옆 영역에서 열기 (단일 화면이면 좌우 2분할로). Raw면 옆은 미리보기 */
export function splitRight(paneId = ws.focused, key?: number) {
  const pane = paneById(paneId)
  const tab = pane && (key ? pane.tabs.find((x) => x.key === key) : activeTab(pane))
  if (!pane || !tab) return
  if (ws.layout === '1') setLayout('2v')
  const i = ws.panes.findIndex((p) => p.id === pane.id)
  const target = ws.panes[(i + 1) % ws.panes.length]
  const opened = showDoc(target, tab.docId, tab.view === 'raw' ? 'preview' : 'raw', tab.view !== 'raw')
  opened.topLine = tab.topLine
  ws.focused = target.id
}

// ── 레이아웃 ──

export function setLayout(layout: Layout) {
  const n = PANE_COUNT[layout]
  while (ws.panes.length < n) ws.panes.push(newPane())
  if (ws.panes.length > n) {
    // 없어지는 영역의 탭은 남는 마지막 영역으로 합침 (같은 문서 탭은 하나만)
    const keep = ws.panes[n - 1]
    for (const p of ws.panes.slice(n)) {
      for (const tab of p.tabs) {
        if (keep.tabs.some((x) => x.docId === tab.docId)) onTabClosed?.(tab.key)
        else keep.tabs.push(tab)
      }
    }
    if (!keep.activeKey && keep.tabs.length) keep.activeKey = keep.tabs[0].key
    ws.panes.splice(n)
    if (!paneById(ws.focused)) ws.focused = keep.id
  }
  ws.layout = layout
}

/** 포커스된 영역에서 다음/이전 탭 (순환) */
export function cycleTab(step: number) {
  const pane = focusedPane()
  const n = pane.tabs.length
  if (!n) return
  const i = pane.tabs.findIndex((x) => x.key === pane.activeKey)
  pane.activeKey = pane.tabs[(i + step + n) % n].key
}

/** 포커스된 영역의 n번째 탭 (음수 = 마지막) */
export function selectTab(index: number) {
  const pane = focusedPane()
  const tab = index < 0 ? pane.tabs.at(-1) : pane.tabs[Math.min(index, pane.tabs.length - 1)]
  if (tab) pane.activeKey = tab.key
}

/** 영역 포커스 이동 (순환) */
export function cyclePane(step: number) {
  const i = ws.panes.findIndex((p) => p.id === ws.focused)
  ws.focused = ws.panes[(i + step + ws.panes.length) % ws.panes.length].id
}

// ── 외부 변경 ──

export async function reloadDoc(doc: Doc) {
  const data = await platform.read(doc.handle)
  if (!data) return
  Object.assign(doc, fromData(data))
  notify(t('msg.reloaded'))
}

/** 창이 포커스를 얻을 때 호출: 외부 변경 감지 (PWA에는 파일 감시 API가 없음) */
export async function checkExternalChanges() {
  for (const doc of ws.docs) {
    if (!doc.handle || doc.external) continue
    const modified = await platform.stat(doc.handle)
    if (modified === null || modified <= doc.lastModified) continue
    if (isDirty(doc)) doc.external = true
    else await reloadDoc(doc)
  }
}

export function ignoreExternal(doc: Doc) {
  doc.external = false
  platform.stat(doc.handle).then((m) => m && (doc.lastModified = m))
}

// ── 스크롤 동기화 ──
// 같은 문서를 보는 다른 영역(설정에 따라), 그리고 나란히 보기의 Raw ⇄ 미리보기(항상)가 서로 따라감

export const scrollSync = $state({ docId: 0, line: 0, source: 0, tabKey: 0, global: false, seq: 0 })

/** source = 보낸 화면 id (나란히 보기에서는 Raw와 미리보기가 서로 다른 id) */
export function publishScroll(tab: Tab, line: number, source = tab.key) {
  if (tab.topLine === line) return
  tab.topLine = line
  const global = ws.syncScroll
  if (!global && tab.view !== 'split') return
  Object.assign(scrollSync, { docId: tab.docId, line, source, tabKey: tab.key, global, seq: scrollSync.seq + 1 })
}

/** 이 화면이 scrollSync를 따라가야 하는지 */
export function shouldFollow(tab: Tab, source: number): boolean {
  return (
    scrollSync.docId === tab.docId &&
    scrollSync.source !== source &&
    (scrollSync.global || scrollSync.tabKey === tab.key)
  )
}

// ── 세션 저장/복원 ──

interface SessionMeta {
  layout: Layout
  sizes: { col: number; row: number; inner?: number }
  syncScroll: boolean
  focused: number
  panes: { tabs: { h: number; view: View; edit: boolean; topLine: number }[]; active: number }[]
}

export function sessionSnapshot(): { handles: FileHandle[]; meta: SessionMeta } {
  const saved = ws.docs.filter((d) => d.handle)
  const meta: SessionMeta = {
    layout: ws.layout,
    sizes: { ...ws.sizes },
    syncScroll: ws.syncScroll,
    focused: Math.max(0, ws.panes.findIndex((p) => p.id === ws.focused)),
    panes: ws.panes.map((p) => {
      const tabs = p.tabs.filter((x) => saved.some((d) => d.id === x.docId))
      return {
        tabs: tabs.map((x) => ({
          h: saved.findIndex((d) => d.id === x.docId),
          view: x.view,
          edit: x.edit,
          topLine: x.topLine,
        })),
        active: Math.max(0, tabs.findIndex((x) => x.key === p.activeKey)),
      }
    }),
  }
  return { handles: saved.map((d) => d.handle), meta }
}

export function restoreSnapshot(files: (FileData | null)[], meta: unknown) {
  const m = meta as SessionMeta | null
  const docIds = files.map((data) => {
    if (!data) return 0
    const doc: Doc = { id: nextDocId++, ...fromData(data) }
    ws.docs.push(doc)
    return doc.id
  })

  if (!m?.panes) {
    // 이전 형식(M3) 또는 정보 없음: 모두 첫 영역에
    for (const id of docIds) if (id) showDoc(ws.panes[0], id)
    return
  }
  setLayout(LAYOUTS.includes(m.layout) ? m.layout : '1')
  ws.sizes = { col: m.sizes?.col ?? 0.5, row: m.sizes?.row ?? 0.5, inner: m.sizes?.inner ?? 0.5 }
  ws.syncScroll = m.syncScroll ?? true
  m.panes.slice(0, ws.panes.length).forEach((saved, i) => {
    const pane = ws.panes[i]
    for (const s of saved.tabs) {
      const docId = docIds[s.h]
      if (!docId) continue
      pane.tabs.push({ key: nextTabKey++, docId, view: s.view, edit: s.edit, topLine: s.topLine ?? 0 })
    }
    pane.activeKey = (pane.tabs[saved.active] ?? pane.tabs[0])?.key ?? 0
  })
  ws.focused = ws.panes[m.focused]?.id ?? ws.panes[0].id
  // 어떤 탭에서도 쓰이지 않는 문서 정리
  ws.docs = ws.docs.filter((d) => refCount(d.id) > 0)
}
