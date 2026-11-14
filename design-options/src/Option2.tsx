import { useState } from 'react'
import * as E from './engine'
import type { Cat, Item } from './engine'
import { CopyButton, Logo, OS_CHOICES, STARTERS, Sparkline, Thumb, useBangs, useCombobox, useInstall } from './shared'

/* Option 2, Night Console: a keyboard-first command palette. List on the left, live inspector on the right. */

const TAG_COLOR: Partial<Record<Cat, string>> = { bang: 'text-n-ember', network: 'text-n-mint', money: 'text-n-gold', media: 'text-n-pink', dev: 'text-n-blue' }
const tagColor = (item: Item) => TAG_COLOR[item.cat] ?? 'text-n-muted'

function Inspector({ item }: { item: Item | null }) {
  if (!item) return <p className="text-n-muted">Nothing to preview. Press Enter to search the web.</p>
  const isExample = item.kind === 'example'
  const shown = isExample ? E.suggest(item.value)[0] : item
  return (
    <>
      {isExample && <p className="mb-3.5 text-xs text-n-muted">Preview of “{item.value}”. Press Enter to run it.</p>}
      <div className="flex items-start gap-4">
        <Thumb item={shown} className={`w-18 rounded-lg bg-n-raise text-n-muted ${shown.poster ? 'h-27' : 'h-18'}`} icon="w-7 h-7" />
        <div className="min-w-0">
          <p className={`text-xs ${tagColor(shown)}`}>{shown.tag}</p>
          <h3 className="mt-0.5 break-anywhere text-xl font-bold leading-tight">{shown.title}</h3>
          {shown.sub && <p className="mt-0.5 font-nsans text-sm text-n-muted">{shown.sub}</p>}
        </div>
      </div>
      {shown.big && <p className="mt-4.5 break-anywhere text-22px md:text-30px font-bold leading-tight tracking-tight text-n-mint">{shown.big}</p>}
      {shown.spark && <Sparkline points={shown.spark} className="mt-2.5 block h-9 w-45 text-n-gold" />}
      {shown.text && <p className="mt-3.5 max-w-[54ch] font-nsans text-sm leading-relaxed">{shown.text}</p>}
      {shown.rows && (
        <dl className="mb-0 mt-4.5 grid grid-cols-[max-content_minmax(0,1fr)] text-13px">
          {shown.rows.map(([key, value], i) => [
            <dt key={`k${i}`} className="border-t border-n-line py-1.75 pr-5 text-n-muted">{key}</dt>,
            <dd key={`v${i}`} className="m-0 break-anywhere border-t border-n-line py-1.75">{value}</dd>,
          ])}
        </dl>
      )}
      <p className="mt-4 break-anywhere text-xs text-n-muted">{shown.url ? <>Enter opens <span className="text-n-text">{shown.url}</span></> : 'Enter completes this in the prompt'}</p>
    </>
  )
}

