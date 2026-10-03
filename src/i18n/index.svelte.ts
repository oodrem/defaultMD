import ko from './ko.json'
import en from './en.json'

export type Lang = 'ko' | 'en'
type Key = keyof typeof ko

const dicts: Record<Lang, Record<Key, string>> = { ko, en }

function load(): Lang {
  try {
    const v = localStorage.getItem('lang')
    if (v === 'ko' || v === 'en') return v
  } catch {}
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export const i18n = $state({ lang: load() })
document.documentElement.lang = i18n.lang

export function t(key: Key, params?: Record<string, string>): string {
  const s = dicts[i18n.lang][key] ?? key
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : s
}

export function setLang(lang: Lang) {
  i18n.lang = lang
  document.documentElement.lang = lang
  try {
    localStorage.setItem('lang', lang)
  } catch {}
}
