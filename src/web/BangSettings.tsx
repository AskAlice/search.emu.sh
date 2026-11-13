import { useEffect, useState } from 'react'

type Bang = { name: string; aliases: string[]; url: string; description: string }
export default function BangSettings({ api, onSave }: { api: string; onSave: () => void }) {
  const [bangs, setBangs] = useState<Bang[]>([])
  const [defaults, setDefaults] = useState<Bang[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${api}/bangs`, { credentials: 'include', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unable to load settings.')
      const data = await response.json()
      setBangs(data.bangs); setDefaults(data.defaults); setReady(true)
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message) })
    return () => controller.abort()
  }, [api])
  const update = (index: number, patch: Partial<Bang>) => {
    setBangs(current => current.map((bang, i) => i === index ? { ...bang, ...patch } : bang))
    setMessage('')
  }
  return <section id="bangs" className="border-t border-line bg-white">
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
      <h2 className="text-32px font-semibold">Custom bangs</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Add your shortcuts or edit the defaults. Use ~QUERYHERE~ in a URL for the search text. Settings are saved in this browser for one year and survive restarts, including for omnibox searches on this same domain. Clearing site cookies removes them.</p>
      {ready && <form className="mt-6 space-y-4" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setMessage('')
        try {
          const response = await fetch(`${api}/bangs`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bangs) })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || 'Unable to save settings.')
          setBangs(data.bangs); setMessage('Saved in this browser for one year.'); onSave()
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save settings.') }
        finally { setBusy(false) }
      }}>
        {bangs.map((bang, index) => <fieldset key={index} className="rounded-xl bg-paper p-4">
          <legend className="px-2 text-sm font-semibold">Shortcut {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">Name (without !)<input className="mt-1 block w-full rounded p-2 text-sm" required pattern="[a-zA-Z0-9_-]{1,32}" value={bang.name} onChange={event => update(index, { name: event.target.value, aliases: bang.aliases.filter(a => a !== bang.name) })} /></label>
            <label className="text-xs">Aliases (comma separated)<input className="mt-1 block w-full rounded p-2 text-sm" value={bang.aliases.filter(a => a !== bang.name).join(',')} onChange={event => update(index, { aliases: event.target.value.split(',').map(a => a.trim()).filter(Boolean) })} /></label>
            <label className="text-xs sm:col-span-2">URL<input className="mt-1 block w-full rounded p-2 text-sm" required value={bang.url} onChange={event => update(index, { url: event.target.value })} /></label>
            <label className="text-xs">Description<input className="mt-1 block w-full rounded p-2 text-sm" maxLength={120} value={bang.description} onChange={event => update(index, { description: event.target.value })} /></label>
          </div>
          <button type="button" className="mt-3 px-3 py-2 text-sm" onClick={() => { setBangs(current => current.filter((_, i) => i !== index)); setMessage('') }}>Remove shortcut {index + 1}</button>
        </fieldset>)}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={bangs.length >= 20} className="rounded-full bg-paper px-5 py-3 text-sm" onClick={() => { setBangs(current => [...current, { name: '', aliases: [], url: 'https://', description: '' }]); setMessage('') }}>Add bang</button>
          <button type="button" className="rounded-full bg-paper px-5 py-3 text-sm" onClick={() => { setBangs(defaults); setMessage('Defaults restored. Save to apply.') }}>Restore defaults</button>
          <button type="submit" disabled={busy} className="rounded-full bg-ink px-5 py-3 text-sm text-white">{busy ? 'Saving…' : 'Save bangs'}</button>
        </div>
      </form>}
      <p role="status" className="mt-4 text-sm">{message}</p>
    </div>
  </section>
}
