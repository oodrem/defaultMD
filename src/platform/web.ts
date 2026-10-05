import { addDir, kvGet, kvSet, loadDirs } from './idb'
import {
  MD_EXTENSIONS,
  isMarkdownName,
  type DroppedFolder,
  type FileData,
  type FileHandle,
  type Platform,
  type RecentEntry,
} from './types'

// File System Access API 중 TS DOM 타입에 아직 없는 부분
type PermMode = { mode: 'read' | 'readwrite' }
type PermState = 'granted' | 'denied' | 'prompt'
interface PermHandle {
  queryPermission(opts: PermMode): Promise<PermState>
  requestPermission(opts: PermMode): Promise<PermState>
}
interface FsWindow {
  launchQueue?: { setConsumer(cb: (p: { files: FileSystemFileHandle[] }) => void): void }
  showOpenFilePicker?(opts: object): Promise<FileSystemFileHandle[]>
  showSaveFilePicker?(opts: object): Promise<FileSystemFileHandle>
  showDirectoryPicker?(opts: object): Promise<FileSystemDirectoryHandle>
}
const fsWin = window as unknown as FsWindow

const PICKER_TYPES = [{ description: 'Markdown', accept: { 'text/markdown': MD_EXTENSIONS } }]

async function fromFile(file: File, handle: FileSystemFileHandle | null): Promise<FileData> {
  return { name: file.name, bytes: await file.arrayBuffer(), handle, lastModified: file.lastModified }
}

async function readHandle(handle: FileSystemFileHandle): Promise<FileData> {
  return fromFile(await handle.getFile(), handle)
}

// ── 파일 연결(더블클릭)로 실행된 파일 ──
// 앱 화면이 준비되기 전에 도착할 수 있으므로 모듈이 로드되는 즉시(앱 시작 직후) 받기 시작하고,
// 앱이 onLaunchFiles로 받을 준비가 될 때까지 모아 둔다.
const updateListeners = new Set<(apply: () => void) => void>()
const launchBuffer: FileData[][] = []
let launchCallback: ((files: FileData[]) => void) | null = null

fsWin.launchQueue?.setConsumer(async ({ files }) => {
  if (!files?.length) return
  const data = (await Promise.all(files.map((h) => readHandle(h).catch(() => null)))).filter(
    (f): f is FileData => f !== null,
  )
  if (!data.length) return
  if (launchCallback) launchCallback(data)
  else launchBuffer.push(data)
})

async function ensurePermission(handle: FileSystemHandle, mode: PermMode['mode']): Promise<boolean> {
  const h = handle as unknown as PermHandle
  if ((await h.queryPermission({ mode })) === 'granted') return true
  return (await h.requestPermission({ mode })) === 'granted'
}

async function write(handle: FileSystemFileHandle, bytes: Uint8Array) {
  // createWritable은 임시 파일에 쓴 뒤 close 시 교체 → 원자적 저장
  const w = await handle.createWritable()
  await w.write(bytes as Uint8Array<ArrayBuffer>)
  await w.close()
  const file = await handle.getFile()
  return { name: file.name, handle, lastModified: file.lastModified }
}

// ── 이미지(상대경로) 해석 ──────────────────────────────────────────────
// 브라우저는 열린 파일의 형제 파일에 접근할 수 없으므로, 사용자가 허용한 폴더 핸들에서
// dir.resolve(fileHandle)로 문서 위치를 찾아 상대경로를 따라간다.

let dirs: FileSystemDirectoryHandle[] | null = null
const urlCache = new Map<string, string>()

async function getDirs() {
  return (dirs ??= await loadDirs())
}

/** 문서를 포함하는 폴더 핸들과 문서까지의 경로 */
async function locate(fh: FileSystemFileHandle) {
  for (const dir of await getDirs()) {
    const path = await dir.resolve(fh).catch(() => null)
    if (path) return { dir, path }
  }
  return null
}

