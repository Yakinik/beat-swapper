import { fileURLToPath } from 'node:url'
import { type Plugin, type UserConfig, defineConfig } from 'vite'

// GitHub Pages serves this project from https://<owner>.github.io/beat-swapper/
const BASE = '/beat-swapper/'

const BANNER =
  '/*! beat-swapper — AGPL-3.0. Bundled third-party software and their licenses:' +
  ` ${BASE}THIRD-PARTY-NOTICES.txt */`

/**
 * 最小化すると第三者のヘッダコメント（essentia.js の AGPL 表示など）は落ちる。
 * 告知の在り処だけは必ず残す。`rollupOptions.output.banner` は Rolldown では
 * 効かなかったので、最小化のあとに走る generateBundle で足している。
 */
const licenseBanner = (): Plugin => ({
  name: 'license-banner',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') file.code = `${BANNER}\n${file.code}`
    }
  },
})

export default defineConfig(({ command, isPreview }): UserConfig => ({
  // preview では command が 'serve' になるので、明示的に本番と同じ base に揃える。
  // そうしないと dist の index.html が指す /beat-swapper/assets/* が 404 になる。
  base: command === 'build' || isPreview ? BASE : '/',
  plugins: [licenseBanner()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Preact JSX through Oxc — no Babel, no extra plugin.
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'preact',
    },
  },
  css: {
    modules: {
      generateScopedName:
        command === 'build' ? '[hash:base64:5]' : '[name]__[local]',
    },
  },
  // essentia.js is a 2.5MB emscripten bundle with the wasm inlined as base64.
  // It is imported only from the analysis worker, so keep it out of the dev
  // server's dependency pre-bundling.
  optimizeDeps: {
    exclude: ['essentia.js'],
  },
  worker: {
    format: 'es',
    // ワーカーは別ビルドなので、バナーもこちらへ入れる
    plugins: () => [licenseBanner()],
  },
  build: {
    target: 'es2022',
    cssTarget: ['chrome111', 'safari16.4'],
    assetsInlineLimit: 4096,
    reportCompressedSize: true,
    // The analysis worker chunk is the wasm payload; do not warn about it.
    chunkSizeWarningLimit: 3000,
  },
}))
