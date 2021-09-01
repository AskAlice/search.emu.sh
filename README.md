# search.emu.sh Backend

This app is written in Fastify and acts as a:

- search suggestion provider for google chrome
- search engine

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
- connect to the SQLite database at a location like
  `%localappdata%\Google\Chrome\User Data\<your chrome profile>\Web Data` using a SQL client of your choice (I prefer HeidiSQL)

- The following query will insert the local search engine into your browser. Note you will have to have this running locally.
  - Make sure the `id` is unique, as well as the `sync_guid`

```sql
INSERT INTO "keywords" ("id", "short_name", "keyword", "favicon_url", "url", "safe_for_autoreplace", "originating_url", "date_created", "usage_count", "input_encodings", "suggest_url", "prepopulate_id", "created_by_policy", "last_modified", "sync_guid", "alternate_urls", "image_url", "search_url_post_params", "suggest_url_post_params", "image_url_post_params", "new_tab_url", "last_visited", "created_from_play_api")
VALUES (8192,
'emu search ✨',
'emu',
'https://emu.sh/favicon.ico',
'http://localhost:8080/search?q={searchTerms}', 0,
'https://search.emu.sh/osd.xml', 13265769204726312, 4,
'UTF-8',
'http://localhost:8080/suggest?{google:searchFieldtrialParameter}client={google:suggestClient}&gs_ri={google:suggestRid}&xssi=t&q={searchTerms}&{google:inputType}{google:omniboxFocusType}{google:cursorPosition}{google:currentPageUrl}{google:pageClassification}{google:searchVersion}{google:sessionToken}{google:prefetchQuery}sugkey={google:suggestAPIKeyParameter}', 0, 0, 13270754999736613,
'1f79ed5e-e746-4052-ab15-c5dcae786063',
'[]',
'',
'',
'',
'',
'', 13273967198571327, 0);
```