function Line({ out, text }: { out: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5 pl-4 pr-2 hover:bg-[#101e1e]">
      <span aria-hidden="true" className="font-bold text-n-ember">$</span>
      <code data-out={out} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-2 font-code text-13px text-n-text">{text}</code>
      <CopyButton text={text} className="n-copy" />
    </div>
  )
}

export default function Option2() {
  const [revision, setRevision] = useState(0)
  const search = useCombobox({ listId: 'sug', starters: STARTERS, persistent: true, max: 9, revision })
  const bangs = useBangs(() => setRevision(current => current + 1))
  const install = useInstall()

  return (
    <div className="o2 min-w-80 bg-n-bg pb-px font-code text-sm leading-normal text-n-text antialiased">
      <a href="#main" className="skip-link bg-n-mint text-n-bg">Skip to content</a>
      <header className="n-wrap flex items-center gap-2 py-3.5 md:gap-5">
        <a href="#main" className="flex items-center gap-2.5 font-bold text-n-text no-underline"><Logo className="h-6 w-6" />emu search</a>
        <nav aria-label="Main" className="ml-auto flex gap-0.5">
          {[['#main', 'search'], ['#bangs', 'bangs'], ['#install', 'install']].map(([href, label]) => (
            <a key={href} href={href} className="rounded-1.5 px-2 md:px-3 py-2 text-n-muted no-underline hover:bg-n-raise hover:text-n-text">{label}</a>
          ))}
        </nav>
      </header>

      <main id="main" className="n-wrap">
        <h1 className="max-w-[22ch] pb-4 pt-5.5 text-26px font-bold leading-tight tracking-tighter md:pb-5.5 md:pt-9 md:text-40px">Answers in the address bar, before you press Enter.</h1>

        <section ref={search.rootRef} aria-label="Search" className="overflow-hidden rounded-2.5 border border-n-line bg-n-panel shadow-[0_30px_60px_-30px_#000] focus-within:border-[#4b7a74]">
          <div className="flex h-14.5 items-center gap-3 border-b border-n-line px-4.5">
            <label htmlFor="q" className="whitespace-nowrap font-bold text-n-ember">emu ›</label>
            <input {...search.inputProps} placeholder="search, 5 btc, dig emu.sh MX, !gh fastify" className="h-full min-w-0 flex-1 border-0 bg-transparent text-17px caret-n-ember outline-none placeholder:text-[#8a9f99]" />
            <kbd className="n-kbd" title="Press / to focus search">/</kbd>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div {...search.listProps} aria-label="Suggestions" className="relative h-62 overflow-y-auto border-b border-n-line p-1.5 md:h-108 md:border-b-0 md:border-r">
              {search.items.map((item, i) => (
                <div key={`${item.kind}-${item.value}-${i}`} {...search.optionProps(i)} className={`grid cursor-pointer grid-cols-[76px_minmax(0,1fr)] md:grid-cols-[92px_minmax(0,1fr)] items-baseline gap-2.5 rounded-1.5 border-l-2 px-2.5 py-2 ${i === search.active ? 'border-n-ember bg-n-raise' : 'border-transparent'}`}>
                  <span className={`truncate text-xs ${tagColor(item)}`}>{item.tag}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{item.title}</span>
                    {item.sub && <span className="block truncate text-xs text-n-muted">{item.sub}</span>}
                  </span>
                </div>
              ))}
            </div>
            <aside id="insp" aria-label="Preview of the highlighted suggestion" className="min-h-55 overflow-y-auto bg-gradient-to-b from-[#172a29] to-n-panel px-4 py-4.5 md:h-108 md:px-6 md:py-5.5">
              <Inspector item={search.current} />
            </aside>
          </div>
          <div className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5 border-t border-n-line bg-n-deep px-4.5 py-2.5 text-xs text-n-muted">
            <span><kbd className="n-kbd">↑</kbd> <kbd className="n-kbd">↓</kbd> move</span>
            <span><kbd className="n-kbd">Tab</kbd> complete</span>
            <span><kbd className="n-kbd">Enter</kbd> open</span>
            <span className="hidden md:inline"><kbd className="n-kbd">Esc</kbd> clear</span>
            <span className="hidden md:inline"><kbd className="n-kbd">/</kbd> focus</span>
            <span id="status" role="status" aria-live="polite" className="min-w-0 w-full break-anywhere text-n-mint md:ml-auto md:w-auto"><span key={search.status.count} className="flash-n">{search.status.text}</span></span>
          </div>
        </section>

        <section id="bangs" className="pt-13 md:pt-18">
          <h2 className="text-22px font-bold tracking-tight">Custom bangs</h2>
          <p className="n-prose">Shortcuts that jump straight to a site’s own search: <code className="n-code">!orders usb-c cable</code>. Put <code className="n-code">~QUERYHERE~</code> where the search text goes. Saved in this browser for one year, and used by the address bar too. Bangs you have not defined fall through to DuckDuckGo.</p>
          <form ref={bangs.formRef} data-bangs noValidate onSubmit={bangs.submit}>
            <div className="mt-6 overflow-hidden rounded-2.5 border border-n-line bg-n-panel">
              <div aria-hidden="true" className="hidden border-b border-n-line bg-n-deep text-xs text-n-muted md:grid md:grid-cols-[140px_170px_minmax(0,1fr)_210px_130px]">
                {['bang', 'aliases', 'url template', 'description', ''].map(label => <span key={label} className="px-3 py-2.25">{label}</span>)}
              </div>
              {bangs.draft.length === 0 && <p className="p-6.5 text-center text-n-muted">No custom bangs yet. Add one to create your first shortcut.</p>}
              {bangs.draft.map((bang, i) => {
                const invalid = bangs.attention?.invalid && bangs.attention.key === bang.key
                const cell = 'flex min-w-0 flex-wrap items-center rounded-1.5 bg-n-deep md:flex-nowrap md:rounded-none md:border-r md:border-n-line md:bg-transparent'
                const label = 'w-full px-3 pt-1.25 text-11px text-n-muted md:hidden'
                return (
                  <div key={bang.key} data-row={i} className="grid grid-cols-2 gap-2 border-b border-n-line p-3 md:grid-cols-[140px_170px_minmax(0,1fr)_210px_130px] md:gap-0 md:p-0">
                    <label className={`${cell} ${invalid ? 'shadow-[inset_0_-2px_#ff9a86]' : ''}`}><span className={label}>Bang</span><span aria-hidden="true" className="pl-3 font-bold text-n-ember">!</span>
                      <input data-f="name" aria-label="Bang name" aria-invalid={invalid || undefined} value={bang.name} maxLength={32} placeholder="name" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={event => bangs.update(i, { name: event.target.value })} className="n-cell pl-0.5 pr-3" />
                    </label>
                    <label className={cell}><span className={label}>Aliases</span>
                      <input data-f="aliases" aria-label="Aliases, comma separated" value={bang.aliasText} placeholder="none" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={event => bangs.update(i, { aliasText: event.target.value })} className="n-cell px-3" />
                    </label>
                    <label className={`${cell} col-span-2 md:col-span-1`}><span className={label}>URL template</span>
                      <input data-f="url" aria-label="URL template" value={bang.url} inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={event => bangs.update(i, { url: event.target.value })} className="n-cell px-3" />
                    </label>
                    <label className={`${cell} col-span-2 md:col-span-1`}><span className={label}>Description</span>
                      <input data-f="description" aria-label="Description" value={bang.description} maxLength={120} placeholder="optional" onChange={event => bangs.update(i, { description: event.target.value })} className="n-cell px-3" />
                    </label>
                    <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-1 md:px-2.5">
                      {bang.name && <button type="button" aria-label={`Try !${bang.name}`} className="n-txt text-n-mint" onClick={() => search.set(`!${bang.name} `)}>Try</button>}
                      <button type="button" data-act="remove" aria-label={`Remove ${bang.name ? `!${bang.name}` : 'new bang'}`} className="n-txt text-n-danger" onClick={() => bangs.remove(i)}>Remove</button>
                    </div>
                  </div>
                )
              })}
              <div className="flex flex-wrap items-center gap-2.5 bg-n-deep p-3">
                <button type="button" data-act="add" disabled={bangs.full} onClick={bangs.add} className="n-btn-quiet">Add bang</button>
                <button type="button" data-act="reset" onClick={bangs.reset} className="n-btn-quiet">Restore defaults</button>
                <span data-bangs-count className="text-xs text-n-muted">{bangs.draft.length} of 20</span>
                <span className="flex-1" />
                {bangs.dirty && <span data-dirty className="text-xs text-n-gold">Unsaved changes</span>}
                <button type="submit" className="n-btn border-n-ember bg-n-ember font-bold text-[#1b0d07] hover:bg-[#ff8f6a]">Save bangs</button>
              </div>
            </div>
            <p data-bangs-msg role="status" aria-live="polite" className={`mt-3 min-h-5.5 ${bangs.message.error ? 'text-n-danger' : 'text-n-mint'}`}>{bangs.message.text}</p>
          </form>
        </section>

        <section id="install" data-install className="pt-13 md:pt-18">
          <h2 className="text-22px font-bold tracking-tight">Install in your browser</h2>
          <p className="n-prose">One Python 3 script adds emu as a search engine to any Chromium browser profile. Set the three options and the commands below update.</p>
          <div className="mt-6 flex flex-wrap items-end gap-x-5.5 gap-y-3.5">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-1.5 p-0 text-xs text-n-muted">Operating system</legend>
              <div className="flex overflow-hidden rounded-1.5 border border-n-line">
                {OS_CHOICES.map(([value, label], i) => (
                  <label key={value} className="relative">
                    <input type="radio" name="os" value={value} checked={install.os === value} onChange={() => install.setOs(value)} className="peer absolute inset-0 cursor-pointer opacity-0" />
                    <span className={`block bg-n-panel px-3.5 py-2 peer-checked:bg-n-mint peer-checked:font-bold peer-checked:text-n-bg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-n-mint peer-focus-visible:[outline-offset:-4px] ${i ? 'border-l border-n-line' : ''}`}>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="min-w-35 flex-1 md:flex-none"><span className="mb-1.5 block text-xs text-n-muted">Browser</span>
              <select data-browser value={install.browser} onChange={event => install.setBrowser(event.target.value)} className="n-field">
                {install.browsers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="min-w-35 flex-1 md:flex-none"><span className="mb-1.5 block text-xs text-n-muted">Profile folder</span>
              <input type="text" data-profile value={install.profile} autoComplete="off" spellCheck={false} onChange={event => install.setProfile(event.target.value)} className="n-field" />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 items-start gap-7 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="rounded-2.5 border border-n-line bg-n-pit pb-3.5 pt-2">
              <div aria-hidden="true" className="flex gap-1.5 px-4 pb-2.5 pt-1.5">{[0, 1, 2].map(dot => <i key={dot} className="h-2.5 w-2.5 rounded-full bg-n-line" />)}</div>
              <p className="n-cmt text-n-muted"># 1. Quit the browser and its helpers, then list the profiles the script can see</p>
              <Line out="list" text={install.plan.list} />
              <p className="n-cmt text-n-muted"># 2. Install emu into the chosen profile</p>
              <p className={`n-cmt ${install.plan.unsupported ? 'text-n-danger' : 'text-n-muted'}`}># <span data-out="note">{install.plan.unsupported || install.plan.note}</span></p>
              <Line out="install" text={install.plan.install} />
              <p className="n-cmt text-n-muted"># 3. Reopen the browser and choose emu in search engine settings, or type emu then Tab</p>
              <p className="n-cmt text-n-muted"># Undo at any time with the manifest path the installer prints</p>
              <Line out="restore" text={install.plan.restore} />
              <p className="n-cmt text-n-muted"># Backups are kept in <span data-out="backups">{install.plan.backups}</span></p>
            </div>
            <div className="font-nsans text-sm leading-normal">
              <h3 className="font-code text-15px font-bold">What the script does for you</h3>
              <ul className="mt-3 grid list-none gap-2.5 p-0 text-n-muted">
                {[
                  ['Checks first.', 'It looks for running browser processes and open database files, and stops if it finds any. It never kills a process or asks for sudo.'],
                  ['Backs up.', 'A consistent SQLite backup is made and verified before any edit.'],
                  ['Changes one row.', 'Only the emu search engine is added or updated. A failure rolls back.'],
                  ['Restores cleanly.', 'Restore touches only that row and makes its own backup, so the undo can be undone.'],
                ].map(([lead, rest]) => (
                  <li key={lead} className="grid grid-cols-[14px_minmax(0,1fr)] gap-2">
                    <span aria-hidden="true" className="mt-1.75 h-1.25 w-2.25 -rotate-45 border-b-2 border-l-2 border-n-mint" />
                    <span><b className="font-semibold text-n-text">{lead}</b> {rest}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <details className="mt-6 rounded-2.5 border border-n-line bg-n-panel">
            <summary className="cursor-pointer px-4 py-3">Install by hand with SQL</summary>
            <p className="px-4 pb-3 font-nsans text-15px leading-relaxed text-n-muted">Quit the browser, back up the profile’s <code className="n-code">Web Data</code> file, then run this in any SQLite client. Change the ID or GUID if they already exist.</p>
            <div className="flex items-center justify-between border-t border-n-line py-2 pl-4 pr-2 text-xs text-n-muted"><span>install-emu.sql</span><CopyButton text={install.sql} label="Copy SQL" className="n-copy" /></div>
            <pre tabIndex={0} className="m-0 max-h-70 overflow-auto rounded-b-2.5 bg-n-pit px-4 py-3.5 font-code text-xs leading-relaxed"><code id="sql">{install.sql}</code></pre>
          </details>
        </section>
      </main>

      <footer className="mt-20 border-t border-n-line p-6 text-center font-nsans text-13px leading-relaxed text-n-muted">
        <p>Design prototype with fixture data. Nothing here calls the network.</p>
        <p>Movie and TV results use the TMDB API. This product is not endorsed or certified by TMDB.</p>
      </footer>
    </div>
  )
}
