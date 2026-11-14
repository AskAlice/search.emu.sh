# Bun Search Server

A high-performance search server built with **Bun.serve()** and **Bun.spawn()** for HTTP/3 support and multi-process parallelism.

## Core Bun APIs Used

### `Bun.serve()` - HTTP Server

The main HTTP server uses Bun's native `Bun.serve()` API which provides:

```typescript
const server = Bun.serve({
  port: 3006,
  hostname: "0.0.0.0",
  
  // TLS enables HTTP/2 and HTTP/3 (QUIC)
  tls: {
    cert: Bun.file("./certs/cert.pem"),
    key: Bun.file("./certs/key.pem"),
  },
  
  // Enable kernel-level load balancing across processes
  reusePort: true,
  
  // Request handler
  async fetch(request: Request, server): Promise<Response> {
    return new Response("Hello from Bun.serve()!");
  },
  
  // Error handler
  error(error: Error): Response {
    return Response.json({ error: error.message }, { status: 500 });
  },
});
```

### `Bun.spawn()` - Process Spawning

For multi-process parallelism, we use `Bun.spawn()` to create worker processes:

```typescript
const worker = Bun.spawn({
  cmd: ["bun", "run", "worker.ts"],
  env: {
    WORKER_ID: "0",
    PORT: "3006",
  },
  stdout: "inherit",
  stderr: "inherit",
  onExit(proc, exitCode, signalCode, error) {
    console.log(`Worker exited with code ${exitCode}`);
  },
});
```

## Features

- 🚀 **Bun.serve()** - Native HTTP server with minimal overhead
- 🔀 **Bun.spawn()** - Multi-process workers for CPU parallelism
- 🔒 **HTTP/3 Support** - Via TLS/QUIC protocol
- ⚡ **reusePort** - Kernel-level load balancing
- 🔍 **Bang Searches** - `!gh`, `!g`, `!yt`, etc.
- 💰 **Crypto Prices** - Real-time cryptocurrency lookups
- 🌐 **DNS over HTTPS** - DNS query support

## Installation

```bash
cd bun-server
bun install
```

## Running the Server

### Single Process (Bun.serve only)

```bash
bun run start
```

### Development Mode (with hot reload)

```bash
bun run dev
```

### Cluster Mode (Bun.spawn + Bun.serve)

Spawns one worker per CPU core, each running its own `Bun.serve()`:

```bash
bun run cluster
```

Architecture:
```
┌─────────────────────────────────────────────────────────────┐
│                    Cluster Manager                          │
│                   Bun.spawn() × N                           │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Worker 0    │   │   Worker 1    │   │   Worker N    │
│ Bun.serve()   │   │ Bun.serve()   │   │ Bun.serve()   │
│ :3006         │   │ :3007         │   │ :300X         │
└───────────────┘   └───────────────┘   └───────────────┘
```

## HTTP/3 Support

HTTP/3 requires TLS. Generate self-signed certificates:

```bash
bun run generate-certs
```

The server automatically enables HTTP/2 and HTTP/3 when TLS certificates are present.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3006` |
| `HOSTNAME` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Environment | `development` |
| `NUM_WORKERS` | Workers in cluster mode | CPU count |
| `TLS_ENABLED` | Enable TLS/HTTP3 | `true` |
| `TLS_CERT` | TLS certificate path | `./certs/cert.pem` |
| `TLS_KEY` | TLS private key path | `./certs/key.pem` |
| `CRYPTOCOMPARE_KEY` | Crypto price API key | - |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Server status `{ root: true }` |
| `GET /health` | Health check with PID |
| `GET /search?q=` | Search with bang support |
| `GET /suggest?q=` | Search suggestions |
| `GET /osd.xml` | OpenSearch description |
| `GET /test` | DNS lookup test |
| `GET /example` | Example endpoint |

## Response Headers

Every response includes:

- `X-Response-Time` - Request duration in ms
- `X-Powered-By` - `Bun.serve`
- `X-Bun-Version` - Bun version
- `X-Worker-Id` - Worker ID (cluster mode)
- `X-Worker-Pid` - Worker PID (cluster mode)

## Testing

```bash
bun test
```

## Project Structure

```
bun-server/
├── src/
│   ├── main.ts           # Bun.serve() single-process entry
│   ├── cluster.ts        # Bun.spawn() cluster manager
│   ├── worker-process.ts # Bun.serve() worker for cluster
│   ├── router.ts         # Request routing
│   ├── config.ts         # Configuration
│   ├── routes/           # Route handlers
│   │   ├── root.ts       # / and /osd.xml
│   │   ├── search.ts     # /search
│   │   ├── suggest.ts    # /suggest
│   │   ├── example.ts    # /example
│   │   └── test.ts       # /test
│   └── utils/            # Utilities
│       ├── cache.ts      # In-memory cache
│       ├── crypto-assets.ts
│       ├── redirect.ts
│       └── suggestions.ts
├── certs/                # TLS certificates
├── package.json
├── tsconfig.json
└── bunfig.toml
```

## Performance Notes

- **Bun.serve()** is significantly faster than Node.js HTTP servers
- **reusePort** enables kernel-level load balancing (Linux 3.9+)
- **Bun.spawn()** has lower overhead than Node.js child_process
- **Bun.file()** provides zero-copy file serving
- **Bun.nanoseconds()** for high-precision timing

## License

ISC
