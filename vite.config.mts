import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import unoConfig from './uno.config.mts'

export default defineConfig({
  root: fileURLToPath(new URL('./src/web', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('./dist/web', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    proxy: Object.fromEntries(['/bangs', '/search', '/suggest', '/icon', '/osd.xml', '/opensearch.xml'].map(path => [path, 'http://localhost:3006'])),
  },
  plugins: [UnoCSS(unoConfig), react()],
})
