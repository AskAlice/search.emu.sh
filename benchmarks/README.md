# Latency experiments

Run from repository root with the installed lockfile dependencies:

```sh
npm run build:ts
node benchmarks/latency.cjs baseline
node benchmarks/latency.cjs optimized
node benchmarks/startup.cjs
node benchmarks/live.cjs
npm run test:unit
```

`latency.cjs` runs actual compiled suggestion routes with an Axios fixture adapter:
Google takes 80 ms; DuckDuckGo and OSV take 240 ms. The baseline adapter removes
only the `decisiveAnswer` Promise.race branch from the compiled handler in memory,
reproducing its previous wait-for-all policy without maintaining a second handler.
It fails if that source anchor changes. Both runs record the same handler hash.
There are 2 warmups and 20 measured requests per scenario, sequential, using Fastify
injection. Expected results are asserted before timings are accepted. These are
server timings excluding network, TLS, browser debounce, and Vercel startup.
The fixture supports AbortSignal, so abandoned requests do not accumulate.

The framework comparison starts Fastify and node:http on loopback ports, sends
identical pre-serialized payloads over HTTP/1.1 with keepalive, and alternates order
across 3 rounds. Each round has 100 warmups and 1,500 measured requests at concurrency
1 and 16. This isolates routing overhead; the raw HTTP handler is deliberately a
skeleton, not a full replacement for the application's features.

`startup.cjs` runs 8 fresh Node processes per variant. It measures initialization
inside the process, not process spawning or a Vercel cold start. The skeletons do
not load providers, telemetry, cookies, static delivery, or routing parity.

`live.cjs` uses a persistent HTTP/2 session to each public host, 8 sequential requests
per query, without user cookies or API credentials. The first observation includes
connection establishment. Cold starts are not controlled; P95 with 8 observations
is the maximum. It probes the already deployed version, not the local patch, and
is not a deployed before/after comparison. No provider response bodies are stored.

Results include raw scenario/live observations and framework-round statistics.
Do not infer client-wide P95, load capacity, regional improvement, or real cache-hit
rates from this small single-machine run. See `docs/latency-evaluation.md`.
