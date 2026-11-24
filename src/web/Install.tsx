import { useEffect, useRef, useState } from 'react'

const RAW_URL = 'https://raw.githubusercontent.com/AskAlice/search.emu.sh/master/scripts/install-chromium-search.py'
const SCRIPT_URL = 'https://github.com/AskAlice/search.emu.sh/blob/master/scripts/install-chromium-search.py'

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

type Os = 'macos' | 'linux' | 'windows'
const OS_CHOICES: Array<[Os, string]> = [['macos', 'macOS'], ['linux', 'Linux'], ['windows', 'Windows']]
const BACKUPS: Record<Os, string> = {
  macos: '~/Library/Application Support/emu-search/backups/',
  linux: '~/.local/share/emu-search/backups/',
  windows: '%LOCALAPPDATA%\\emu-search\\backups\\',
}
const WEB_DATA: Record<Os, string> = {
  macos: '~/Library/Application Support/Google/Chrome/Default/Web Data',
  linux: '~/.config/google-chrome/Default/Web Data',
  windows: '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Web Data',
}
const NOTES: Record<Os, string> = {
  macos: 'Paste into Terminal as your normal user, without sudo. Needs Python 3.',
  linux: 'Paste into a terminal as your normal user, without sudo. Needs Python 3 and lsof.',
  windows: 'Paste into PowerShell as your normal user. Needs Python 3 (py launcher).',
}

const guessOs = (): Os => (/Windows/.test(navigator.userAgent) ? 'windows' : /Mac/.test(navigator.userAgent) ? 'macos' : 'linux')

export function installCommands(os: Os) {
  // Piped straight from GitHub into Python's stdin: no clone, no file on disk. The script reads keys from the terminal.
  const run = os === 'windows' ? `irm ${RAW_URL} | py -3 -` : `curl -fsSL ${RAW_URL} | python3 -`
  const manifest = os === 'windows' ? 'C:\\path\\to\\manifest.json' : '/path/printed/by/installer/manifest.json'
  return { install: run, restore: `${run} --restore '${manifest}'` }
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [shown, setShown] = useState(label)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    let ok = true
    try { await navigator.clipboard.writeText(text) } catch { ok = false }
    setShown(ok ? 'Copied' : 'Copy blocked, select the text')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShown(label), 2000)
  }
  return <button type="button" className="copy" onClick={copy}><span aria-live="polite">{shown}</span></button>
}

function Line({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5 pl-4 pr-2 hover:bg-[#101e1e]">
      <span aria-hidden="true" className="font-bold text-ember">$</span>
      <code className="scroll-dark min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-2 font-mono text-13px text-sand">{text}</code>
      <CopyButton text={text} />
    </div>
  )
}

const CHECKS: Array<[string, string]> = [
  ['Waits for the browser.', 'It finds running browser processes and open database files, and waits until they are closed. It can ask them to quit for you, like closing the window. It never force-kills or asks for sudo.'],
  ['Backs up.', 'A consistent SQLite backup is made and verified before any edit.'],
  ['Changes one row.', 'Only the emu search engine is added or updated. A failure rolls back, and other browser data is left alone.'],
  ['Restores cleanly.', 'Restore touches only that row and makes its own backup, so the undo can be undone.'],
]

export default function Install() {
  const [os, setOs] = useState<Os>(guessOs)
  const commands = installCommands(os)

  return (
    <section id="install" className="scroll-mt-6 pt-13 md:pt-18">
      <h2 className="heading">Install in your browser</h2>
      <p className="prose">Paste one command and a setup screen walks you through it: pick your browser and profile, close the browser when asked, done. Works with Chrome, Brave, Edge, Opera, Vivaldi, Arc and other Chromium browsers, and shows the few clicks Firefox needs.</p>

      <div className="mt-6 flex flex-wrap items-end gap-x-5.5 gap-y-3.5">
        <fieldset className="m-0 p-0">
          <legend className="mb-1.5 p-0 text-xs text-muted">Operating system</legend>
          <div className="flex overflow-hidden rounded-1.5 border border-line">
            {OS_CHOICES.map(([value, label], i) => (
              <label key={value} className="relative">
                <input type="radio" name="os" value={value} checked={os === value} onChange={() => setOs(value)} className="peer absolute inset-0 cursor-pointer opacity-0" />
                <span className={`block bg-panel px-3.5 py-2 peer-checked:bg-mint peer-checked:font-bold peer-checked:text-night peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-mint peer-focus-visible:[outline-offset:-4px] ${i ? 'border-l border-line' : ''}`}>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-7 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-2.5 border border-line bg-pit pb-3.5 pt-2">
          <div aria-hidden="true" className="flex gap-1.5 px-4 pb-2.5 pt-1.5">{[0, 1, 2].map(dot => <i key={dot} className="h-2.5 w-2.5 rounded-full bg-line" />)}</div>
          <p className="cmt text-muted"># Paste this, then follow the setup screen</p>
          <p className="cmt text-muted"># {NOTES[os]}</p>
          <Line text={commands.install} />
          <p className="cmt text-muted"># Undo at any time with the manifest path the installer prints</p>
          <Line text={commands.restore} />
          <p className="cmt text-muted"># Backups are kept in {BACKUPS[os]}</p>
        </div>
        <div className="font-sans text-sm leading-normal">
          <h3 className="font-mono text-15px font-bold">What the script does for you</h3>
          <ul className="mt-3 grid list-none gap-2.5 p-0 text-muted">
            {CHECKS.map(([lead, rest]) => (
              <li key={lead} className="grid grid-cols-[14px_minmax(0,1fr)] gap-2">
                <span aria-hidden="true" className="mt-1.75 h-1.25 w-2.25 -rotate-45 border-b-2 border-l-2 border-mint" />
                <span><b className="font-semibold text-sand">{lead}</b> {rest}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-muted">The command downloads and runs the installer in one line, no clone needed. <a className="text-mint underline underline-offset-3" href={SCRIPT_URL} target="_blank" rel="noreferrer">View installer source</a></p>
        </div>
      </div>

      <details className="mt-6 rounded-2.5 border border-line bg-panel">
        <summary className="cursor-pointer px-4 py-3">Install by hand with SQL</summary>
        <ol className="m-0 grid gap-2 pb-3 pl-9 pr-4 font-sans text-15px leading-relaxed text-muted">
          <li>Quit the browser completely, including anything in the system tray. The database must not be open.</li>
          <li>Back up the profile’s <code className="chip">Web Data</code> file. For Chrome’s default profile that is <code className="chip break-anywhere">{WEB_DATA[os]}</code></li>
          <li>Open it with any SQLite client, run the query, and save. If the ID or GUID already exists, change those two values.</li>
          <li>Reopen the browser and choose emu at <code className="chip">chrome://settings/searchEngines</code>, or type <code className="chip">emu</code> then Tab.</li>
        </ol>
        <div className="flex items-center justify-between border-t border-line py-2 pl-4 pr-2 text-xs text-muted"><span>install-emu.sql</span><CopyButton text={INSTALL_SQL} label="Copy SQL" /></div>
        <pre tabIndex={0} className="scroll-dark m-0 max-h-70 overflow-auto rounded-b-2.5 bg-pit px-4 py-3.5 font-mono text-xs leading-relaxed"><code>{INSTALL_SQL}</code></pre>
      </details>
    </section>
  )
}
