# Emu Search design prototype: Night Console

The chosen direction for the frontend overhaul, kept as a reference. It has been ported into the app (`src/web/App.tsx`, `src/web/BangSettings.tsx`, `src/web/Install.tsx`, theme in `/uno.config.mts`). Two other directions, Daylight and Switchboard, were explored and removed.

`option-2.html` is a standalone build of the prototype: React and UnoCSS inlined, fixture data, no network requests. Open it directly in a browser.

## Files

```
option-2.html        built prototype, about 275 kB (React is inlined)
build.mjs            rebuilds it with the repo's vite, plugin-react and unocss: node design-options/build.mjs
screenshots/         prototype and shipped-app captures
src/Option2.tsx      the prototype layout
src/shared.tsx       prototype hooks: useCombobox, useBangs, useInstall
src/uno.config.mts   prototype tokens, prefixed n-
src/engine.js        fixture data and suggestion logic (types in engine.d.ts)
```

## How the app differs from the prototype

- Suggestions come from `/suggest?type=json`, bangs from `/bangs` (cookie, one year). The prototype uses fixtures and `localStorage`.
- The inspector shows what the API returns: image, title, annotation, type, category, website, and the URL Enter opens. The prototype's richer fixture detail (price trend, DNS rows, posters) is not in the API response.
- Starter examples do not preview an answer until they are run.
- Enter navigates to `/search`. The prototype only reports the URL.
- Tokens are unprefixed in the app (`bg-panel`, `text-mint`), and the app loads DM Sans and IBM Plex Mono.

This folder is not part of the app build and can be deleted once it is no longer useful.
