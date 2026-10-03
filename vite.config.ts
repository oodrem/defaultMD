import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// 다이어그램(Mermaid)·수식(KaTeX)처럼 크고 드물게 쓰는 라이브러리는 assets/lazy/로 분리해
// 설치 시 미리 받지 않고(precache 제외) 처음 쓸 때 캐시한다
const LAZY_LIBS =
  /node_modules[\\/](mermaid|@mermaid-js|cytoscape[^\\/]*|elkjs|dagre-d3-es|d3[^\\/]*|khroma|katex|@vscode[\\/]markdown-it-katex|langium|chevrotain[^\\/]*|@chevrotain|roughjs|marked|dayjs|@iconify|@braintree|lodash-es|stylis|vscode-[^\\/]*|ts-dedent|uuid|cose-base|layout-base)[\\/]/
const isLazy = (ids: readonly string[] | undefined) => !!ids?.length && ids.some((id) => LAZY_LIBS.test(id))

// 상태바에 표시할 빌드 식별자 (캐시된 구버전인지 확인용)
const buildId = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

// 공통 프론트엔드: PWA(1차) + Tauri(2차) 겸용 설정
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // platform/web.ts에서 웹일 때만 등록
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'defaultMD',
        short_name: 'defaultMD',
        description: 'Lightweight Markdown viewer/editor',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0969da',
        icons: [
          { src: 'icons/192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // .md 파일 연결 (Edge 설치 시 OS에 등록)
        file_handlers: [
          {
            action: './',
            accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'] },
          },
        ],
        // 이미 열린 창이 있으면 새 창 대신 그 창으로 전달
        launch_handler: { client_mode: 'focus-existing' },
      } as Record<string, unknown>,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['**/assets/lazy/**'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/lazy\//,
            handler: 'CacheFirst',
            options: { cacheName: 'lazy-libs', expiration: { maxEntries: 500 } },
          },
        ],
        cleanupOutdatedCaches: true,
        // injectRegister: false일 때는 플러그인이 자동 설정하지 않음 → 새 버전이 대기 상태로 멈추지 않도록 명시
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${buildId})`),
  },
  // @vscode/markdown-it-katex가 자체 KaTeX를 갖고 있어 중복 번들 방지
  resolve: { dedupe: ['katex'] },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'chrome120',
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        chunkFileNames: (chunk) => (isLazy(chunk.moduleIds) ? 'assets/lazy/[name]-[hash].js' : 'assets/[name]-[hash].js'),
        assetFileNames: (asset) =>
          /^KaTeX_/.test(asset.names?.[0] ?? '') ? 'assets/lazy/[name]-[hash][extname]' : 'assets/[name]-[hash][extname]',
      },
    },
  },
})
