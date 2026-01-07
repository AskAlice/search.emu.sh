/**
 * Bun Cluster Mode - Multithreading Support
 * 
 * Spawns multiple worker processes to handle requests in parallel,
 * utilizing all available CPU cores for maximum performance.
 */

import { cpus } from "node:os";
import { join } from "node:path";

const numCPUs = cpus().length;
const workers: Array<ReturnType<typeof Bun.spawn>> = [];

console.log(`
🔧 Starting Bun Search Server in Cluster Mode
   CPUs available: ${numCPUs}
   Spawning ${numCPUs} worker processes...
`);

// Spawn worker processes
for (let i = 0; i < numCPUs; i++) {
  const worker = Bun.spawn({
    cmd: ["bun", "run", join(import.meta.dir, "worker.ts")],
    env: {
      ...process.env,
      WORKER_ID: String(i),
      WORKER_PORT: String(3006 + i),
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  
  workers.push(worker);
  console.log(`   Worker ${i} started (PID: ${worker.pid})`);
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down cluster...");
  
  for (const worker of workers) {
    worker.kill();
  }
  
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down cluster...");
  
  for (const worker of workers) {
    worker.kill();
  }
  
  process.exit(0);
});

// Keep the main process alive
await Bun.sleep(Number.MAX_SAFE_INTEGER);
