import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      ink: '#1c1c1a',
      paper: '#f4f1e8',
      cream: '#fffcf4',
      ember: '#de5833',
      line: '#d6d0c2',
      muted: '#68655d',
    },
    fontFamily: {
      display: ['Instrument Serif', 'Georgia', 'serif'],
      sans: ['DM Sans', 'Avenir Next', 'Segoe UI', 'sans-serif'],
      mono: ['IBM Plex Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
    },
  },
  shortcuts: {
    shell: 'mx-auto w-full max-w-6xl px-5 sm:px-8',
    eyebrow: 'font-mono text-11px font-medium uppercase tracking-0.18em',
  },
})
