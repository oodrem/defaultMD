// 최소 IndexedDB 래퍼: 파일/폴더 핸들처럼 localStorage에 넣을 수 없는 값 보관

const DB = 'defaultmd'
const VERSION = 2
const DIRS = 'dirs'
const KV = 'kv'

let dbPromise: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DIRS)) db.createObjectStore(DIRS, { autoIncrement: true })
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

function request<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store))
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function loadDirs(): Promise<FileSystemDirectoryHandle[]> {
  return request<FileSystemDirectoryHandle[]>(DIRS, 'readonly', (s) => s.getAll()).catch(() => [])
}

export async function addDir(dir: FileSystemDirectoryHandle): Promise<void> {
  // 저장 실패 시 이번 세션에서만 유효
  await request(DIRS, 'readwrite', (s) => s.add(dir)).catch(() => {})
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return request<T | undefined>(KV, 'readonly', (s) => s.get(key)).catch(() => undefined)
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await request(KV, 'readwrite', (s) => s.put(value, key)).catch(() => {})
}
