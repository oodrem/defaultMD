import type { Platform } from './types'

// 2차(M10) 셸. 코드 서명 확보 전까지는 창 표시만 구현.
// TODO(M10): 실행 인자 + single-instance 이벤트, dialog/fs 플러그인, convertFileSrc
export const tauriPlatform: Platform = {
  kind: 'tauri',

  async ready() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    await win.show()
    await win.setFocus()
  },

  onLaunchFiles() {},
  openFiles: async () => [],
  filesFromDrop: async () => ({ files: [], folders: [] }),
  read: async () => null,
  stat: async () => null,
  save: async () => null,
  saveAs: async () => null,
  resolveAsset: async () => null,
  requestAssetAccess: async () => false,
  listRecent: async () => [],
  addRecent: async () => {},
  openRecent: async () => null,
  clearRecent: async () => {},
  isInstalled: () => true,
  onInstallAvailable() {},
  promptInstall: async () => false,
  saveSession() {},
  restoreSession: async () => ({ files: [], meta: null }),
}
