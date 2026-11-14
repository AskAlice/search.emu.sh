import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

type Bang = { name: string; aliases: string[]; url: string; description: string }
// Aliases stay as typed text while editing so commas and spaces are not eaten mid-keystroke.
type Draft = { key: number; name: string; aliasText: string; url: string; description: string }

const MAX_BANGS = 20
let nextKey = 1
const toDraft = (bangs: Bang[]): Draft[] => bangs.map(bang => ({ key: nextKey++, name: bang.name, aliasText: bang.aliases.filter(alias => alias !== bang.name).join(', '), url: bang.url, description: bang.description }))
const fromDraft = (draft: Draft[]): Bang[] => draft.map(bang => ({ name: bang.name.trim(), aliases: bang.aliasText.split(',').map(alias => alias.trim()).filter(Boolean), url: bang.url.trim(), description: bang.description.trim() }))
const fingerprint = (draft: Draft[]) => JSON.stringify(fromDraft(draft))

const COLUMNS = 'md:grid-cols-[140px_170px_minmax(0,1fr)_210px_130px]'
const CELL = 'flex min-w-0 flex-wrap items-center rounded-1.5 bg-deep md:flex-nowrap md:rounded-none md:border-r md:border-line md:bg-transparent'
const CELL_LABEL = 'w-full px-3 pt-1.25 text-11px text-muted md:hidden'

