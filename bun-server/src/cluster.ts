/**
 * Bun Cluster Mode - Multi-Process with Bun.spawn
 * 
 * Spawns multiple worker processes using Bun.spawn to handle requests
 * in parallel, utilizing all available CPU cores for maximum performance.
 * 
 * Each spawned process runs independently with its own event loop.
 */

import { cpus } from "node:os";
import { join } from "node:path";

const numWorkers = parseInt(process.env.NUM_WORKERS || "") || cpus().length;
const basePort = parseInt(process.env.PORT || "3006");

interface WorkerInfo {
  proc: ReturnType<typeof Bun.spawn>;
  id: number;
  port: number;
  status: "starting" | "running" | "stopped";
}

const workers: WorkerInfo[] = [];

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Bun Search Server - Cluster Mode                   ║
║                  Using Bun.spawn                             ║
╠══════════════════════════════════════════════════════════════╣
║  CPUs available: ${String(cpus().length).padEnd(42)}║
║  Workers to spawn: ${String(numWorkers).padEnd(40)}║
║  Base port: ${String(basePort).padEnd(47)}║
╚══════════════════════════════════════════════════════════════╝
`);

/**
 * Spawn a worker process using Bun.spawn
 */
function spawnWorker(workerId: number): WorkerInfo {
  const port = basePort + workerId;
  
  const proc = Bun.spawn({
    cmd: ["bun", "run", join(import.meta.dir, "worker-process.ts")],
    env: {
      ...process.env,
      WORKER_ID: String(workerId),
      WORKER_PORT: String(port),
      BUN_SPAWN_WORKER: "true",
    },
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    onExit(proc, exitCode, signalCode, error) {
      console.log(`[Cluster] Worker ${workerId} exited (code: ${exitCode}, signal: ${signalCode})`);
      
      // Find and update worker status
      const worker = workers.find(w => w.id === workerId);
      if (worker) {
        worker.status = "stopped";
      }
      
      // Auto-restart worker if it crashed unexpectedly
      if (exitCode !== 0 && !isShuttingDown) {
        console.log(`[Cluster] Restarting worker ${workerId}...`);
        setTimeout(() => {
          const index = workers.findIndex(w => w.id === workerId);
          if (index !== -1) {
            workers[index] = spawnWorker(workerId);
          }
        }, 1000);
      }
    },
  });
  
  console.log(`[Cluster] Spawned worker ${workerId} (PID: ${proc.pid}, Port: ${port})`);
  
  return {
    proc,
    id: workerId,
    port,
    status: "running",
  };
}

let isShuttingDown = false;

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n[Cluster] Received ${signal}, shutting down workers...`);
  
  // Kill all workers
  for (const worker of workers) {
    if (worker.proc.pid) {
      console.log(`[Cluster] Stopping worker ${worker.id} (PID: ${worker.proc.pid})`);
      worker.proc.kill();
    }
  }
  
  // Wait for all workers to exit
  await Promise.all(
    workers.map(w => w.proc.exited)
  );
  
  console.log("[Cluster] All workers stopped. Goodbye!");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Spawn all workers
for (let i = 0; i < numWorkers; i++) {
  workers.push(spawnWorker(i));
}

console.log(`
[Cluster] All ${numWorkers} workers spawned successfully!
[Cluster] Server endpoints:
${workers.map(w => `   - http://localhost:${w.port}`).join("\n")}

Press Ctrl+C to stop all workers.
`);

// Keep the main process alive
await Bun.sleep(Number.MAX_SAFE_INTEGER);
