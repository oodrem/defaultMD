// 상태바 알림, 확인 대화상자(브라우저 confirm() 대신 앱 내 모달), 컨텍스트 메뉴

export const status = $state({ message: '' })
let timer: ReturnType<typeof setTimeout> | undefined

export function notify(message: string) {
  status.message = message
  clearTimeout(timer)
  timer = setTimeout(() => (status.message = ''), 4000)
}

// ── 대화상자 ──

export interface DialogButton {
  id: string
  label: string
  primary?: boolean
}

export interface DialogItem {
  label: string
  checked: boolean
}

interface DialogRequest {
  message: string
  buttons: DialogButton[]
  /** 있으면 체크박스 목록 표시 */
  items?: DialogItem[]
  /** 있으면 텍스트 입력 칸 표시 (값은 입력에 따라 갱신됨) */
  input?: { value: string; placeholder?: string }
  resolve(id: string): void
}

export const dialog = $state({ current: null as DialogRequest | null })

/** 모달을 띄우고 누른 버튼 id를 반환. Esc는 'cancel' */
export function ask(message: string, buttons: DialogButton[]): Promise<string> {
  return new Promise((resolve) => {
    dialog.current = {
      message,
      buttons,
      resolve(id) {
        dialog.current = null
        resolve(id)
      },
    }
  })
}

/** 체크박스 목록에서 고르기. 선택한 인덱스 배열, 취소 시 null */
export function askList(
  message: string,
  labels: string[],
  okLabel: string,
  cancelLabel: string,
): Promise<number[] | null> {
  return new Promise((resolve) => {
    dialog.current = {
      message,
      items: labels.map((label) => ({ label, checked: labels.length <= 20 })),
      buttons: [
        { id: 'ok', label: okLabel, primary: true },
        { id: 'cancel', label: cancelLabel },
      ],
      resolve(id) {
        const items = dialog.current?.items ?? []
        dialog.current = null
        resolve(id === 'ok' ? items.flatMap((it, i) => (it.checked ? [i] : [])) : null)
      },
    }
  })
}

/** 텍스트 한 줄 입력받기. 취소 시 null */
export function askText(
  message: string,
  initial: string,
  okLabel: string,
  cancelLabel: string,
  placeholder?: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    dialog.current = {
      message,
      input: { value: initial, placeholder },
      buttons: [
        { id: 'ok', label: okLabel, primary: true },
        { id: 'cancel', label: cancelLabel },
      ],
      resolve(id) {
        const value = dialog.current?.input?.value ?? ''
        dialog.current = null
        resolve(id === 'ok' ? value : null)
      },
    }
  })
}

// ── 앱 상태 (설치 · 기본 앱 안내 창) ──

export const appState = $state({ installable: false, installed: false, guideOpen: false })

// ── 컨텍스트 메뉴 / 드롭다운 ──

export interface MenuItem {
  label: string
  action?: () => void
  disabled?: boolean
  /** 앞에 구분선 */
  separator?: boolean
}

export const menu = $state({ current: null as { x: number; y: number; items: MenuItem[] } | null })

export function showMenu(x: number, y: number, items: MenuItem[]) {
  menu.current = { x, y, items }
}

export function hideMenu() {
  menu.current = null
}