export default function BangSettings({ api, onSave, onTry }: { api: string; onSave: () => void; onTry: (query: string) => void }) {
  const [draft, setDraft] = useState<Draft[]>([])
  const [defaults, setDefaults] = useState<Bang[]>([])
  const [saved, setSaved] = useState('[]')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ text: '', error: false })
  const [focus, setFocus] = useState<{ row: number; tick: number } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${api}/bangs`, { credentials: 'include', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unable to load your bangs. Reload the page to try again.')
      const data: { bangs: Bang[]; defaults: Bang[] } = await response.json()
      const loaded = toDraft(data.bangs)
      setDraft(loaded); setSaved(fingerprint(loaded)); setDefaults(data.defaults); setReady(true)
    }).catch(error => { if (!controller.signal.aborted) setMessage({ text: error instanceof Error ? error.message : 'Unable to load your bangs.', error: true }) })
    return () => controller.abort()
  }, [api])

  // After adding or removing a row, move focus to the row the user will act on next.
  useEffect(() => {
    if (!focus) return
    const target = formRef.current?.querySelector<HTMLElement>(`[data-row="${focus.row}"] input`) ?? formRef.current?.querySelector<HTMLElement>('[data-add]')
    target?.focus()
  }, [focus])
  const focusRow = (row: number) => setFocus(current => ({ row, tick: (current?.tick ?? 0) + 1 }))

  const update = (index: number, patch: Partial<Draft>) => {
    setDraft(current => current.map((bang, i) => (i === index ? { ...bang, ...patch } : bang)))
    setMessage({ text: '', error: false })
  }
  const add = () => {
    setDraft(current => [...current, { key: nextKey++, name: '', aliasText: '', url: 'https://', description: '' }])
    focusRow(draft.length)
    setMessage({ text: '', error: false })
  }
  const remove = (index: number) => {
    const gone = draft[index]
    setDraft(current => current.filter((_, i) => i !== index))
    focusRow(Math.min(index, draft.length - 2))
    setMessage({ text: `Removed ${gone.name ? `!${gone.name}` : 'the new bang'}. Save bangs to apply.`, error: false })
  }
  const restore = () => {
    setDraft(toDraft(defaults))
    setMessage({ text: 'Defaults restored. Save bangs to apply.', error: false })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage({ text: '', error: false })
    try {
      const response = await fetch(`${api}/bangs`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fromDraft(draft)) })
      const data: { bangs?: Bang[]; error?: string } = await response.json()
      if (!response.ok || !data.bangs) throw new Error(data.error || 'Unable to save bangs.')
      const clean = toDraft(data.bangs)
      setDraft(clean); setSaved(fingerprint(clean))
      setMessage({ text: 'Saved in this browser for one year.', error: false })
      onSave()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to save bangs.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const dirty = ready && fingerprint(draft) !== saved

  return (
    <section id="bangs" className="scroll-mt-6 pt-13 md:pt-18">
      <h2 className="heading">Custom bangs</h2>
      <p className="prose">Shortcuts that jump straight to a site’s own search: <code className="chip">!orders usb-c cable</code>. Put <code className="chip">~QUERYHERE~</code> where the search text goes. Saved in this browser for one year, and used by omnibox searches on this domain too. Clearing site cookies removes them. Bangs you have not defined fall through to DuckDuckGo.</p>

      {ready && (
        <form ref={formRef} onSubmit={submit}>
          <div className="mt-6 overflow-hidden rounded-2.5 border border-line bg-panel">
            <div aria-hidden="true" className={`hidden border-b border-line bg-deep text-xs text-muted md:grid ${COLUMNS}`}>
              {['bang', 'aliases', 'url template', 'description', ''].map(label => <span key={label} className="px-3 py-2.25">{label}</span>)}
            </div>
            {draft.length === 0 && <p className="p-6.5 text-center text-muted">No custom bangs yet. Add one to create your first shortcut.</p>}
            {draft.map((bang, i) => (
              <div key={bang.key} data-row={i} className={`grid grid-cols-2 gap-2 border-b border-line p-3 md:gap-0 md:p-0 ${COLUMNS}`}>
                <label className={CELL}><span className={CELL_LABEL}>Bang</span><span aria-hidden="true" className="pl-3 font-bold text-ember">!</span>
                  <input aria-label="Bang name, without the !" required pattern="[a-zA-Z0-9_-]{1,32}" title="Letters, numbers, _ or -, up to 32 characters" value={bang.name} placeholder="name" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={event => update(i, { name: event.target.value })} className="cell pl-0.5 pr-3" />
                </label>
                <label className={CELL}><span className={CELL_LABEL}>Aliases</span>
                  <input aria-label="Aliases, comma separated" value={bang.aliasText} placeholder="none" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={event => update(i, { aliasText: event.target.value })} className="cell px-3" />
                </label>
                <label className={`${CELL} col-span-2 md:col-span-1`}><span className={CELL_LABEL}>URL template</span>
                  <input aria-label="URL template" required maxLength={1000} value={bang.url} inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={event => update(i, { url: event.target.value })} className="cell px-3" />
                </label>
                <label className={`${CELL} col-span-2 md:col-span-1`}><span className={CELL_LABEL}>Description</span>
                  <input aria-label="Description" maxLength={120} value={bang.description} placeholder="optional" onChange={event => update(i, { description: event.target.value })} className="cell px-3" />
                </label>
                <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-1 md:px-2.5">
                  {bang.name.trim() && <button type="button" aria-label={`Try !${bang.name}`} className="txt text-mint" onClick={() => onTry(`!${bang.name.trim()} `)}>Try</button>}
                  <button type="button" aria-label={`Remove ${bang.name ? `!${bang.name}` : 'new bang'}`} className="txt text-danger" onClick={() => remove(i)}>Remove</button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2.5 bg-deep p-3">
              <button type="button" data-add disabled={draft.length >= MAX_BANGS} onClick={add} className="btn-quiet">Add bang</button>
              <button type="button" onClick={restore} className="btn-quiet">Restore defaults</button>
              <span className="text-xs text-muted">{draft.length} of {MAX_BANGS}</span>
              <span className="flex-1" />
              {dirty && <span className="text-xs text-gold">Unsaved changes</span>}
              <button type="submit" disabled={busy} className="btn border-ember bg-ember font-bold text-[#1b0d07] hover:bg-[#ff8f6a]">{busy ? 'Saving…' : 'Save bangs'}</button>
            </div>
          </div>
        </form>
      )}
      <p role="status" className={`mt-3 min-h-5.5 ${message.error ? 'text-danger' : 'text-mint'}`}>{message.text}</p>
    </section>
  )
}
