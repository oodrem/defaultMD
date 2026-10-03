export type Theme = 'system' | 'light' | 'dark'

function load(): Theme {
  try {
    const v = localStorage.getItem('theme')
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return 'system'
}

export const themeState = $state({ theme: load() })

function apply(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

apply(themeState.theme)

export function setTheme(theme: Theme) {
  themeState.theme = theme
  apply(theme)
  try {
    localStorage.setItem('theme', theme)
  } catch {}
}

export function cycleTheme() {
  const t = themeState.theme
  setTheme(t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')
}
