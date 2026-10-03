import type { Platform } from './types'

export type { DropResult, DroppedFolder, FileData, FileHandle, Platform, RecentEntry, SavedFile } from './types'

const isTauri = '__TAURI_INTERNALS__' in window

/** 실행 환경에 맞는 구현을 지연 로드 (웹 번들에 Tauri 코드가 섞이지 않도록) */
export async function getPlatform(): Promise<Platform> {
  return isTauri
    ? (await import('./tauri')).tauriPlatform
    : (await import('./web')).webPlatform
}
