import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { getPlatform } from './platform'

const platform = await getPlatform()

const app = mount(App, {
  target: document.getElementById('app')!,
  props: { platform },
})

// 첫 페인트 후 플랫폼 준비 (Tauri: 숨김 창 표시 / web: 서비스 워커 등록)
requestAnimationFrame(() => platform.ready())

export default app
