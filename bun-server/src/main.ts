/**
 * Bun Search Server - Main Entry Point
 * 
 * Features:
 * - HTTP/3 support via TLS (QUIC requires TLS)
 * - Multithreading via Bun's cluster mode
 * - High-performance routing with Bun's native fetch API
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { router } from "./router";
import { config } from "./config";

// TLS configuration for HTTP/2 and HTTP/3 support
const tlsConfig = config.tls.enabled && existsSync(config.tls.certFile) && existsSync(config.tls.keyFile)
  ? {
      cert: Bun.file(config.tls.certFile),
      key: Bun.file(config.tls.keyFile),
    }
  : undefined;

const server = Bun.serve({
  port: config.port,
  hostname: config.hostname,
  
  // Enable TLS for HTTP/2 and HTTP/3 support
  ...(tlsConfig && { tls: tlsConfig }),
  
  // Development mode for better error messages
  development: config.isDevelopment,
  
  // Main request handler
  async fetch(request: Request): Promise<Response> {
    const startTime = performance.now();
    
    try {
      const response = await router(request);
      
      // Add timing header
      const duration = (performance.now() - startTime).toFixed(2);
      const headers = new Headers(response.headers);
      headers.set("X-Response-Time", `${duration}ms`);
      headers.set("X-Powered-By", "Bun");
      
      // Add CORS headers
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
      return new Response(JSON.stringify({ 
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  
  // Error handler
  error(error: Error): Response {
    console.error("Server error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error",
      message: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  },
});

const protocol = tlsConfig ? "https" : "http";
console.log(`
🚀 Bun Search Server started!
   
   URL: ${protocol}://${server.hostname}:${server.port}
   HTTP/3: ${tlsConfig ? "Enabled (requires TLS)" : "Disabled (generate certs with: bun run generate-certs)"}
   Environment: ${config.isDevelopment ? "development" : "production"}
   PID: ${process.pid}
`);

export { server };
