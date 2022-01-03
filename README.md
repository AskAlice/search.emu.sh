# Chrome Search Suggestions Hack

I made this because I wanted to use DuckDuckGo's bangs but I also wanted to use google's rich omnibox suggestions (ie doing math in the url bar)
I realized as I was doing this that I could easily extend upon google's search suggestion API with my own features, add my own custom bangs, and determine whether or not to use google or DuckDuckGo to search for certain topics (via OpenAI's API).


## Search Features
  * Natural Language Processing via OpenAI to determine appropriate search engine
    * It will search with Google for most things. It will use DuckDuckGo for results that I find Google often has a bias towards a certain opinion, rather than providing useful information, for example when searching for medications or health conditions; rather than showing you the wikipedia links and fact sheets it provides you with pretty useless information for the lay-man.
  * Custom DuckDuckGo bangs (see [src/suggestions.ts](src/suggestions.ts))

## Suggestion Features
  * get IP to location results by typing in an IP address
    * <img src="https://emu.bz/cCu.png">
  * Dig for DNS records by typing the domain then the type of records
    * <img src="https://emu.bz/OX1.gif">
  * Convert crypto prices to USD easily, and view the data on CoinMarketCap (via CryptoCompare API)
    * <img src="https://emu.bz/tAm.png">

## search.emu.sh Backend

This app is written in Fastify and acts as a:

- search suggestion provider for google chrome
- search engine

If you simply want to use this without setting it up locally, refer below to the section [Adding an implementation that is live and maintained by me](https://github.com/section-io/search.emu.sh/tree/master#adding-an-implementation-that-is-live-and-maintained-by-me)

## Running locally

Refer to [.env.example](./.env.example) to set up api keys.

You will need to make an app on cloud.google.com if you want to use the Natural Language API to classify text.

You will need to make an API key for CryptoCompare if you want to get crypto prices.


```
npm i
```

```
npm run dev
```

## Adding the suggestion engine to your local chrome installation

- close chrome entirely
- [connect to the SQLite database at a location like](https://stackoverflow.com/a/16742333/643875)
  `%localappdata%\Google\Chrome\User Data\<your chrome profile>\Web Data` using a SQL client of your choice (I prefer HeidiSQL)

- The following query will insert the local search engine into your browser. Note you will have to have this running locally.
  - Make sure the `id` is unique, as well as the `sync_guid`

```sql
INSERT INTO "keywords" ("id", "short_name", "keyword", "favicon_url", "url", "safe_for_autoreplace", "originating_url", "date_created", "usage_count", "input_encodings", "suggest_url", "prepopulate_id", "created_by_policy", "last_modified", "sync_guid", "alternate_urls", "image_url", "search_url_post_params", "suggest_url_post_params", "image_url_post_params", "new_tab_url", "last_visited", "created_from_play_api")
VALUES (8192,
'emu search ✨ (local)',
'emuLocal',
'https://emu.sh/favicon.ico',
'http://localhost:8080/search?q={searchTerms}&useApiKeys=true',
0,
'https://search.emu.sh/osd.xml',
13265769204726312,
4,
'UTF-8',
'http://localhost:8080/suggest?{google:searchFieldtrialParameter}client={google:suggestClient}&gs_ri={google:suggestRid}&xssi=t&q={searchTerms}&{google:inputType}{google:omniboxFocusType}{google:cursorPosition}{google:currentPageUrl}{google:pageClassification}{google:searchVersion}{google:sessionToken}{google:prefetchQuery}sugkey={google:suggestAPIKeyParameter}&useApiKeys=true',
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

Follow the instructions above, but use the below query.
Note this won't use the keys for CryptoCompare or the OpenAI API  keys. Please don't set the `useApiKeys` query param to use my API keys as I could end up getting billed for it personally.

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
