/**
 * Bun Worker Process
 * 
 * Individual worker that handles HTTP requests.
 * Multiple workers run in parallel for multithreading.
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
  
  // Enable SO_REUSEPORT for load balancing across workers
  reusePort: true,
  
  async fetch(request: Request): Promise<Response> {
    const startTime = performance.now();
    
    try {
      const response = await router(request);
      
      const duration = (performance.now() - startTime).toFixed(2);
      const headers = new Headers(response.headers);
      headers.set("X-Response-Time", `${duration}ms`);
      headers.set("X-Worker-Id", workerId);
      headers.set("X-Powered-By", "Bun");
      headers.set("Access-Control-Allow-Origin", "*");
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(`[Worker ${workerId}] Error:`, error);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  
  error(error: Error): Response {
    console.error(`[Worker ${workerId}] Server error:`, error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  },
});

const protocol = tlsConfig ? "https" : "http";
console.log(`   [Worker ${workerId}] Listening on ${protocol}://${server.hostname}:${server.port}`);
