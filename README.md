# Chrome Search Suggestions Hack

[Live demo](https://search.emu.sh)

I made this because I wanted to use DuckDuckGo's bangs but I also wanted to use google's rich omnibox suggestions (ie doing math in the url bar)
I realized as I was doing this that I could easily extend upon google's search suggestion API with my own features, add my own custom bangs, and determine whether or not to use google or DuckDuckGo to search for certain topics (via an LLM, served through OpenRouter using the `moonshotai/kimi-k2.7-code` model).

## Search Features

- Natural Language Processing via OpenRouter (`moonshotai/kimi-k2.7-code`) to determine appropriate search engine
  - It will search with Google for most things. It will use DuckDuckGo for results that I find Google often has a bias towards a certain opinion, rather than providing useful information, for example when searching for medications or health conditions; rather than showing you the wikipedia links and fact sheets it provides you with pretty useless information for the lay-man.
- Custom DuckDuckGo bangs (see [src/suggestions.ts](src/suggestions.ts))

## Suggestion Features

- Discover custom and DuckDuckGo bangs as you type
- Get IP to location results by typing in an IP address
  - <img src="https://emu.bz/cCu.png" >
- Dig for DNS records and inspect domain RDAP, TLS, and mail configuration
  - <img src="https://emu.bz/OX1.gif" >
- Inspect URLs, redirects, and tracking-free final destinations
- Look up GitHub repositories, npm packages, CVEs, ISBNs, DOIs, flights, and tracking numbers
- Convert units, currency, time zones, colors, timestamps, Base64, and URL-encoded text
- Convert crypto prices to USD easily, and view the data on CoinMarketCap (via CryptoCompare API)
  - <img src="https://emu.bz/tAm.png" >

## search.emu.sh App

The React/TypeScript/UnoCSS UI and Fastify API share one Node package and lockfile. UI source lives in `src/web`; `npm run build` compiles the API and builds static UI assets into `dist/web`. Vercel serves those assets directly, and the standalone Fastify app serves them from the same process. The backend acts as a:

- search suggestion provider for google chrome
- search engine

If you simply want to use this without setting it up locally, refer below to the section [Adding an implementation that is live and maintained by me](#adding-an-implementation-that-is-live-and-maintained-by-me)

## Running locally

Copy [.env.example](./.env.example) to `.env.local` and fill in the keys you need. All are optional:

- `CRYPTOCOMPARE_KEY` for crypto prices
- `TMDB_API_KEY` or `TMDB_ACCESS_TOKEN` for movie/TV suggestions
- `BRAVE_SEARCH_API_KEY` for Brave rich suggestions

```
npm ci
```

```
npm run dev
```

`npm run dev` starts three processes: the Fastify API on port 3006 (restarts on change), `tsc -w`, and the Vite UI at `http://localhost:5173`. Open the Vite URL; it proxies `/suggest`, `/search`, `/bangs`, `/icon`, and the OpenSearch XML to the API. Set `VITE_API_BASE_URL` to point the UI at a different API. For a production build served by one Node process:

```sh
npm run build
npm start
```

Open `http://localhost:3006`. `npm run build:web` rebuilds only the static assets; `npm run build:ts` compiles only the API.

## Browser installer: macOS, Linux, and Windows

With Python 3 installed, run the installer as your normal desktop user. Quit all
Chromium browsers and their helpers first, including Brave Origin, and keep them
closed until the command finishes. The script refuses to kill processes or use sudo.

Run without arguments for an interactive browser picker, followed by a profile
picker. Use arrow keys (or j/k) and Enter; press q or Escape to cancel. Terminals
without ANSI support get a numbered menu. On Windows use `py -3` instead of
`python3`. Noninteractive use retains the explicit flags below.

```sh
python3 scripts/install-chromium-search.py
python3 scripts/install-chromium-search.py --list
python3 scripts/install-chromium-search.py --browser brave-origin --profile Default
# Use a different profile, or an exact path from --list:
python3 scripts/install-chromium-search.py --browser chrome --profile 'Profile 1'
python3 scripts/install-chromium-search.py --db '/absolute/profile/path/Web Data'
```

Supported profiles include Chrome channels, Chromium, Brave channels, Brave Origin,
Edge channels, Vivaldi, Arc, and Opera. Use `--db '/absolute/path/to/Web Data'` for
another Chromium profile. Each invocation changes only the selected profile.

Before editing, the script checks browser/helper processes and open database files,
probes SQLite's exclusive lock, then holds a write reservation. On macOS/Linux it checks open files with `lsof`; on Windows it uses the native
Restart Manager API, without shutting down processes. It makes and checks
a consistent SQLite backup, including committed WAL data, before changing anything.
It rechecks processes before editing and committing; any transaction failure rolls
back. Unknown required schema columns or another engine using the same keyword cause
it to abort. Reinstalling updates the existing emu provider without changing its ID.

Windows PowerShell examples (no additional Python packages required):

```powershell
py -3 scripts/install-chromium-search.py --list
py -3 scripts/install-chromium-search.py --browser brave --profile Default
py -3 scripts/install-chromium-search.py --restore 'C:\path\to\manifest.json'
```

On Linux, install `lsof` if absent (`sudo apt install lsof` or `sudo dnf install lsof`),
then run the Python command as your normal user, without sudo. Profiles follow
`XDG_CONFIG_HOME` or `~/.config`, plus common Snap and Flatpak locations. If multiple
installations match, use `--db` with the path printed by `--list`. For portable or
custom profiles on any OS, find the **Profile Path** on `chrome://version` or
`brave://version` and pass its `Web Data` file. For Opera's direct profile layout,
use `--profile .` or the exact `--db` path.

Backups and a checksum-protected restore manifest are stored in:

- macOS: `~/Library/Application Support/emu-search/backups/`
- Linux: `$XDG_DATA_HOME/emu-search/backups/` or `~/.local/share/emu-search/backups/`
- Windows: `%LOCALAPPDATA%\emu-search\backups\`

POSIX backup directories/files use modes 0700/0600; Windows backups inherit the
access controls of your local application-data directory. The
command prints the exact manifest path and undo command:

```sh
python3 scripts/install-chromium-search.py --restore '/path/printed/by/installer/manifest.json'
```

Restore requires browsers to be closed too. It restores only the affected search
engine row, preserving unrelated database changes, and refuses to overwrite newer
edits to the provider. Each restore also creates a backup so it can itself be undone.
The full database snapshot remains available for recovery. Keep these files private;
Web Data can contain personal information.

After installing, open your browser's search-engine settings and select emu as the
default, or use the `emu` keyword followed by Tab. The script does not change the
default-engine preference. The URLs for search, suggestions, and OpenSearch all use
`https://search.emu.sh`.

Installer verification: `npm run test:installer` exercises temporary SQLite profiles,
locks, WAL backups, rollback, restore, and process detection. Platform path/process/file-holder adapters are tested with fixtures. Real macOS and
Windows browser profiles still need platform smoke tests; the automated tests run
without modifying installed browser profiles.

## Adding the suggestion engine to your local chrome installation

- close chrome entirely
- [connect to the SQLite database at a location like](https://stackoverflow.com/a/16742333/643875)
  `%localappdata%\Google\Chrome\User Data\<your chrome profile>\Web Data` using a SQL client of your choice (I prefer HeidiSQL)

- The following query installs the hosted search engine at `https://search.emu.sh`.
  - Make sure the `id` and `sync_guid` are unique.

```sql
INSERT INTO "keywords" ("id", "short_name", "keyword", "favicon_url", "url", "safe_for_autoreplace", "originating_url", "date_created", "usage_count", "input_encodings", "suggest_url", "prepopulate_id", "created_by_policy", "last_modified", "sync_guid", "alternate_urls", "image_url", "search_url_post_params", "suggest_url_post_params", "image_url_post_params", "new_tab_url", "last_visited", "created_from_play_api")
VALUES (8192,
'emu search ✨',
'emu',
'https://emu.sh/favicon.ico',
'https://search.emu.sh/search?q={searchTerms}',
0,
'https://search.emu.sh/osd.xml',
13265769204726312,
4,
'UTF-8',
'https://search.emu.sh/suggest?{google:searchFieldtrialParameter}client={google:suggestClient}&gs_ri={google:suggestRid}&xssi=t&q={searchTerms}&{google:inputType}{google:omniboxFocusType}{google:cursorPosition}{google:currentPageUrl}{google:pageClassification}{google:searchVersion}{google:sessionToken}{google:prefetchQuery}sugkey={google:suggestAPIKeyParameter}',
0,
0,
13270754999736613,
'1f79ed5e-e746-4052-ab15-c5dcae786063',
'[]',
'',
'',
'',
'',
'',
13273967198571327,
0);
```

## Adding an implementation that is live and maintained by me

Follow the instructions above, but use the below query. API-backed suggestions are always enabled.

```sql
INSERT INTO "keywords" ("id", "short_name", "keyword", "favicon_url", "url", "safe_for_autoreplace", "originating_url", "date_created", "usage_count", "input_encodings", "suggest_url", "prepopulate_id", "created_by_policy", "last_modified", "sync_guid", "alternate_urls", "image_url", "search_url_post_params", "suggest_url_post_params", "image_url_post_params", "new_tab_url", "last_visited", "created_from_play_api")
VALUES (8195,
'emu search ✨',
'emu',
'https://emu.sh/favicon.ico',
'https://search.emu.sh/search?q={searchTerms}',
0,
'https://search.emu.sh/osd.xml',
13265769204726412,
4,
'UTF-8',
'https://search.emu.sh/suggest?{google:searchFieldtrialParameter}client={google:suggestClient}&gs_ri={google:suggestRid}&xssi=t&q={searchTerms}&{google:inputType}{google:omniboxFocusType}{google:cursorPosition}{google:currentPageUrl}{google:pageClassification}{google:searchVersion}{google:sessionToken}{google:prefetchQuery}sugkey={google:suggestAPIKeyParameter}',
0,
0,
13270754999736713,
'2f79ed5e-e746-4052-ab15-c5dcae786063',
'[]',
'',
'',
'',
'',
'',
13273967198571427,
0);
```

### Per-browser custom bangs

Open **Custom bangs** on the frontend to edit, add, or remove shortcuts, then save.
The initial list comes from `src/suggestions.ts`, including `!orders` and its `!o` alias.
Use `~QUERYHERE~` in a URL template; search text is URL encoded. Restore defaults
loads the built-in list into the editor; save to apply it.

Settings are stored in an HttpOnly cookie on the current host with a one-year
Max-Age, so they survive browser restarts. Saving renews the expiry; clearing site
cookies removes the settings. They apply to both `/search` and `/suggest`, including the
omnibox when its search/suggestion URLs use that same host. Use the frontend and backend on the same origin;
the Vite development server proxies these endpoints to port 3006.
The cookie supports at most 20 bangs and 3,500 encoded bytes. Invalid cookies fall
back to defaults; an explicitly empty list disables the custom shortcuts.

### Suggestion latency and transport

Google autocomplete and rich answers start concurrently. Local rich answers and
exact custom bangs without a query return as soon as ready, cancelling unrelated lookups. These
responses may omit additional Google suggestions. Other requests return available
results after at most 900 ms of provider work (plus network and platform
startup time), so a stalled optional lookup cannot hold the response open. Requests
made through Axios are cancelled when this budget expires or the client disconnects.
Slow providers may be omitted. The Chrome endpoint returns a complete JSON response
with the XSSI prefix; HTTP transport chunks are not incremental suggestion updates.

The supplied November 2026 Chrome NetLog contained Google suggestion requests over
HTTP/2, not requests to this service, so it cannot establish the cause of an emu
omnibox delay. The live emu endpoint also negotiated HTTP/2 during inspection.
HTTP/3 requires support at the serving edge, not an application `Alt-Svc` header.
Cloudflare can offer HTTP/3 for proxied hostnames when enabled in the zone:
https://developers.cloudflare.com/speed/optimization/protocol/http3/

### Provider tests and Chromium icons

Run `npm run test:unit` for all provider, protocol, and route tests. External HTTP,
DNS, TLS, and geolocation calls are replaced with fixtures. These tests require no
API keys or live services and cover provider failures and latency isolation.

Google's `google:suggesttemplate` protobuf is preserved for Chrome and decoded for
the JSON frontend. Calculator answers use Chromium's equals glyph. Supported icon
enums use the same rounded desktop icon mapping as Chromium; SVG copies are served
by this backend at `/icon/chromium/`. See [source attribution and update instructions](src/chromium/README.md).

After a bang and a space, suggestions complete the query using Google, preserving
that bang or alias on every completion (for example, `!o iphone` → `!o iphone case`).
Bang-name discovery is skipped in this mode. An exact custom bang remains available
as a lower-ranked fallback if Google has no completions. Bare `!o` still returns
immediately without waiting for Google.

### Google metadata and request options

`/suggest` accepts `hl` (language), `gl` (two-letter region), and `cp` (cursor
position). These are validated and forwarded to Google. For a bang query, `cp` is
adjusted to the query text after the bang. The upstream `client` remains
`chrome-omni` so decoding stays consistent; the outgoing `client=firefox` format
still works. Internal query fields, API keys, and page URLs are not forwarded.
Example: `/suggest?type=json&q=bonjour&hl=fr&gl=FR&cp=7`.

Original Google entity protobufs are passed intact to Chrome. JSON/Firefox details
also retain dominant color (`dc`), search parameters (`q`), categories (`category`),
website (`website`), and Google suggestion subtypes. The frontend uses a valid
entity dominant color as its image background.

### Movies and TV

`movie dune` and `tv severance` search TMDB for up to five titles, showing the year,
summary, and poster when available. Set `TMDB_API_KEY` or `TMDB_ACCESS_TOKEN` on the
backend to enable it; the read-access token takes precedence. Missing credentials
or provider failures leave ordinary Google autocomplete available.

Results open individual TMDB detail pages by default. Optionally set complete
`MOVIE_URL_TEMPLATE` and `TV_URL_TEMPLATE` URLs for your Radarr/Sonarr installation.
Placeholders are `{id}` (the TMDB ID), `{query}` (the result's title and year),
`{title}`, and `{year}`. Every substituted value is URL encoded. Use title-based
search for a service that requires a different ID system, such as TVDB IDs.
Invalid destination URLs fall back to the TMDB page.

The approved TMDB logo in `public/icons/tmdb.svg` comes from
[TMDB's attribution page](https://www.themoviedb.org/about/logos-attribution).
The application includes TMDB's required attribution notice.

### Short DNS queries

`example.com` and `dig example.com` default to A records. `example.com MX` and
`dig example.com MX` select a record type. DNS answers rank above generic query
completions. IP addresses still use geolocation; URLs and ordinary multiword text
do not trigger a DNS lookup.

## Brave rich suggestions

Set `BRAVE_SEARCH_API_KEY` in the ignored `.env.secrets.local` file for local
development and in Vercel's server environment. Keep this file separate from
`.env.local`, which Vercel CLI manages. `npm start` and `npm run dev` load `.env`,
then `.env.local`, then `.env.secrets.local`; the secrets file overrides matching
values pulled into `.env.local`. Existing process environment variables take
priority over all three files. The key stays
on the backend and is never sent to the frontend.

Brave autosuggest runs alongside Google with a 750 ms request timeout and the shared
suggestion deadline. Entity titles, descriptions, and HTTPS images appear in both
the frontend and Chromium's native rich suggestions. Query completions after a bang
retain that bang. Duplicate query strings keep the highest-ranked result.
Failures retain other providers' results.

The key must include autosuggest access, and `rich=true` requires a paid autosuggest
subscription. A general web-search key may return `OPTION_NOT_IN_PLAN` even for a
minimal autosuggest request. See the [Brave autosuggest documentation](https://api-dashboard.search.brave.com/app/documentation/suggest/get-started/suggest).
Provider fixtures and route serialization are covered by `npm run test:unit`.
