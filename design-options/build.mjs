// Builds the Night Console prototype (React + UnoCSS) into a standalone HTML file next to this script.
// Uses the repo's installed vite, @vitejs/plugin-react and unocss. Run: node design-options/build.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import UnoCSS from 'unocss/vite'
import { build } from 'vite'
import unoConfig from './src/uno.config.mts'

const here = path => fileURLToPath(new URL(path, import.meta.url))
const OPTIONS = [[2, 'Night Console']]

for (const [n, name] of OPTIONS) {
  const { output } = await build({
    configFile: false,
    root: here('./src'),
    logLevel: 'warn',
    resolve: { alias: { '#option': here(`./src/Option${n}.tsx`) } },
    plugins: [UnoCSS({ ...unoConfig, configFile: false }), react()],
    build: {
      write: false,
      cssCodeSplit: false,
      rollupOptions: { input: here('./src/main.tsx'), output: { format: 'iife' } },
    },
  })
  const js = output.find(file => file.type === 'chunk' && file.isEntry)
  const css = output.find(file => file.type === 'asset' && file.fileName.endsWith('.css'))
  if (!js || !css || output.filter(file => file.type === 'chunk').length !== 1) throw new Error(`Option ${n}: expected one script and one stylesheet`)
  // The bundle is inlined, so nothing in it may end the script element early.
  const script = js.code.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Emu Search design option ${n}: ${name}</title>
<style>${css.source}</style>
</head>
<body>
<div id="root"></div>
<script>${script}</script>
</body>
</html>
`
  writeFileSync(here(`./option-${n}.html`), html)
  console.log(`option-${n}.html  ${name}  ${(html.length / 1024).toFixed(0)} kB`)
}
