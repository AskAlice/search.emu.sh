/**
 * Worker Process - Spawned by Bun.spawn
 * 
 * This file is executed as a separate process by the cluster manager.
 * Each worker handles HTTP requests independently.
 */

import { existsSync } from "node:fs";
import { router } from "./router";
import { config } from "./config";

const workerId = process.env.WORKER_ID || "0";
const port = parseInt(process.env.WORKER_PORT || String(config.port));

// TLS configuration for HTTP/2 and HTTP/3 support
const tlsConfig = config.tls.enabled && existsSync(config.tls.certFile) && existsSync(config.tls.keyFile)
  ? {
      cert: Bun.file(config.tls.certFile),
      key: Bun.file(config.tls.keyFile),
    }
  : undefined;

const server = Bun.serve({
  port,
  hostname: config.hostname,
  ...(tlsConfig && { tls: tlsConfig }),
  development: config.isDevelopment,
  
  // Enable SO_REUSEPORT for kernel-level load balancing
  reusePort: true,
  
  async fetch(request: Request): Promise<Response> {
    const startTime = performance.now();
    
    try {
      const response = await router(request);
      
      const duration = (performance.now() - startTime).toFixed(2);
      const headers = new Headers(response.headers);
      headers.set("X-Response-Time", `${duration}ms`);
      headers.set("X-Worker-Id", workerId);
      headers.set("X-Worker-Pid", String(process.pid));
      headers.set("X-Powered-By", "Bun");
      headers.set("Access-Control-Allow-Origin", "*");
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(`[Worker ${workerId}] Error:`, error);
      return Response.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  },
  
  error(error: Error): Response {
    console.error(`[Worker ${workerId}] Server error:`, error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  },
});

const protocol = tlsConfig ? "https" : "http";
console.log(`[Worker ${workerId}] PID ${process.pid} listening on ${protocol}://${server.hostname}:${server.port}`);

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log(`[Worker ${workerId}] Received SIGTERM, shutting down...`);
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`[Worker ${workerId}] Received SIGINT, shutting down...`);
  server.stop();
  process.exit(0);
});
