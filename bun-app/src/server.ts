/**
 * Bun Search Server
 * 
 * Built with Bun.serve() - Bun's native high-performance HTTP server
 * Supports HTTP/1.1, HTTP/2, and HTTP/3 (with TLS)
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

// Route handlers
import { handleRoot, handleOsd, handleHealth } from "./routes/root";
import { handleSearch } from "./routes/search";
import { handleSuggest } from "./routes/suggest";
import { serveStatic } from "./utils/static";

// Configuration
const PORT = parseInt(process.env.PORT || "3006");
const HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
const IS_DEV = process.env.NODE_ENV !== "production";

// TLS paths for HTTP/3
const CERT_PATH = process.env.TLS_CERT || join(import.meta.dir, "../certs/cert.pem");
const KEY_PATH = process.env.TLS_KEY || join(import.meta.dir, "../certs/key.pem");

// Check for TLS certificates
const hasTLS = existsSync(CERT_PATH) && existsSync(KEY_PATH);
const tlsConfig = hasTLS ? {
  cert: Bun.file(CERT_PATH),
  key: Bun.file(KEY_PATH),
} : undefined;

/**
 * Main HTTP Server using Bun.serve()
 */
const server = Bun.serve({
  port: PORT,
  hostname: HOSTNAME,
  
  // TLS enables HTTP/2 and HTTP/3 (QUIC protocol)
  ...(tlsConfig && { tls: tlsConfig }),
  
  // Development mode for better error messages
  development: IS_DEV,
  
  // Allow multiple processes to bind to the same port
  reusePort: true,
  
  // Max request body size
  maxRequestBodySize: 10 * 1024 * 1024, // 10MB
  
  // Idle connection timeout
  idleTimeout: 30,

  /**
   * Main request handler - Bun.serve() fetch function
   */
  async fetch(request: Request, server): Promise<Response> {
    const startTime = Bun.nanoseconds();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Log requests in dev mode
    if (IS_DEV) {
      console.log(`[${new Date().toISOString()}] ${method} ${path}`);
    }

    try {
      let response: Response;

      // Handle CORS preflight
      if (method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(),
        });
      }

      // Route matching
      if (method === "GET") {
        switch (path) {
          case "/":
            response = handleRoot(request);
            break;
          case "/health":
            response = handleHealth(request);
            break;
          case "/osd.xml":
          case "/opensearch.xml":
            response = handleOsd(request);
            break;
          case "/search":
            response = await handleSearch(request);
            break;
          case "/suggest":
            response = await handleSuggest(request);
            break;
          default:
            // Static files
            if (path.startsWith("/icons/")) {
              response = await serveStatic(path, join(import.meta.dir, "../static"));
            } else {
              response = Response.json(
                { error: "Not Found", path, statusCode: 404 },
                { status: 404 }
              );
            }
        }
      } else {
        response = Response.json(
          { error: "Method Not Allowed", statusCode: 405 },
          { status: 405 }
        );
      }

      // Add headers
      return addHeaders(response, startTime);
      
    } catch (error) {
      console.error("Request error:", error);
      return Response.json(
        { error: "Internal Server Error", message: String(error) },
        { status: 500, headers: corsHeaders() }
      );
    }
  },

  /**
   * Error handler for Bun.serve()
   */
  error(error: Error): Response {
    console.error("Server error:", error);
    return Response.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  },
});

/**
 * Add response headers including timing
 */
function addHeaders(response: Response, startTime: number): Response {
  const duration = ((Bun.nanoseconds() - startTime) / 1_000_000).toFixed(2);
  const headers = new Headers(response.headers);
  
  headers.set("X-Response-Time", `${duration}ms`);
  headers.set("X-Powered-By", "Bun.serve");
  headers.set("X-Bun-Version", Bun.version);
  
  // CORS headers
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * CORS headers helper
 */
function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Server startup message
const protocol = tlsConfig ? "https" : "http";
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               Bun Search Server - Bun.serve()                 ║
╠═══════════════════════════════════════════════════════════════╣
║  URL: ${(protocol + "://" + server.hostname + ":" + server.port).padEnd(54)}║
║  Bun: ${Bun.version.padEnd(54)}║
║  HTTP/3: ${(tlsConfig ? "✓ Enabled" : "✗ Run: bun run generate-certs").padEnd(51)}║
║  Mode: ${(IS_DEV ? "development" : "production").padEnd(53)}║
║  PID: ${String(process.pid).padEnd(54)}║
╚═══════════════════════════════════════════════════════════════╝
`);

export { server };
