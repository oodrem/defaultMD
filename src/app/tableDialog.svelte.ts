import type { Table } from '../markdown/table'

interface Request {
  table: Table
  isNew: boolean
  resolve(result: Table | null): void
}

export const tableDialog = $state({ current: null as Request | null })

/** 표 편집기 열기. 적용하면 수정된 표, 취소하면 null */
export function editTable(table: Table, isNew = false): Promise<Table | null> {
  return new Promise((resolve) => {
    tableDialog.current = {
      table: { rows: table.rows.map((r) => [...r]), aligns: [...table.aligns] },
      isNew,
      resolve(result) {
        tableDialog.current = null
        resolve(result)
      },
    }
  })
}
