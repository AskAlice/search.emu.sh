import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import * as E from './engine'
import type { Bang, Item, Os } from './engine'

const NO_ITEMS: Item[] = []

/** Inline SVG from the fixture art and icon strings. Size it with classes on the wrapper. */
export function Svg({ html, className = '' }: { html: string; className?: string }) {
  return <span aria-hidden="true" className={`inline-block [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" fill="#de5833" />
      <path d="M17 22l10 10-10 10M31 43h16" fill="none" stroke="#fffcf4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Image, colour swatch, or category icon for a suggestion. */
export function Thumb({ item, className = '', icon = 'w-5 h-5' }: { item: Item; className?: string; icon?: string }) {
  return (
    <span className={`grid place-items-center overflow-hidden shrink-0 ${className}`}>
      {item.swatch
        ? <span className="h-full w-full" style={{ background: item.swatch }} />
        : item.art ? <Svg html={item.art} className="h-full w-full" /> : <Svg html={item.icon} className={icon} />}
    </span>
  )
}

export function Sparkline({ points, className = '' }: { points: number[]; className?: string }) {
  const w = 120, h = 32
  const min = Math.min(...points), span = Math.max(...points) - min || 1
  const xy = points.map((p, i) => `${(i / (points.length - 1) * w).toFixed(1)},${(h - 3 - (p - min) / span * (h - 6)).toFixed(1)}`).join(' ')
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Seven day price trend">
      <polyline points={xy} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [shown, setShown] = useState(label)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // Clipboard API is blocked in some embedded previews: fall back to a selection copy.
      const area = Object.assign(document.createElement('textarea'), { value: text })
      area.style.cssText = 'position:fixed;opacity:0'
      document.body.append(area)
      area.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      area.remove()
    }
    setShown(ok ? 'Copied' : 'Copy blocked, select the text')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShown(label), 2000)
  }
  return <button type="button" className={className} onClick={copy}>{shown}</button>
}

export const STARTERS: Item[] = E.EXAMPLES.flatMap(group => group.items.map(([query, description]) => ({
  cat: group.cat, kind: 'example', title: query, sub: description, value: query, fill: true, tag: E.CAT_LABEL[group.cat], icon: E.ICON[group.cat],
})))

type ComboboxOptions = {
  listId: string
  /** Items shown while the query is empty. Keep the array identity stable between renders. */
  starters?: Item[]
  max?: number
  /** The list never closes (palette and board layouts). */
  persistent?: boolean
  initial?: string
  /** Bump to recompute suggestions after bangs are saved. */
  revision?: number
  /** Runs before search takes focus from elsewhere on the page. */
  onSummon?: () => void
}

/** Search box state: suggestions, highlight, keyboard handling and ARIA combobox wiring. */
export function useCombobox({ listId, starters = NO_ITEMS, max = 8, persistent = false, initial = '', revision = 0, onSummon }: ComboboxOptions) {
  const [query, setQuery] = useState(initial)
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(persistent || Boolean(initial))
  const [status, setStatus] = useState({ text: '', count: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const summon = useRef(onSummon)
  summon.current = onSummon

  // `revision` is a deliberate dependency: suggest() reads saved bangs.
  const items = useMemo(() => (query.trim() ? E.suggest(query).slice(0, max) : starters), [query, starters, max, revision])
  const shown = persistent || open
  const optionId = (index: number) => `${listId}-opt-${index}`
  const say = (text: string) => setStatus(current => ({ text, count: current.count + 1 }))
  const change = (value: string) => { setQuery(value); setActive(-1); setOpen(true) }
  const focusSoon = () => window.setTimeout(() => inputRef.current?.focus(), 0)

  const run = (item?: Item) => {
    if (!item) {
      const term = query.trim()
      if (term) say(`Prototype: this would open ${E.SEARCH}${encodeURIComponent(term)}`)
    } else if (item.fill || !item.url) {
      change(item.value)
      inputRef.current?.focus()
      say(`Completed “${item.value.trim()}”. Keep typing or press Enter.`)
    } else {
      say(`Prototype: this would open ${item.url}`)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length) {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(current => (current < 0 ? (step > 0 ? 0 : items.length - 1) : (current + step + items.length) % items.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(items[active])
    } else if (event.key === 'Tab' && !event.shiftKey && active >= 0 && items[active].value.trim() !== query.trim()) {
      event.preventDefault()
      change(items[active].value)
    } else if (event.key === 'Escape') {
      if (!persistent && open && items.length) setOpen(false)
      else if (query) change('')
    }
  }

  useEffect(() => { setActive(-1) }, [starters])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')) return
      event.preventDefault()
      summon.current?.()
      focusSoon()
    }
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [])

  // Keep the highlighted option inside a scrolling list without moving the page.
  useEffect(() => {
    const box = listRef.current, el = active >= 0 ? document.getElementById(`${listId}-opt-${active}`) : null
    if (!box || !el || box.scrollHeight <= box.clientHeight) return
    const top = el.offsetTop - box.offsetTop
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight
  }, [active, listId])

  return {
    query, items, active, shown, status, rootRef,
    /** The highlighted item, or the first one when nothing is highlighted. */
    current: (items[active] ?? items[0] ?? null) as Item | null,
    /** Put a query in the box from elsewhere on the page (examples, "Try" buttons). */
    set: (value: string) => { summon.current?.(); change(value); focusSoon() },
    clear: () => change(''),
    inputProps: {
      ref: inputRef, id: 'q', type: 'text', role: 'combobox', 'aria-autocomplete': 'list' as const, 'aria-expanded': shown && items.length > 0,
      'aria-controls': listId, 'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
      autoComplete: 'off', autoCapitalize: 'off', spellCheck: false, value: query,
      onChange: (event: { target: { value: string } }) => change(event.target.value),
      onKeyDown, onFocus: () => setOpen(true), onBlur: () => setOpen(false),
    },
    listProps: { ref: listRef, id: listId, role: 'listbox', hidden: !shown, onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault() },
    optionProps: (index: number) => ({
      id: optionId(index), role: 'option', 'aria-selected': index === active,
      onClick: () => run(items[index]), onMouseMove: () => { if (index !== active) setActive(index) },
    }),
  }
}

export type DraftBang = { key: number; name: string; aliasText: string; url: string; description: string }
let nextKey = 1
const toDraft = (bangs: Bang[]): DraftBang[] => bangs.map(b => ({ key: nextKey++, name: b.name, aliasText: b.aliases.join(', '), url: b.url, description: b.description }))
const fromDraft = (draft: DraftBang[]): Bang[] => draft.map(b => ({ name: b.name, aliases: b.aliasText.split(',').map(a => a.trim()).filter(Boolean), url: b.url, description: b.description }))

/** Bang editor state. Rows must render `data-row={index}` and a name input with `data-f="name"` so focus can follow edits. */
export function useBangs(onSave: () => void) {
  const [draft, setDraft] = useState(() => toDraft(E.loadBangs()))
  const [saved, setSaved] = useState(() => JSON.stringify(E.loadBangs()))
  const [message, setMessage] = useState({ text: '', error: false })
  /** Key of the row that needs the user's attention: newly added or failing validation. */
  const [attention, setAttention] = useState<{ key: number; invalid: boolean } | null>(null)
  const [focus, setFocus] = useState<{ row: number; tick: number } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!focus) return
    const target = formRef.current?.querySelector<HTMLElement>(`[data-row="${focus.row}"] [data-f="name"]`) ?? formRef.current?.querySelector<HTMLElement>('[data-act="add"]')
    target?.focus()
  }, [focus])

  const focusRow = (row: number) => setFocus(current => ({ row, tick: (current?.tick ?? 0) + 1 }))
  const say = (text: string, error = false) => setMessage({ text, error })

  return {
    draft, message, attention, formRef,
    dirty: JSON.stringify(fromDraft(draft)) !== saved,
    full: draft.length >= 20,
    host: E.host,
    clearAttention: () => setAttention(null),
    update: (index: number, patch: Partial<DraftBang>) => {
      setDraft(current => current.map((bang, i) => (i === index ? { ...bang, ...patch } : bang)))
      setAttention(current => (current?.invalid ? { ...current, invalid: false } : current))
      say('')
    },
    add: () => {
      const bang: DraftBang = { key: nextKey++, name: '', aliasText: '', url: 'https://', description: '' }
      setDraft(current => [...current, bang])
      setAttention({ key: bang.key, invalid: false })
      focusRow(draft.length)
      say('')
    },
    remove: (index: number) => {
      const gone = draft[index]
      setDraft(current => current.filter((_, i) => i !== index))
      focusRow(Math.min(index, draft.length - 2))
      say(`Removed ${gone.name ? `!${gone.name}` : 'the new bang'}. Save bangs to apply.`)
    },
    reset: () => {
      setDraft(toDraft(E.DEFAULT_BANGS))
      setAttention(null)
      say('Defaults restored. Save bangs to apply.')
    },
    submit: (event: FormEvent) => {
      event.preventDefault()
      try {
        const clean = E.saveBangs(fromDraft(draft))
        setDraft(current => current.map((bang, i) => ({ ...bang, name: clean[i].name, aliasText: clean[i].aliases.join(', '), url: clean[i].url, description: clean[i].description })))
        setSaved(JSON.stringify(clean))
        setAttention(null)
        say('Saved in this browser for one year.')
        onSave()
      } catch (cause) {
        const index = (cause as { index?: number }).index ?? -1
        say(cause instanceof Error ? cause.message : 'Unable to save bangs.', true)
        if (draft[index]) { setAttention({ key: draft[index].key, invalid: true }); focusRow(index) }
      }
    },
  }
}

const guessOs = (): Os => (/Windows/.test(navigator.userAgent) ? 'windows' : /Mac/.test(navigator.userAgent) ? 'macos' : 'linux')
export const OS_CHOICES: Array<[Os, string]> = [['macos', 'macOS'], ['linux', 'Linux'], ['windows', 'Windows']]

/** Install picker state and the commands it produces. */
export function useInstall() {
  const [os, setOs] = useState<Os>(guessOs)
  const [browser, setBrowser] = useState('chrome')
  const [profile, setProfile] = useState('Default')
  return { os, setOs, browser, setBrowser, profile, setProfile, plan: E.installPlan({ os, browser, profile }), browsers: E.BROWSERS, sql: E.SQL }
}
