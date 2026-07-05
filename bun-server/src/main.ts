/**
 * Bun Search Server - Main Entry Point
 * 
 * Uses Bun.serve() - Bun's high-performance HTTP server
 * 
 * Features:
 * - HTTP/1.1, HTTP/2, and HTTP/3 support (with TLS)
 * - WebSocket support ready
 * - Streaming responses
 * - Static file serving with Bun.file()
 */

import { existsSync } from "node:fs";
import { router } from "./router";
import { config } from "./config";

// TLS configuration for HTTP/2 and HTTP/3 support
const tlsConfig = config.tls.enabled && existsSync(config.tls.certFile) && existsSync(config.tls.keyFile)
  ? {
      cert: Bun.file(config.tls.certFile),
      key: Bun.file(config.tls.keyFile),
    }
  : undefined;

/**
 * Main server using Bun.serve()
 * 
 * Bun.serve() is Bun's built-in HTTP server that provides:
 * - Automatic request/response handling
 * - TLS/SSL support with HTTP/2 and HTTP/3
 * - WebSocket upgrade support
 * - Streaming request/response bodies
 * - High performance with minimal overhead
 */
const server = Bun.serve({
  // Server configuration
  port: config.port,
  hostname: config.hostname,
  
  // TLS for HTTPS, HTTP/2, and HTTP/3 (QUIC)
  ...(tlsConfig && { tls: tlsConfig }),
  
  // Development mode provides better error messages
  development: config.isDevelopment,
  
  // Enable SO_REUSEPORT for load balancing across multiple processes
  reusePort: true,
  
  // Maximum request body size (default: 128MB)
  maxRequestBodySize: 1024 * 1024 * 10, // 10MB
  
  // Idle timeout in seconds
  idleTimeout: 30,
  
  /**
   * Main fetch handler - called for every HTTP request
   * This is the core of Bun.serve()
   */
  async fetch(request: Request, server): Promise<Response> {
    const startTime = Bun.nanoseconds();
    const url = new URL(request.url);
    
    // Log request
    if (config.isDevelopment) {
      console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);
    }
    
    try {
      // Route the request
      const response = await router(request);
      
      // Calculate response time in milliseconds
      const duration = ((Bun.nanoseconds() - startTime) / 1_000_000).toFixed(2);
      
      // Add custom headers
      const headers = new Headers(response.headers);
      headers.set("X-Response-Time", `${duration}ms`);
      headers.set("X-Powered-By", "Bun.serve");
      headers.set("X-Bun-Version", Bun.version);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error("Request error:", error);
      return Response.json(
        { 
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }
  },
  
  /**
   * Error handler - called when fetch() throws
   */
  error(error: Error): Response {
    console.error("Server error:", error);
    return Response.json(
      { 
        error: "Internal Server Error",
        message: error.message 
      },
      { status: 500 }
    );
  },
});

// Server info
const protocol = tlsConfig ? "https" : "http";
console.log(`
╔══════════════════════════════════════════════════════════════╗
║              Bun Search Server - Bun.serve()                 ║
╠══════════════════════════════════════════════════════════════╣
║  URL: ${(protocol + "://" + server.hostname + ":" + server.port).padEnd(53)}║
║  Bun Version: ${Bun.version.padEnd(45)}║
║  HTTP/3: ${(tlsConfig ? "Enabled ✓" : "Disabled (run: bun run generate-certs)").padEnd(50)}║
║  Environment: ${(config.isDevelopment ? "development" : "production").padEnd(45)}║
║  PID: ${String(process.pid).padEnd(53)}║
║  reusePort: ${String(true).padEnd(47)}║
╚══════════════════════════════════════════════════════════════╝
`);

export { server };
