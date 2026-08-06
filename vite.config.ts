import { fileURLToPath } from 'node:url'
import { type UserConfig, defineConfig } from 'vite'

// GitHub Pages serves this project from https://<owner>.github.io/beat-swapper/
const BASE = '/beat-swapper/'

export default defineConfig(({ command, isPreview }): UserConfig => ({
  // preview では command が 'serve' になるので、明示的に本番と同じ base に揃える。
  // そうしないと dist の index.html が指す /beat-swapper/assets/* が 404 になる。
  base: command === 'build' || isPreview ? BASE : '/',
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
