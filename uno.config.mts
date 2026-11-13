import { defineConfig, presetWind3 } from 'unocss'

// Night Console theme: dark green-black surfaces, sand text, ember for the prompt and
// selection, one accent per kind of suggestion (mint, gold, blue).
export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      night: '#0f1b1b',
      panel: '#152524',
      raise: '#1c3130',
      deep: '#122020',
      pit: '#0a1313',
      line: '#2b4644',
      sand: '#ebe6d6',
      muted: '#94a9a3',
      ember: '#ff7a50',
      mint: '#86e3c8',
      gold: '#e8c268',
      blue: '#9ec1ff',
      danger: '#ff9a86',
    },
    fontFamily: {
      sans: ['DM Sans', 'system-ui', 'Segoe UI', 'sans-serif'],
      mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
  },
  shortcuts: {
    shell: 'mx-auto w-full max-w-280 px-3.5 md:px-6',
    kbd: 'rounded border border-line bg-raise px-1.5 py-0.25 font-mono text-xs text-sand',
    prose: 'mt-2.5 max-w-[68ch] font-sans text-15px leading-relaxed text-muted',
    chip: 'rounded bg-raise px-1.5 py-0.25 font-mono text-13px text-sand',
    btn: 'min-h-9.5 cursor-pointer rounded-1.5 border px-3.5 disabled:cursor-not-allowed disabled:opacity-45',
    'btn-quiet': 'btn border-line bg-raise hover:border-mint',
    txt: 'cursor-pointer border-0 bg-transparent px-1 py-1.5 underline underline-offset-3',
    cell: 'h-8.5 md:h-11 min-w-0 flex-1 border-0 bg-transparent text-13px text-sand placeholder:text-[#6f8580] focus-visible:bg-raise focus-visible:[outline-offset:-2px]',
    copy: 'min-h-7.5 shrink-0 cursor-pointer rounded-1.5 border border-line bg-panel px-2.5 text-xs hover:border-mint hover:text-mint',
    field: 'h-9.5 w-full min-w-0 md:min-w-45 rounded-1.5 border border-line bg-panel px-2.5 text-sand',
    cmt: 'break-anywhere px-4 pb-0.5 pt-2.5 text-13px',
    heading: 'text-22px font-bold tracking-tight',
  },
})
