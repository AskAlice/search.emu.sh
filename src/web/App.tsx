import BangSettings from './BangSettings'
import Install from './Install'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, '')
const MAX_SUGGESTIONS = 9

type Suggestion = {
  suggestion: string
  suggestType?: string | string[]
  suggestSubtypes?: Array<string | number>
  suggestDetail?: { a?: string; i?: string; t?: string; dc?: string; entityInfo?: string; template?: string; website?: string; category?: string | string[] }
}

/** One line in the palette: either a live suggestion or a starter example. */
type Row = { key: string; tag: string; tone: string; title: string; sub: string; value: string; suggestion?: Suggestion }

const EXAMPLE_GROUPS: Array<{ tag: string; tone: string; examples: Array<[string, string]> }> = [
  {
    tag: 'Answer', tone: 'text-gold',
    examples: [
      ['brad pitt', 'Google person card'],
      ['5 btc', 'Live crypto price'],
      ['5 ft in in', 'Unit conversion'],
      ['100 usd eur', 'Currency conversion'],
      ['3pm utc est', 'Time-zone conversion'],
      ['1730000000', 'Unix timestamp'],
      ['#de5833', 'Color conversion'],
    ],
  },
  {
    tag: 'Network', tone: 'text-mint',
    examples: [
      ['emu.sh', 'DNS A records'],
      ['dig emu.sh MX', 'DNS records'],
      ['whois emu.sh', 'RDAP registration'],
      ['ssl emu.sh', 'TLS certificate'],
      ['mailcheck emu.sh', 'MX, SPF, and DMARC'],
      ['8.8.8.8', 'IP geolocation'],
      ['https://search.emu.sh/?utm_source=demo', 'Redirects and clean URL'],
    ],
  },
  {
    tag: 'Developer', tone: 'text-blue',
    examples: [
      ['npm react', 'npm package metadata'],
      ['gh vercel/vercel', 'GitHub repository'],
      ['mdn fetch', 'MDN search'],
      ['CVE-2021-44228', 'Vulnerability details'],
      ['isbn 9780306406157', 'Book lookup'],
      ['doi 10.1038/nature12373', 'DOI redirect'],
      ['arxiv:2103.00001', 'arXiv abstract'],
      ['movie dune', 'Movies from TMDB'],
      ['tv severance', 'TV shows from TMDB'],
    ],
  },
  {
    tag: 'Shortcut', tone: 'text-ember',
    examples: [
      ['!', 'Discover custom bangs'],
      ['!a Amazon', 'DuckDuckGo bangs'],
      ['track 1Z999AA10123456784', 'Shipment tracking'],
      ['flight UA1', 'Flight status'],
      ['urlencode hello world', 'URL encoding'],
      ['base64 encode hello', 'Base64 encoding'],
      ['uuid', 'Random UUID'],
    ],
  },
]

const STARTERS: Row[] = EXAMPLE_GROUPS.flatMap(group => group.examples.map(([value, sub]) => ({ key: `example-${value}`, tag: group.tag, tone: group.tone, title: value, sub, value })))

// Rich answers (DNS, colours, IP lookups) arrive as a `!redirect <url>` suggestion with the answer in the title.
const redirectTarget = (item: Suggestion) => /^!redirect\s+(\S+)/.exec(item.suggestion)?.[1]
const typesOf = (item: Suggestion) => (Array.isArray(item.suggestType) ? item.suggestType : item.suggestType ? [item.suggestType] : [])

function toRow(item: Suggestion, index: number): Row {
  const types = typesOf(item), detail = item.suggestDetail
  const [tag, tone] = redirectTarget(item) || types.includes('CALCULATOR') ? ['Answer', 'text-gold']
    : item.suggestion.startsWith('!') ? ['Bang', 'text-ember']
    : types.includes('PERSON') || types.includes('ENTITY') ? ['Knowledge', 'text-mint']
    : types.includes('NAVIGATION') ? ['Site', 'text-blue']
    : ['Search', 'text-muted']
  // Bang titles end in the (empty) query they would search for; drop that placeholder.
  const title = (detail?.t || item.suggestion).replace(/: undefined$/, '')
  const sub = (detail?.a && !title.includes(detail.a) ? detail.a : '') || item.suggestSubtypes?.filter(type => typeof type === 'string').join(', ') || ''
  return { key: `${item.suggestion}-${index}`, tag, tone, title, sub, value: item.suggestion, suggestion: item }
}

