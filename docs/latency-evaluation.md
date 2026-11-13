# Latency evaluation

Measured 2026-11-13T01:58:01.029Z. Recommendation: keep Fastify and CDN static delivery.
Prioritize provider completion policy, browser scheduling, and then a controlled
function-region experiment. Combining package manifests does not remove a hop in
the present deployment.

## Proven application improvement

| Scenario | Before P50 ms | After P50 ms | Before P95 ms | After P95 ms |
|---|---:|---:|---:|---:|
| local conversion | 81.295 | 0.372 | 81.626 | 1.102 |
| custom bang | 241.229 | 0.433 | 241.781 | 0.470 |
| ordinary query | 80.973 | 81.073 | 81.111 | 81.281 |
| remote rich answer | 241.041 | 241.019 | 242.125 | 241.963 |

Actual compiled route, 20 measurements after 2 warmups per scenario. Fixed upstream
delays: Google 80 ms; DuckDuckGo/OSV 240 ms. Raw samples and identical handler hashes
are in `benchmarks/results/{baseline,optimized}.json`. Only the completion policy
is changed in the baseline adapter. This is a controlled server-only result, not a
claim of sub-millisecond WAN responses.

The handler now finishes as soon as a rich answer or exact custom bang is ready,
aborting unrelated HTTP calls. Ordinary autocomplete still waits for Google;
requested remote answers still wait for their provider, bounded by 900 ms.
Tradeoff: a decisive answer can return fewer complementary Google suggestions.
Providers continue to start in parallel. Cookie-specific results remain private
and uncached at the CDN. No routing/cookie behavior is shared between users.

The frontend debounce changed from 250 to 75 ms, removing 175 ms of configured
idle delay. This is source-level timer arithmetic, not a measured browser speedup.
The tradeoff is more requests while typing; superseded requests are aborted.
The omnibox does not use the frontend debounce.

## Is Fastify the bottleneck?

| Handler | Concurrent requests | Median of round P50 ms | Range of round P95 ms |
|---|---:|---:|---:|
| fastify | 1 | 0.049 | 0.054–0.138 |
| node:http | 1 | 0.044 | 0.044–0.077 |
| fastify | 16 | 0.744 | 0.869–1.032 |
| node:http | 16 | 0.625 | 0.777–1.054 |

Three alternating rounds, 1,500 requests each per handler/concurrency, identical
JSON and headers, loopback HTTP/1.1 keepalive. A bare node:http handler wins this
microbenchmark, but the absolute warm difference is measured in microseconds at
concurrency 1 and fractions of a millisecond at 16. These are skeletons, not full
functionality comparisons. RPS is not an application-capacity forecast. Rewriting
cookies, validation, serialization, errors, and static routing is not justified by
these measurements. A Hono/Bun/uWebSockets rewrite has not been benchmarked; no
latency improvement is claimed for it.

Local initialization, eight fresh processes per variant:

- app: 158.8 ms median initialization.
- fastify-only: 89.5 ms median initialization.
- node-only: 2.0 ms median initialization.

Initialization is a more plausible framework cost than warm dispatch. These are
not Vercel cold-start measurements. Vercel's production bytecode caching and Fluid
instance reuse change their frequency and cost. The raw skeleton lacks all the
actual application's dependencies. Evaluate a full equivalent cold-start prototype
only if deployment telemetry shows initialization dominates user requests.

## Existing deployed service (observational)

| Host | Query | Median TTFB ms | Maximum TTFB ms |
|---|---|---:|---:|
| search.emu.sh | `hello` | 161.7 | 1867.9 |
| search.emu.sh | `5 in in cm` | 160.0 | 187.9 |
| search.emu.sh | `!orders shoes` | 212.2 | 252.0 |
| www.google.com | `hello` | 60.9 | 188.2 |
| www.google.com | `5 in in cm` | 61.7 | 65.7 |

Eight sequential samples per query, reused HTTP/2 session, from this one machine.
The first sample includes connection setup; a high first response is not proof of
a cold start. The deployment predates the local changes. Direct Google and emu
return different content, so their difference is not a proxy-hop measurement.
The emu response IDs consistently showed `sfo1::iad1`: SFO ingress with an IAD
function. This is a candidate for a regional A/B test, not proof that moving to
SFO will save a particular amount. A change might improve client transit while
worsening transit to providers. Production settings and DNS were not changed.

## Frontend/backend packaging and deployment options

The current path is `browser → Vercel edge → /suggest Node function → providers`.
The JS frontend calls the API directly; its source directory is not another
runtime server. `vercel.json` routes static files to the static build and API paths
to `src/vercel.ts`. `vite.config.mts` proxies only during local development.
Moving both manifests into one npm package changes builds and installs, not this
request topology. Serving static files through Node instead would invoke a function
for requests currently served as CDN assets. Keep that static delivery path.
A one-package or npm-workspaces cleanup remains an organizational choice with no
measured latency saving here.

Ranked next experiments:

1. **Region A/B:** identical built source and traffic against IAD/SFO previews;
   compare warm and first-request TTFB, provider timings, and answer completeness.
   Do not publish a production improvement until validated from the user's location.
2. **Upstream-only bounded cache:** consider a short TTL for anonymous Google
   responses and provider metadata, with a size bound. Measure hit rate using real
   typing traces first. Cache raw upstream data; reapply each request's custom bangs
   afterward. Avoid CDN caching combined personalized responses. No cache win is
   claimed here, and no new query-history cache was introduced.
3. **Warm transport reuse:** preserve keepalive; benchmark provider connection reuse
   separately. HTTP/3 is edge-controlled and cannot remove provider processing time.
4. **Startup/bundle audit:** the shipped GeoLite database is about 69 MiB. Measure
   actual Vercel initialization/bundle loading before splitting geolocation into a
   lazy module or separate function; file size alone does not prove a cold-start cost.
5. **Framework replacement:** low priority for warm latency given the absolute
   overhead above. Consider only with complete feature parity and cloud cold-start
   evidence. A minimal raw handler is an upper bound, not that proof.

## Reproduce and validation

See `benchmarks/README.md` for commands, fixtures, workload, and caveats.
`npm run test:unit` passes all eleven test files, including a 150 ms watchdog with
stalled upstreams for local results, provider failure isolation, custom cookies,
Chromium protobuf compatibility, and request cancellation. Both builds pass.
The benchmark asserts that each requested answer survives its scheduling change.
No deployment comparison, client-browser timing, sustained production load test,
or framework migration has been performed.

Official documentation consulted:

- [Vercel CDN caching](https://vercel.com/docs/caching): hits avoid a function/origin trip.
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute): reuse and production bytecode caching.

Packaging follow-up: the manifests have now been consolidated into the root package.
UI source is in `src/web`, and standalone Fastify serves `dist/web`. Vercel still
serves compiled assets from its CDN, retaining the measured request topology.

Autocomplete follow-up: bang queries now wait for Google query completions, skipping
DuckDuckGo bang discovery, while bare exact bangs retain the immediate response.
The earlier sub-millisecond `!orders shoes` measurement describes the superseded
policy; current bang-query latency includes Google response time. This preserves
query autocomplete rather than cancelling it in favor of the direct bang result.
