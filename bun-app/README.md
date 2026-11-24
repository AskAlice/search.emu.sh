# Bun Search App

A high-performance search server built with **Bun.serve()** and **Bun.spawn()**.

## Features

- 🚀 **Bun.serve()** - Native HTTP server with HTTP/1.1, HTTP/2, and HTTP/3 support
- 🔀 **Bun.spawn()** - Multi-process workers for CPU parallelism  
- 🔍 **Search** - Bang shortcuts (`!gh`, `!yt`, `!npm`, etc.)
- 💡 **Suggest** - Browser omnibox integration (Chrome/Firefox)
- 💰 **Crypto Prices** - Real-time cryptocurrency lookups
- 🔒 **HTTP/3** - Via TLS/QUIC protocol

## Quick Start

```bash
cd bun-app
bun install
bun run start
```

## API Endpoints

### `GET /search?q={query}`

Search with bang support:

| Bang | Destination |
|------|-------------|
| `!g query` | Google |
| `!gh query` | GitHub |
| `!yt query` | YouTube |
| `!npm query` | NPM |
| `!so query` | Stack Overflow |
| `!w query` | Wikipedia |
| `!a query` | Amazon |
| `!r query` | Reddit |
| `!mdn query` | MDN Web Docs |

### `GET /suggest?q={query}`

Returns search suggestions for browser omnibox.

Query parameters:
- `q` - Search query
- `client` - `chrome-omni` or `firefox`
- `format` - `json` for raw JSON response

### `GET /`

Returns `{ root: true }`

### `GET /health`

Health check with server info.

### `GET /osd.xml`

OpenSearch description for browser integration.

## Running Modes

### Single Process

```bash
bun run start
```

### Cluster Mode (Multi-Process)

Uses `Bun.spawn()` to create worker processes:

```bash
bun run cluster
```

## HTTP/3 Setup

Generate TLS certificates:

```bash
bun run generate-certs
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3006` |
| `HOSTNAME` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Environment | `development` |
| `NUM_WORKERS` | Cluster workers | CPU count |
| `CRYPTOCOMPARE_KEY` | Crypto API key | - |

## Testing

```bash
bun test
```

## Project Structure

```
bun-app/
├── src/
│   ├── server.ts      # Bun.serve() main server
│   ├── cluster.ts     # Bun.spawn() cluster manager
│   ├── routes/
│   │   ├── root.ts    # /, /health, /osd.xml
│   │   ├── search.ts  # /search with bangs
│   │   └── suggest.ts # /suggest for omnibox
│   └── utils/
│       ├── suggestions.ts  # Bang definitions
│       └── static.ts       # Static file serving
├── static/
│   └── icons/         # Favicon images
└── certs/             # TLS certificates
```

## Bun APIs Used

- **Bun.serve()** - HTTP server
- **Bun.spawn()** - Process spawning
- **Bun.file()** - Zero-copy file serving
- **Bun.nanoseconds()** - High-precision timing
