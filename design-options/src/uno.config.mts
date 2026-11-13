import { defineConfig, presetWind3 } from 'unocss'

/* UnoCSS setup for the three design prototypes. Same preset as the app (presetWind3).
   Night Console tokens use the n- prefix. The shipped app uses the same values unprefixed in /uno.config.mts. */
const mono = 'ui-monospace, "JetBrains Mono", "Cascadia Code", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      n: { bg: '#0f1b1b', panel: '#152524', raise: '#1c3130', deep: '#122020', pit: '#0a1313', line: '#2b4644', text: '#ebe6d6', muted: '#94a9a3', ember: '#ff7a50', mint: '#86e3c8', gold: '#e8c268', pink: '#f0a3c0', blue: '#9ec1ff', danger: '#ff9a86' },
    },
    fontFamily: {
      nsans: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif',
      code: mono,
    },
  },
  shortcuts: {
    'skip-link': 'absolute left-3 -top-16 z-10 rounded-lg px-3.5 py-2.5 focus:top-3',

    // Night Console
    'n-wrap': 'mx-auto max-w-280 px-3.5 md:px-6',
    'n-kbd': 'rounded border border-n-line bg-n-raise px-1.5 py-0.25 font-code text-xs text-n-text',
    'n-prose': 'mt-2.5 max-w-[68ch] font-nsans text-15px leading-relaxed text-n-muted',
    'n-code': 'rounded bg-n-raise px-1.5 py-0.25 font-code text-13px text-n-text',
    'n-btn': 'min-h-9.5 cursor-pointer rounded-1.5 border px-3.5 disabled:cursor-not-allowed disabled:opacity-45',
    'n-btn-quiet': 'n-btn border-n-line bg-n-raise hover:border-n-mint',
    'n-txt': 'cursor-pointer border-0 bg-transparent px-1 py-1.5 underline underline-offset-3',
    'n-cell': 'h-8.5 md:h-11 min-w-0 flex-1 border-0 bg-transparent text-13px text-n-text placeholder:text-[#6f8580] focus-visible:bg-n-raise focus-visible:[outline-offset:-2px]',
    'n-copy': 'min-h-7.5 shrink-0 cursor-pointer rounded-1.5 border border-n-line bg-n-panel px-2.5 text-xs hover:border-n-mint hover:text-n-mint',
    'n-field': 'h-9.5 w-full min-w-0 md:min-w-45 rounded-1.5 border border-n-line bg-n-panel px-2.5 text-n-text',
    'n-cmt': 'break-anywhere px-4 pb-0.5 pt-2.5 text-13px',
  },
  preflights: [{
    getCSS: () => `
*,*::before,*::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:currentColor}
[hidden]{display:none!important}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0}
body{background:#0f1b1b}
h1,h2,h3,p{margin:0;text-wrap:pretty}
button,input,select{font:inherit;color:inherit}
:where(.o2) :focus-visible{outline:2px solid #86e3c8;outline-offset:2px;border-radius:3px}
.o2{color-scheme:dark}
.flash-n{animation:flash-n .9s}
@keyframes flash-n{from{color:#e8c268}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.flash-n{animation:none}}
`,
  }],
})
