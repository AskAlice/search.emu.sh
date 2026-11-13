# Chromium omnibox icons

Vendored from Chromium revision `835a91d0307b1b6aeacf7708bb735ca6999c45e8`.
The Chromium BSD license is included in LICENSE. Original `.icon` files retain
their copyright headers in `upstream/`; generated SVGs preserve their path geometry.
The SVG fill is neutral grey; Chromium normally applies its theme foreground.

Sources:

- https://github.com/chromium/chromium/blob/835a91d0307b1b6aeacf7708bb735ca6999c45e8/components/omnibox/browser/autocomplete_match.cc (`GetVectorIcon`)
- https://github.com/chromium/chromium/blob/835a91d0307b1b6aeacf7708bb735ca6999c45e8/chrome/browser/ui/views/omnibox/omnibox_match_cell_view.cc (calculator answer icon)
- https://github.com/chromium/chromium/tree/835a91d0307b1b6aeacf7708bb735ca6999c45e8/components/omnibox/browser/vector_icons
- https://github.com/chromium/chromium/tree/835a91d0307b1b6aeacf7708bb735ca6999c45e8/components/vector_icons (`search.icon`, `history.icon`)
- https://github.com/chromium/chromium/blob/835a91d0307b1b6aeacf7708bb735ca6999c45e8/third_party/omnibox_proto/suggest_template_info.proto

`icons.ts` implements the rounded-icons desktop branch of `GetVectorIcon` for
server-provided suggestion types. Unsupported `IconType` values fall back to the
search icon, matching that switch. A calculator is a match type, not a protobuf
icon enum member: Chromium uses `equal.icon` for its answer image. Real entity
images are retained. Ordinary query icons are left to Chrome's native renderer;
the JSON frontend receives the equivalent backend-served SVG URL.

`src/proto/chromium_suggest.proto` is a wire-compatible projection of the upstream
message, retaining its exact IconType enum and the fields we read. Unrelated UI
fields are ignored during decoding. Original base64 messages are passed to Chrome
unchanged, so unknown fields are not discarded.

To update or reproduce the assets:

```sh
python3 scripts/vendor-chromium-icons.py
protoc --plugin=protoc-gen-es=./node_modules/.bin/protoc-gen-es --es_out=. --es_opt=target=ts src/proto/chromium_suggest.proto
npm run test:unit
```

Changing the pinned revision requires reviewing both the enum and Chromium's
selection switch. The converter rejects unsupported Skia commands rather than
silently producing different artwork.
