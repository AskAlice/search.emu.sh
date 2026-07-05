/**
 * Worker Process - Spawned by Bun.spawn from cluster.ts
 * 
 * Uses Bun.serve() to create an HTTP server in each worker process.
 * Multiple workers share the same port using SO_REUSEPORT for
 * kernel-level load balancing.
 */

import { existsSync } from "node:fs";
import { router } from "./router";
import { config } from "./config";

const workerId = process.env.WORKER_ID || "0";
const port = parseInt(process.env.WORKER_PORT || String(config.port));

// TLS configuration
const tlsConfig = config.tls.enabled && existsSync(config.tls.certFile) && existsSync(config.tls.keyFile)
  ? {
      cert: Bun.file(config.tls.certFile),
      key: Bun.file(config.tls.keyFile),
    }
  : undefined;

/**
 * Worker server using Bun.serve()
 * 
 * Each spawned worker creates its own Bun.serve() instance.
 * With reusePort: true, the kernel distributes incoming
 * connections across all workers.
 */
const server = Bun.serve({
  // Port configuration - can be shared across workers with reusePort
  port,
  hostname: config.hostname,
  
  // TLS for HTTPS/HTTP2/HTTP3
  ...(tlsConfig && { tls: tlsConfig }),
  
  // Development mode
  development: config.isDevelopment,
  
  // Enable SO_REUSEPORT - critical for multi-process load balancing
  // This allows multiple processes to bind to the same port
  reusePort: true,
  
  // Request size limit
  maxRequestBodySize: 1024 * 1024 * 10, // 10MB
  
  // Connection idle timeout
  idleTimeout: 30,
  
  /**
   * Fetch handler using Bun.serve's request/response model
   */
  async fetch(request: Request, server): Promise<Response> {
    const startTime = Bun.nanoseconds();
    
    try {
      const response = await router(request);
      
      // High-precision timing using Bun.nanoseconds()
      const durationMs = ((Bun.nanoseconds() - startTime) / 1_000_000).toFixed(3);
      
      const headers = new Headers(response.headers);
      headers.set("X-Response-Time", `${durationMs}ms`);
      headers.set("X-Worker-Id", workerId);
      headers.set("X-Worker-Pid", String(process.pid));
      headers.set("X-Powered-By", "Bun.serve");
      headers.set("Access-Control-Allow-Origin", "*");
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(`[Worker ${workerId}] Error:`, error);
      return Response.json(
        { error: "Internal Server Error", worker: workerId },
        { status: 500 }
      );
    }
  },
  
  /**
   * Error handler for Bun.serve()
   */
  error(error: Error): Response {
    console.error(`[Worker ${workerId}] Server error:`, error);
    return Response.json(
      { error: "Internal Server Error", worker: workerId },
      { status: 500 }
    );
  },
});

const protocol = tlsConfig ? "https" : "http";
console.log(`[Worker ${workerId}] Bun.serve() listening on ${protocol}://${server.hostname}:${server.port} (PID: ${process.pid})`);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log(`[Worker ${workerId}] Stopping Bun.serve()...`);
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`[Worker ${workerId}] Stopping Bun.serve()...`);
  server.stop();
  process.exit(0);
});
