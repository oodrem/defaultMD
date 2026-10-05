/** 플랫폼(PWA / Tauri) 공통 인터페이스. UI 코드는 이 인터페이스만 사용한다. */

/** 플랫폼별 파일 핸들 (web: FileSystemFileHandle, tauri: 경로 문자열). null = 디스크에 없음 */
export type FileHandle = unknown

export interface FileData {
  name: string
  bytes: ArrayBuffer
  handle: FileHandle
  lastModified: number
}

export interface SavedFile {
  name: string
  handle: FileHandle
  lastModified: number
}

export interface RecentEntry {
  name: string
  handle: FileHandle
}

export interface DroppedFolder {
  name: string
  /** 폴더 안 Markdown 파일 (경로는 폴더 기준 상대경로) */
  entries: { path: string; handle: FileHandle }[]
  /** 파일이 너무 많아 일부만 수집함 */
  truncated: boolean
}

export interface DropResult {
  files: FileData[]
  folders: DroppedFolder[]
}

export interface Platform {
  readonly kind: 'web' | 'tauri'
  /** 첫 렌더 후 호출: 창 표시, 서비스 워커 등록 등 */
  ready(): Promise<void>
  /** 새 버전이 준비됨. apply()를 부르면 적용(새로고침) */
  onUpdateReady(cb: (apply: () => void) => void): void
  /** 파일 연결/더블클릭으로 실행된 파일 수신 (앱 실행 중 추가 실행 포함). 등록 전에 도착한 파일도 전달 */
  onLaunchFiles(cb: (files: FileData[]) => void): void
  /** 열기 대화상자 (취소 시 빈 배열) */
  openFiles(): Promise<FileData[]>
  /** 드롭된 Markdown 파일 읽기 + 폴더 안 Markdown 목록. drop 이벤트 핸들러 안에서 동기적으로 호출해야 함 */
  filesFromDrop(dt: DataTransfer): Promise<DropResult>
  /** 디스크에서 다시 읽기 */
  read(handle: FileHandle): Promise<FileData | null>
  /** 마지막 수정 시각 (외부 변경 감지용). 알 수 없으면 null */
  stat(handle: FileHandle): Promise<number | null>
  /** 기존 파일에 덮어쓰기. 권한 거부 등으로 실패하면 null */
  save(handle: FileHandle, bytes: Uint8Array): Promise<SavedFile | null>
  /** 다른 이름으로 저장 대화상자. 취소 시 null */
  saveAs(suggestedName: string, bytes: Uint8Array): Promise<SavedFile | null>
  /** 문서 기준 상대경로 리소스(이미지)의 표시용 URL. 접근 권한이 없으면 null */
  resolveAsset(handle: FileHandle, relPath: string): Promise<string | null>
  /** 문서 폴더 접근 권한 요청 (사용자 클릭 핸들러에서 호출). 성공 여부 반환 */
  requestAssetAccess(handle: FileHandle): Promise<boolean>

  /** 최근 파일 (최신순) */
  listRecent(): Promise<RecentEntry[]>
  addRecent(entry: RecentEntry): Promise<void>
  /** 최근 파일 열기 — 필요하면 권한 요청 (사용자 클릭 핸들러에서 호출) */
  openRecent(entry: RecentEntry): Promise<FileData | null>
  clearRecent(): Promise<void>

  /** 앱으로 설치되어 독립 창에서 실행 중인지 (PWA: display-mode standalone) */
  isInstalled(): boolean
  /** 설치 가능 여부가 바뀔 때 (PWA: beforeinstallprompt / appinstalled) */
  onInstallAvailable(cb: (available: boolean) => void): void
  /** 설치 대화상자 (사용자 클릭 핸들러에서 호출). 설치했으면 true */
  promptInstall(): Promise<boolean>

  /** 열린 탭 기억 / 다음 실행 시 복원. meta는 화면 배치 등 앱이 해석하는 값 */
  saveSession(handles: FileHandle[], meta: unknown): void
  /** files[i]는 handles[i]에 대응. 권한이 없거나 사라진 파일은 null */
  restoreSession(): Promise<{ files: (FileData | null)[]; meta: unknown }>
}

export const MD_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd']

export function isMarkdownName(name: string): boolean {
  const lower = name.toLowerCase()
  return MD_EXTENSIONS.some((ext) => lower.endsWith(ext))
}
