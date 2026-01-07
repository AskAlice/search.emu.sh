# Bun Search Server

A high-performance search server re-implemented using **Bun's built-in web server** with support for **HTTP/3** (via TLS/QUIC) and **multithreading**.

## Features

- 🚀 **Bun's Native HTTP Server** - Blazing fast performance with Bun's built-in `Bun.serve()`
- 🔒 **HTTP/3 Support** - Enabled via TLS certificates (QUIC protocol requires TLS)
- 🧵 **Multithreading** - Cluster mode utilizing all CPU cores with `SO_REUSEPORT`
- 🔍 **Custom Bang Searches** - Support for `!gh`, `!g`, `!yt`, etc.
- 💰 **Crypto Price Lookups** - Real-time cryptocurrency prices
- 🌐 **DNS Lookups** - DNS over HTTPS queries
- 📡 **OpenSearch Support** - Browser search integration

## Prerequisites

- [Bun](https://bun.sh/) v1.0.0 or later

## Installation

```bash
cd bun-server
bun install
```

## Running the Server

### Single Process Mode

```bash
bun run start
```

### Development Mode (with hot reload)

```bash
bun run dev
```

### Cluster Mode (Multithreading)

Spawns one worker per CPU core for maximum performance:

```bash
bun run cluster
```

## HTTP/3 Support

HTTP/3 requires TLS certificates. Generate self-signed certificates for development:

```bash
bun run generate-certs
```

This creates `certs/cert.pem` and `certs/key.pem`. The server will automatically enable HTTP/2 and HTTP/3 when TLS is configured.

For production, use certificates from a Certificate Authority (e.g., Let's Encrypt).

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3006` |
| `HOSTNAME` | Server hostname | `0.0.0.0` |
| `NODE_ENV` | Environment (`development`/`production`) | `development` |
| `TLS_ENABLED` | Enable TLS/HTTP3 | `true` |
| `TLS_CERT` | Path to TLS certificate | `./certs/cert.pem` |
| `TLS_KEY` | Path to TLS private key | `./certs/key.pem` |
| `CRYPTOCOMPARE_KEY` | CryptoCompare API key for price lookups | - |

## API Endpoints

### `GET /`
Returns server status.

```json
{ "root": true }
```

### `GET /health`
Health check endpoint.

```json
{
  "status": "ok",
  "timestamp": "2026-01-07T12:00:00.000Z",
  "pid": 12345
}
```

### `GET /search?q={query}`
Performs search with bang support.

- `!g query` - Google search
- `!gh query` - GitHub search
- `!yt query` - YouTube search
- `!ddg query` - DuckDuckGo search
- `!npm query` - NPM search
- `!so query` - Stack Overflow search

### `GET /suggest?q={query}`
Returns search suggestions in Chrome/Firefox format.

Query parameters:
- `q` - Search query
- `client` - Client type (`chrome-omni`, `firefox`)
- `type` - Response format (`json`)
- `useApiKeys` - Enable API features (`true`/`false`)

### `GET /osd.xml` or `GET /opensearch.xml`
Returns OpenSearch description for browser integration.

### `GET /test`
DNS lookup test endpoint.

### `GET /example`
Example endpoint returning plain text.

## Testing

```bash
bun test
```

## Project Structure

```
bun-server/
├── src/
│   ├── main.ts          # Single-process server entry
│   ├── cluster.ts       # Multi-process cluster manager
│   ├── worker.ts        # Worker process for cluster mode
│   ├── router.ts        # Request router
│   ├── config.ts        # Configuration
│   ├── routes/          # Route handlers
│   │   ├── root.ts
│   │   ├── search.ts
│   │   ├── suggest.ts
│   │   ├── example.ts
│   │   └── test.ts
│   ├── utils/           # Utility functions
│   │   ├── cache.ts
│   │   ├── crypto-assets.ts
│   │   ├── redirect.ts
│   │   └── suggestions.ts
│   └── static/          # Static files
│       └── icons/
├── certs/               # TLS certificates (generated)
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

## Performance

Bun's HTTP server is significantly faster than Node.js alternatives:

- **No external framework** - Uses Bun's native `Bun.serve()`
- **reusePort** - Kernel-level load balancing across workers
- **HTTP/3** - Lower latency with QUIC protocol
- **Zero-copy responses** - Direct file serving with `Bun.file()`

## Differences from Fastify Version

| Feature | Fastify (Node.js) | Bun |
|---------|-------------------|-----|
| HTTP Server | Fastify | Bun.serve() |
| HTTP Version | HTTP/1.1, HTTP/2 | HTTP/1.1, HTTP/2, HTTP/3 |
| Multithreading | PM2/Cluster module | Native workers with reusePort |
| OpenTelemetry | @autotelic/fastify-opentelemetry | Manual (add as needed) |
| Static Files | @fastify/static | Bun.file() |
| JSON Parsing | Built-in | Native (faster) |

## License

ISC
