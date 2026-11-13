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

Refer to [.env.example](./.env.example) to set up api keys.

You will need to make an app on cloud.google.com if you want to use the Natural Language API to classify text.

You will need to make an API key for CryptoCompare if you want to get crypto prices.

```
npm ci
```

```
npm run dev
```

The UI dev server runs at `http://localhost:5173` and forwards API requests to Fastify on port 3006. Both use dependencies from the root package. For a production build served by one Node process:

```sh
npm run build
npm start
```

Open `http://localhost:3006`. `npm run build:web` rebuilds only the static assets; `npm run build:ts` compiles only the API.

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