function splitRel(rel: string): string[] | null {
  const clean = decodeURIComponent(rel.split(/[?#]/)[0]).replace(/\\/g, '/')
  if (/^[a-z]+:/i.test(clean) || clean.startsWith('/')) return null
  return clean.split('/').filter((p) => p && p !== '.')
}

async function walk(dir: FileSystemDirectoryHandle, parts: string[]): Promise<File | null> {
  try {
    let cur = dir
    for (const p of parts.slice(0, -1)) cur = await cur.getDirectoryHandle(p)
    return await (await cur.getFileHandle(parts[parts.length - 1])).getFile()
  } catch {
    return null
  }
}

// ── 앱 설치 (PWA) ──
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let installPrompt: InstallPromptEvent | null = null
const installListeners = new Set<(available: boolean) => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // 브라우저 기본 안내 대신 앱 안의 버튼으로
  installPrompt = e as InstallPromptEvent
  installListeners.forEach((cb) => cb(true))
})
window.addEventListener('appinstalled', () => {
  installPrompt = null
  installListeners.forEach((cb) => cb(false))
})

const asFile = (h: FileHandle) => (h instanceof FileSystemFileHandle ? h : null)

/** 폴더를 이미지 해석용 허용 폴더로 등록 (드롭한 폴더는 이미 읽기 권한이 있음) */
async function registerDir(dir: FileSystemDirectoryHandle) {
  const list = await getDirs()
  for (const d of list) if (await d.isSameEntry(dir)) return
  list.push(dir)
  await addDir(dir)
}

// ── 폴더 드롭: 안의 Markdown 파일 수집 ──
const MAX_FOLDER_FILES = 300
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg'])
type DirEntries = AsyncIterable<[string, FileSystemHandle]>

async function collectMarkdown(dir: FileSystemDirectoryHandle): Promise<DroppedFolder> {
  const entries: DroppedFolder['entries'] = []
  let truncated = false
  async function walkDir(d: FileSystemDirectoryHandle, prefix: string, depth: number) {
    for await (const [name, h] of (d as unknown as { entries(): DirEntries }).entries()) {
      if (entries.length >= MAX_FOLDER_FILES) {
        truncated = true
        return
      }
      if (h instanceof FileSystemDirectoryHandle) {
        if (depth < 5 && !name.startsWith('.') && !SKIP_DIRS.has(name)) await walkDir(h, `${prefix}${name}/`, depth + 1)
      } else if (isMarkdownName(name)) {
        entries.push({ path: prefix + name, handle: h })
      }
    }
  }
  await walkDir(dir, '', 0)
  entries.sort((a, b) => a.path.localeCompare(b.path))
  return { name: dir.name, entries, truncated }
}

// ── 최근 파일 ──
const MAX_RECENT = 10
let recentQueue = Promise.resolve()

async function sameEntry(a: FileHandle, b: FileHandle) {
  return a instanceof FileSystemFileHandle && b instanceof FileSystemFileHandle && a.isSameEntry(b)
}

export const webPlatform: Platform = {
  kind: 'web',

  async ready() {
    if (import.meta.env.PROD) {
      const { registerSW } = await import('virtual:pwa-register')
      // 새 버전은 자동으로 새로고침하지 않고 앱에 알림 (편집 중 내용·실행 파일 보호)
      const update = registerSW({
        immediate: true,
        onNeedRefresh: () => updateListeners.forEach((cb) => cb(() => update(true))),
      })
    }
  },

  onUpdateReady(cb) {
    updateListeners.add(cb)
  },

  onLaunchFiles(cb) {
    launchCallback = cb
    for (const files of launchBuffer.splice(0)) cb(files)
  },

  async openFiles() {
    if (!fsWin.showOpenFilePicker) return []
    try {
      const handles = await fsWin.showOpenFilePicker({ id: 'md', multiple: true, types: PICKER_TYPES })
      return Promise.all(handles.map(readHandle))
    } catch {
      return [] // 사용자가 취소
    }
  },

  async filesFromDrop(dt) {
    // getAsFileSystemHandle()은 이벤트 처리 중(동기 구간)에 모두 호출해야 함
    const pending: Promise<FileData | DroppedFolder | null>[] = []
    for (const item of Array.from(dt.items)) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      const getHandle = (item as unknown as { getAsFileSystemHandle?(): Promise<FileSystemHandle | null> })
        .getAsFileSystemHandle
      if (!getHandle) {
        if (file && isMarkdownName(file.name)) pending.push(fromFile(file, null))
        continue
      }
      pending.push(
        getHandle.call(item).then(async (h) => {
          if (h instanceof FileSystemDirectoryHandle) {
            await registerDir(h)
            return collectMarkdown(h)
          }
          if (!file || !isMarkdownName(file.name)) return null
          return h instanceof FileSystemFileHandle ? readHandle(h) : fromFile(file, null)
        }),
      )
    }
    const results = (await Promise.all(pending)).filter((r) => r !== null)
    return {
      files: results.filter((r): r is FileData => 'bytes' in r),
      folders: results.filter((r): r is DroppedFolder => 'entries' in r),
    }
  },

  async read(handle) {
    const fh = asFile(handle)
    return fh ? readHandle(fh).catch(() => null) : null
  },

  async stat(handle) {
    const fh = asFile(handle)
    if (!fh) return null
    try {
      return (await fh.getFile()).lastModified
    } catch {
      return null // 삭제/이동되었거나 권한 없음
    }
  },

  async save(handle, bytes) {
    const fh = asFile(handle)
    if (!fh) return null
    try {
      if (!(await ensurePermission(fh, 'readwrite'))) return null
      return await write(fh, bytes)
    } catch {
      return null
    }
  },

  async saveAs(suggestedName, bytes) {
    if (!fsWin.showSaveFilePicker) return null
    let fh: FileSystemFileHandle
    try {
      fh = await fsWin.showSaveFilePicker({ id: 'md', suggestedName, types: PICKER_TYPES })
    } catch {
      return null // 사용자가 취소
    }
    return write(fh, bytes)
  },

  async resolveAsset(handle, relPath) {
    const fh = asFile(handle)
    const parts = splitRel(relPath)
    if (!fh || !parts?.length) return null
    const loc = await locate(fh)
    if (!loc) return null
    if ((await (loc.dir as unknown as PermHandle).queryPermission({ mode: 'read' })) !== 'granted') return null

    // 문서 폴더 기준으로 ../ 처리 (허용 폴더 밖으로는 나갈 수 없음)
    const base = loc.path.slice(0, -1)
    for (const p of parts) {
      if (p === '..') {
        if (!base.length) return null
        base.pop()
      } else base.push(p)
    }
    const key = `${loc.dir.name}/${base.join('/')}`
    const cached = urlCache.get(key)
    if (cached) return cached
    const blob = await walk(loc.dir, base)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    urlCache.set(key, url)
    return url
  },

  async requestAssetAccess(handle) {
    const fh = asFile(handle)
    if (!fh) return false
    // 이미 등록된 폴더가 있으면 권한만 다시 요청
    const loc = await locate(fh)
    if (loc) return ensurePermission(loc.dir, 'read')
    if (!fsWin.showDirectoryPicker) return false
    try {
      const dir = await fsWin.showDirectoryPicker({ id: 'md-assets', startIn: fh, mode: 'read' })
      if (!(await dir.resolve(fh))) return false // 문서가 들어있지 않은 폴더를 고름
      await registerDir(dir)
      return true
    } catch {
      return false
    }
  },

  async listRecent() {
    return (await kvGet<RecentEntry[]>('recent')) ?? []
  },

  addRecent(entry) {
    if (!asFile(entry.handle)) return Promise.resolve()
    // 여러 파일을 동시에 열 때 읽기-수정-쓰기가 겹치지 않도록 직렬화
    recentQueue = recentQueue.then(async () => {
      const list = await this.listRecent()
      const rest: RecentEntry[] = []
      for (const e of list) if (!(await sameEntry(e.handle, entry.handle))) rest.push(e)
      await kvSet('recent', [{ name: entry.name, handle: entry.handle }, ...rest].slice(0, MAX_RECENT))
    })
    return recentQueue
  },

  async openRecent(entry) {
    const fh = asFile(entry.handle)
    if (!fh) return null
    try {
      if (!(await ensurePermission(fh, 'read'))) return null
      return await readHandle(fh)
    } catch {
      return null // 이동/삭제됨
    }
  },

  async clearRecent() {
    await kvSet('recent', [])
  },

  isInstalled() {
    return ['standalone', 'window-controls-overlay', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches)
  },

  onInstallAvailable(cb) {
    installListeners.add(cb)
    cb(!!installPrompt)
  },

  async promptInstall() {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') installPrompt = null
    return outcome === 'accepted'
  },

  saveSession(handles, meta) {
    kvSet('session', { handles: handles.filter(asFile), meta })
  },

  async restoreSession() {
    const session = await kvGet<{ handles: FileSystemFileHandle[]; meta?: unknown }>('session')
    const files = await Promise.all(
      (session?.handles ?? []).map(async (h) => {
        // 권한이 유지된 파일만 (권한 요청 창은 사용자 동작 없이 띄울 수 없음)
        const granted = await (h as unknown as PermHandle).queryPermission({ mode: 'read' }).catch(() => 'denied')
        return granted === 'granted' ? readHandle(h).catch(() => null) : null
      }),
    )
    return { files, meta: session?.meta ?? null }
  },
}