function SearchIcon({ className }: { className: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
}

function Picture({ detail }: { detail: Suggestion['suggestDetail'] }) {
  const [failed, setFailed] = useState(false)
  const image = detail?.i?.startsWith('//') ? `https:${detail.i}` : detail?.i
  const tinted = (detail?.entityInfo || detail?.template) && detail?.dc && /^#[0-9a-f]{6}$/i.test(detail.dc)
  return (
    <span style={tinted ? { backgroundColor: detail?.dc } : undefined} className="grid h-18 w-18 shrink-0 place-items-center overflow-hidden rounded-lg bg-raise text-muted">
      {image && !failed
        ? <img className="h-full w-full object-cover" src={image} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <SearchIcon className="h-7 w-7" />}
    </span>
  )
}

function Inspector({ row }: { row: Row | undefined }) {
  if (!row) return <p className="text-muted">No suggestions. Press Enter to search the web.</p>
  const item = row.suggestion
  if (!item) {
    return (
      <>
        <p className={`text-xs ${row.tone}`}>{row.tag} example</p>
        <h3 className="mt-0.5 break-anywhere text-xl font-bold leading-tight">{row.title}</h3>
        <p className="mt-0.5 font-sans text-sm text-muted">{row.sub}</p>
        <p className="mt-4 text-xs text-muted">Enter puts this in the prompt and shows its live answer.</p>
      </>
    )
  }
  const detail = item.suggestDetail, target = redirectTarget(item)
  const category = Array.isArray(detail?.category) ? detail.category.join(', ') : detail?.category
  const facts = [['Category', category], ['Website', detail?.website]].filter((fact): fact is [string, string] => Boolean(fact[1]))
  return (
    <>
      <div className="flex items-start gap-4">
        <Picture key={detail?.i ?? ''} detail={detail} />
        <div className="min-w-0">
          <p className={`text-xs ${row.tone}`}>{row.tag}</p>
          <h3 className={`mt-0.5 break-anywhere font-bold leading-tight ${row.tag === 'Answer' ? 'text-22px md:text-30px tracking-tight text-mint' : 'text-xl'}`}>{row.title}</h3>
          {!target && row.title !== item.suggestion && <p className="mt-1 break-anywhere text-xs text-muted">{item.suggestion}</p>}
        </div>
      </div>
      {row.sub && <p className="mt-3.5 max-w-[54ch] font-sans text-sm leading-relaxed">{row.sub}</p>}
      {facts.length > 0 && (
        <dl className="mb-0 mt-4.5 grid grid-cols-[max-content_minmax(0,1fr)] text-13px">
          {facts.map(([name, value]) => [
            <dt key={`${name}-name`} className="border-t border-line py-1.75 pr-5 text-muted">{name}</dt>,
            <dd key={`${name}-value`} className="m-0 break-anywhere border-t border-line py-1.75">{value}</dd>,
          ])}
        </dl>
      )}
      <p className="mt-4 break-anywhere text-xs text-muted">Enter opens <span className="text-sand">{target ?? `${API_BASE}/search?q=${encodeURIComponent(row.value)}`}</span></p>
    </>
  )
}

export default function App() {
  const [bangRevision, setBangRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState({ text: '', count: 0 })
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const value = query.trimStart()
    if (!value.trim()) {
      setSuggestions([])
      setError('')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE}/suggest?type=json&q=${encodeURIComponent(value)}`, { signal: controller.signal, credentials: 'include' })
        if (!response.ok) throw new Error(`Suggestion request failed: ${response.status}`)
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error('Unexpected suggestion response')
        setSuggestions((data as Suggestion[]).filter((item) => typeof item.suggestion === 'string').slice(0, MAX_SUGGESTIONS))
        setActiveIndex(-1)
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setSuggestions([])
        setError('Suggestions are unavailable right now. Search still works.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 75)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, bangRevision])

  // "/" focuses the prompt from anywhere outside a form control.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Keep the highlighted row inside the scrolling list without moving the page.
  useEffect(() => {
    const box = listRef.current, row = activeIndex >= 0 ? document.getElementById(`suggestion-${activeIndex}`) : null
    if (!box || !row) return
    const top = row.offsetTop - box.offsetTop
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight
  }, [activeIndex])

  const searching = Boolean(query.trim())
  const rows = searching ? suggestions.map(toRow) : STARTERS
  const current = rows[activeIndex] ?? rows[0]

  const change = (value: string) => {
    setQuery(value)
    setActiveIndex(-1)
    setNote(previous => (previous.text ? { ...previous, text: '' } : previous))
  }
  const fill = (value: string) => {
    change(value)
    setNote(previous => ({ text: `Completed “${value.trim()}”. Keep typing or press Enter.`, count: previous.count + 1 }))
    inputRef.current?.focus()
  }
  const runSearch = (value: string) => {
    const term = value.trim()
    if (term) window.location.assign(`${API_BASE}/search?q=${encodeURIComponent(term)}`)
  }
  const run = (row: Row | undefined) => {
    if (!row) runSearch(query)
    else if (row.suggestion) runSearch(row.value)
    else fill(row.value)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    run(rows[activeIndex])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && rows.length) {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(index => (index < 0 ? (step > 0 ? 0 : rows.length - 1) : (index + step + rows.length) % rows.length))
    } else if (event.key === 'Tab' && !event.shiftKey && activeIndex >= 0 && rows[activeIndex] && rows[activeIndex].value.trim() !== query.trim()) {
      event.preventDefault()
      fill(rows[activeIndex].value)
    } else if (event.key === 'Escape' && query) {
      change('')
    }
  }

  const status = error || (loading ? 'Finding suggestions…' : note.text)

  return (
    <div className="min-h-screen bg-night pb-px font-mono text-sm leading-normal text-sand">
      <a href="#main" className="absolute left-3 z-50 -translate-y-24 rounded bg-mint px-3.5 py-2.5 text-night focus:translate-y-3">Skip to content</a>
      <header className="shell flex items-center gap-2 py-3.5 md:gap-5">
        <a href="#main" className="flex items-center gap-2.5 font-bold text-sand no-underline"><img src="/favicon.svg" alt="" className="h-6 w-6" />search.emu.sh</a>
        <nav aria-label="Main navigation" className="ml-auto flex gap-0.5">
          {[['#bangs', 'bangs'], ['#install', 'install']].map(([href, label]) => (
            <a key={href} href={href} className="rounded-1.5 px-2 py-2 text-muted no-underline hover:bg-raise hover:text-sand md:px-3">{label}</a>
          ))}
          <a href="https://github.com/AskAlice/search.emu.sh" target="_blank" rel="noreferrer" className="rounded-1.5 px-2 py-2 text-muted no-underline hover:bg-raise hover:text-sand md:px-3">github</a>
        </nav>
      </header>

      <main id="main" className="shell">
        <h1 className="max-w-[22ch] pb-4 pt-5.5 text-26px font-bold leading-tight tracking-tighter md:pb-5.5 md:pt-9 md:text-40px">Answers in the address bar, before you press Enter.</h1>

        <form role="search" onSubmit={submit} className="overflow-hidden rounded-2.5 border border-line bg-panel shadow-[0_30px_60px_-30px_#000] focus-within:border-[#4b7a74]">
          <div className="flex h-14.5 items-center gap-3 border-b border-line px-4.5">
            <label htmlFor="search" className="whitespace-nowrap font-bold text-ember">emu ›<span className="sr-only"> search</span></label>
            <input
              ref={inputRef}
              id="search"
              type="text"
              enterKeyHint="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={rows.length > 0}
              aria-controls="suggestions"
              aria-activedescendant={activeIndex >= 0 && rows[activeIndex] ? `suggestion-${activeIndex}` : undefined}
              autoComplete="off"
              autoCapitalize="off"
              autoFocus
              spellCheck={false}
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-17px caret-ember outline-none placeholder:text-[#8a9f99]"
              placeholder="search, 5 btc, dig emu.sh MX, !a amazon"
              value={query}
              onChange={(event) => change(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <kbd className="kbd" title="Press / to focus search">/</kbd>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div ref={listRef} id="suggestions" role="listbox" aria-label={searching ? 'Search suggestions' : 'Example searches'} className="scroll-dark relative h-62 overflow-y-auto border-b border-line p-1.5 md:h-108 md:border-b-0 md:border-r" onMouseDown={(event) => event.preventDefault()}>
              {rows.map((row, index) => (
                <div key={row.key} id={`suggestion-${index}`} role="option" aria-selected={index === activeIndex} onClick={() => run(row)} onMouseMove={() => { if (index !== activeIndex) setActiveIndex(index) }}
                  className={`grid cursor-pointer grid-cols-[76px_minmax(0,1fr)] items-baseline gap-2.5 rounded-1.5 border-l-2 px-2.5 py-2 md:grid-cols-[92px_minmax(0,1fr)] ${index === activeIndex ? 'border-ember bg-raise' : 'border-transparent'}`}>
                  <span className={`truncate text-xs ${row.tone}`}>{row.tag}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{row.title}</span>
                    {row.sub && <span className="block truncate text-xs text-muted">{row.sub}</span>}
                  </span>
                </div>
              ))}
              {searching && rows.length === 0 && <p className="px-2.5 py-4 text-muted">{loading ? 'Finding suggestions…' : error || 'No suggestions. Press Enter to search.'}</p>}
            </div>
            <aside aria-label="Preview of the highlighted suggestion" className="scroll-dark min-h-55 overflow-y-auto bg-gradient-to-b from-[#172a29] to-panel px-4 py-4.5 md:h-108 md:px-6 md:py-5.5">
              <Inspector row={current} />
            </aside>
          </div>

          <div className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5 border-t border-line bg-deep px-4.5 py-2.5 text-xs text-muted">
            <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> move</span>
            <span><kbd className="kbd">Tab</kbd> complete</span>
            <span><kbd className="kbd">Enter</kbd> open</span>
            <span className="hidden md:inline"><kbd className="kbd">Esc</kbd> clear</span>
            <span className="hidden md:inline"><kbd className="kbd">/</kbd> focus</span>
            <span role="status" className={`w-full min-w-0 break-anywhere md:ml-auto md:w-auto ${error ? 'text-danger' : 'text-mint'}`}><span key={note.count} className="flash">{status}</span></span>
          </div>
        </form>

        <BangSettings api={API_BASE} onSave={() => setBangRevision(current => current + 1)} onTry={fill} />
        <Install />
      </main>

      <footer className="mt-20 border-t border-line p-6 text-center font-sans text-13px leading-relaxed text-muted">
        Rich suggestions, custom bangs, DNS, IP, and crypto answers.
        <div className="mt-3 flex flex-col items-center gap-2">
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"><img src="/icons/tmdb.svg" alt="TMDB" className="h-4 w-auto" /></a>
          <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </div>
      </footer>
    </div>
  )
}
