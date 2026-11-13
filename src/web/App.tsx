import BangSettings from './BangSettings'
import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, '')

const INSTALL_SQL = `INSERT INTO "keywords" ("id", "short_name", "keyword", "favicon_url", "url", "safe_for_autoreplace", "originating_url", "date_created", "usage_count", "input_encodings", "suggest_url", "prepopulate_id", "created_by_policy", "last_modified", "sync_guid", "alternate_urls", "image_url", "search_url_post_params", "suggest_url_post_params", "image_url_post_params", "new_tab_url", "last_visited", "created_from_play_api")
VALUES (8195,
'emu search',
'emu',
'https://emu.sh/favicon.ico',
'https://search.emu.sh/search?q={searchTerms}',
0,
'https://search.emu.sh/osd.xml',
13265769204726412,
4,
'UTF-8',
'https://search.emu.sh/suggest?client=chrome-omni&q={searchTerms}',
0,
0,
13270754999736713,
'2f79ed5e-e746-4052-ab15-c5dcae786063',
'[]', '', '', '', '', '',
13273967198571427,
0);`

type Suggestion = {
  suggestion: string
  suggestType?: string | string[]
  suggestSubtypes?: Array<string | number>
  suggestDetail?: { a?: string; i?: string; t?: string }
}

const EXAMPLE_GROUPS: Array<{ title: string; examples: Array<[string, string]> }> = [
  {
    title: 'Rich answers',
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
    title: 'Network & web',
    examples: [
      ['dig emu.sh MX', 'DNS records'],
      ['whois emu.sh', 'RDAP registration'],
      ['ssl emu.sh', 'TLS certificate'],
      ['mailcheck emu.sh', 'MX, SPF, and DMARC'],
      ['8.8.8.8', 'IP geolocation'],
      ['https://search.emu.sh/?utm_source=demo', 'Redirects and clean URL'],
    ],
  },
  {
    title: 'Developer & research',
    examples: [
      ['npm react', 'npm package metadata'],
      ['gh vercel/vercel', 'GitHub repository'],
      ['mdn fetch', 'MDN search'],
      ['CVE-2021-44228', 'Vulnerability details'],
      ['isbn 9780306406157', 'Book lookup'],
      ['doi 10.1038/nature12373', 'DOI redirect'],
      ['arxiv:2103.00001', 'arXiv abstract'],
    ],
  },
  {
    title: 'Shortcuts & utilities',
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

function SearchIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
}

function SuggestionRow({ item, active, onSelect, id }: { item: Suggestion; active: boolean; onSelect: () => void; id: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const detail = item.suggestDetail
  const label = detail?.t || item.suggestion
  const isCalculator = Array.isArray(item.suggestType) ? item.suggestType.includes('CALCULATOR') : item.suggestType === 'CALCULATOR'
  const isPerson = item.suggestType === 'PERSON'
  const detailMeta = detail?.a && !label.includes(detail.a) ? detail.a : ''
  const meta = detailMeta || item.suggestSubtypes?.filter((type) => typeof type === 'string').join(' · ') || (isCalculator ? 'Calculator' : '')
  const image = detail?.i?.startsWith('//') ? `https:${detail.i}` : detail?.i

  return (
    <button id={id} type="button" role="option" aria-selected={active} className={`w-[calc(100%-16px)] flex items-center gap-3 text-left hover:bg-paper ${active ? 'bg-paper' : isPerson ? 'bg-[#f8fafc]' : 'bg-white'} ${isPerson ? 'mx-2 my-1 rounded-2xl p-4' : 'mx-2 rounded-xl px-3 py-2.5'}`} onClick={onSelect} onMouseDown={(event) => event.preventDefault()}>
      <span className={`${isPerson ? 'h-16 w-16 rounded-2xl' : 'h-9 w-9 rounded-lg'} flex shrink-0 items-center justify-center overflow-hidden bg-paper text-muted`}>
        {image && !imageFailed
          ? <img className="h-full w-full object-cover" src={image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          : <SearchIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-ink ${isPerson ? 'text-base font-semibold' : 'text-sm'}`}>{label}</span>
        {meta && <span className={`${isPerson ? 'mt-1 line-clamp-3 leading-5' : 'mt-0.5 truncate'} block text-xs text-muted`}>{meta}</span>}
        {isPerson && <span className="mt-1 block text-11px font-medium text-muted">Google · Person</span>}
      </span>
    </button>
  )
}

export default function App() {
  const [bangRevision, setBangRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [copied, setCopied] = useState(false)

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
      setIsOpen(true)
      try {
        const response = await fetch(`${API_BASE}/suggest?type=json&q=${encodeURIComponent(value)}`, { signal: controller.signal, credentials: 'include' })
        if (!response.ok) throw new Error(`Suggestion request failed: ${response.status}`)
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error('Unexpected suggestion response')
        setSuggestions((data as Suggestion[]).filter((item) => typeof item.suggestion === 'string').slice(0, 8))
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

  const runSearch = (value: string) => {
    const term = value.trim()
    if (term) window.location.assign(`${API_BASE}/search?q=${encodeURIComponent(term)}`)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    runSearch(activeIndex >= 0 && suggestions[activeIndex] ? suggestions[activeIndex].suggestion : query)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_SQL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const showSuggestions = isOpen && Boolean(query.trim())

  const runExample = (value: string) => {
    setQuery(value)
    setIsOpen(true)
    setActiveIndex(-1)
    window.scrollTo({ top: 0 })
    window.requestAnimationFrame(() => document.getElementById('search')?.focus())
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-ink">
      <a href="#main" className="absolute left-4 top-4 z-50 -translate-y-24 bg-ink px-4 py-3 text-sm text-white focus:translate-y-0">Skip to content</a>
      <header className="flex h-20 items-center justify-end px-6">
        <nav className="flex items-center gap-6 text-sm" aria-label="Main navigation"><a className="py-3 hover:text-ember" href="#bangs">Custom bangs</a><a className="py-3 hover:text-ember" href="#install">Install</a><a className="py-3 hover:text-ember" href="https://github.com/AskAlice/search.emu.sh" target="_blank" rel="noreferrer">GitHub</a></nav>
      </header>

      <main id="main">
        <section className="flex min-h-[calc(100vh-160px)] flex-col items-center px-5 pb-32 pt-12 sm:pt-20">
          <h1 className="text-48px font-medium tracking-[-0.045em] sm:text-64px">search.emu.sh</h1>
          <p className="mt-3 text-sm text-muted">Your omnibox, with richer answers.</p>

          <div className="mt-10 w-full max-w-xl">
            <form className={`relative bg-white ${showSuggestions ? 'rounded-3xl' : 'rounded-full shadow-[0_2px_10px_rgba(60,64,67,0.18)] focus-within:shadow-[0_4px_16px_rgba(60,64,67,0.22)]'}`} onSubmit={submit} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false) }}>
              <label htmlFor="search" className="sr-only">Search emu</label>
              <div className="flex h-14 items-center gap-3 px-5">
                <input
                  id="search"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions}
                  aria-controls="suggestions"
                  aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none ring-0 placeholder:text-muted/80 focus:outline-none focus:ring-0 focus-visible:outline-none"
                  placeholder="Search the web"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setIsOpen(true); setActiveIndex(-1) }}
                  onKeyDown={onKeyDown}
                  onFocus={() => setIsOpen(true)}
                />
                <button type="submit" aria-label="Submit search" className="h-11 w-11 flex shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-paper hover:text-ember">→</button>
              </div>

              {showSuggestions && <div className="overflow-hidden rounded-b-3xl pb-3 pt-1" id="suggestions" role="listbox" aria-label="Search suggestions">
                {loading && <p className="px-5 py-5 text-sm text-muted" role="status">Finding suggestions…</p>}
                {!loading && error && <p className="px-5 py-5 text-sm text-muted" role="status">{error}</p>}
                {!loading && !error && suggestions.length === 0 && <p className="px-5 py-5 text-sm text-muted" role="status">No suggestions. Press enter to search.</p>}
                {!loading && !error && suggestions.map((item, index) => <SuggestionRow key={`${item.suggestion}-${index}`} id={`suggestion-${index}`} item={item} active={activeIndex === index} onSelect={() => runSearch(item.suggestion)} />)}
              </div>}
            </form>
            <div className="mt-7 flex justify-center gap-3"><button type="button" className="min-h-11 rounded-full bg-white px-5 text-sm shadow-sm hover:bg-paper" onClick={() => runSearch(query)}>Emu Search</button><a className="min-h-11 flex items-center rounded-full bg-white px-5 text-sm shadow-sm hover:bg-paper" href="#install">Install in Chrome</a></div>
          </div>
        </section>

        <section id="examples" className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="eyebrow text-ember">Example directory</p>
            <h2 className="mt-3 text-32px font-semibold">Beyond Google suggestions</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">Select an example to run it. These answers, cards, tools, and redirects are added on top of Google’s autocomplete.</p>
            <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {EXAMPLE_GROUPS.map((group) => <div key={group.title}>
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <div className="mt-4 space-y-2">
                  {group.examples.map(([example, result]) => <button key={example} type="button" className="w-full rounded-xl bg-[#f8fafc] px-4 py-3 text-left hover:bg-paper" onClick={() => runExample(example)}>
                    <code className="block break-all font-mono text-xs text-ink">{example}</code>
                    <span className="mt-1 block text-11px text-muted">{result}</span>
                  </button>)}
                </div>
              </div>)}
            </div>
          </div>
        </section>

        <BangSettings api={API_BASE} onSave={() => setBangRevision(current => current + 1)} />

        <section id="install" className="scroll-mt-8 border-t border-line bg-paper">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="eyebrow text-ember">Chrome setup</p>
            <h2 className="mt-3 text-32px font-semibold">Add emu to your omnibox</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">Chrome stores search engines in a SQLite database. Close Chrome, back up the database, then run the query below.</p>

            <ol className="mt-10 space-y-8">
              <li><h3 className="font-semibold">1. Quit Chrome completely</h3><p className="mt-1 text-sm leading-6 text-muted">Close every Chrome window and check the system tray. The database must not be open or Chrome may overwrite your edit.</p></li>
              <li><h3 className="font-semibold">2. Back up “Web Data”</h3><p className="mt-1 text-sm leading-6 text-muted">Find your profile’s database and copy it somewhere safe. Replace <code className="font-mono">Default</code> with your profile folder if needed.</p><dl className="mt-4 space-y-2 break-all font-mono text-xs leading-5 text-muted"><div><dt className="inline text-ink">Windows: </dt><dd className="inline">%LOCALAPPDATA%\Google\Chrome\User Data\Default\Web Data</dd></div><div><dt className="inline text-ink">macOS: </dt><dd className="inline">~/Library/Application Support/Google/Chrome/Default/Web Data</dd></div><div><dt className="inline text-ink">Linux: </dt><dd className="inline">~/.config/google-chrome/Default/Web Data</dd></div></dl></li>
              <li><h3 className="font-semibold">3. Run the SQL</h3><p className="mt-1 text-sm leading-6 text-muted">Open the database with DB Browser for SQLite or another SQLite client. Paste the query, execute it, then save the database. If the ID or GUID already exists, change those two values.</p></li>
              <li><h3 className="font-semibold">4. Restart and search</h3><p className="mt-1 text-sm leading-6 text-muted">Open <code className="font-mono">chrome://settings/searchEngines</code> and make emu your default, or type <code className="font-mono">emu</code> then Tab in the omnibox.</p></li>
            </ol>

            <div className="mt-10 min-w-0 overflow-hidden rounded-lg bg-ink text-paper">
              <div className="flex items-center justify-between border-b border-paper/20 px-4 py-3"><span className="font-mono text-xs text-paper/60">install-emu.sql</span><button type="button" className="min-h-10 rounded-md bg-ember px-4 text-xs font-semibold text-white hover:bg-white hover:text-ink" onClick={copySql}>{copied ? 'Copied!' : 'Copy SQL'}</button></div>
              <pre className="code-scroll max-h-480px w-full min-w-0 max-w-full overflow-auto p-5 font-mono text-xs leading-6 text-paper/80" tabIndex={0}><code>{INSTALL_SQL}</code></pre>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper px-6 py-6 text-center text-xs text-muted">Rich suggestions, custom bangs, DNS, IP, and crypto answers.</footer>
      <span className="sr-only" aria-live="polite">{copied ? 'SQL copied to clipboard' : ''}</span>
    </div>
  )
}
