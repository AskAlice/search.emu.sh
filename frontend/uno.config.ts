import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      ink: '#202124',
      paper: '#f1f3f4',
      cream: '#ffffff',
      ember: '#1a73e8',
      line: '#e0e3e7',
      muted: '#5f6368',
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
