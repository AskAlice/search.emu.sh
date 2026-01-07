/**
 * Bun Cluster Mode - Multi-Process Architecture
 * 
 * Uses Bun.spawn() to create multiple worker processes, each running
 * their own Bun.serve() instance. This provides true parallelism
 * across CPU cores.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Cluster Manager                          │
 * │                   (this process)                            │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *            Bun.spawn()       │       Bun.spawn()
 *         ┌────────────────────┼────────────────────┐
 *         ▼                    ▼                    ▼
 * ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
 * │   Worker 0    │   │   Worker 1    │   │   Worker 2    │
 * │ Bun.serve()   │   │ Bun.serve()   │   │ Bun.serve()   │
 * │ :3006         │   │ :3007         │   │ :3008         │
 * └───────────────┘   └───────────────┘   └───────────────┘
 */

import { cpus } from "node:os";
import { join } from "node:path";

const numWorkers = parseInt(process.env.NUM_WORKERS || "") || cpus().length;
const basePort = parseInt(process.env.PORT || "3006");

interface WorkerInfo {
  proc: Subprocess;
  id: number;
  port: number;
  status: "starting" | "running" | "stopped" | "crashed";
  restartCount: number;
}

// Type for Bun.spawn return value
type Subprocess = ReturnType<typeof Bun.spawn>;

const workers: WorkerInfo[] = [];
let isShuttingDown = false;

console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Bun Search Server - Cluster Mode                     ║
║              Using Bun.spawn + Bun.serve                     ║
╠══════════════════════════════════════════════════════════════╣
║  Bun Version: ${Bun.version.padEnd(45)}║
║  CPUs Available: ${String(cpus().length).padEnd(42)}║
║  Workers to Spawn: ${String(numWorkers).padEnd(40)}║
║  Base Port: ${String(basePort).padEnd(47)}║
║  Manager PID: ${String(process.pid).padEnd(45)}║
╚══════════════════════════════════════════════════════════════╝

Spawning workers with Bun.spawn()...
`);

/**
 * Spawn a worker process using Bun.spawn()
 * 
 * Bun.spawn() creates a new child process with:
 * - Full environment inheritance
 * - Stdio streaming
 * - Exit handling callbacks
 */
function spawnWorker(workerId: number, restartCount: number = 0): WorkerInfo {
  const port = basePort + workerId;
  
  // Use Bun.spawn to create a child process
  const proc = Bun.spawn({
    // Command to execute - runs the worker script with Bun
    cmd: ["bun", "run", join(import.meta.dir, "worker-process.ts")],
    
    // Environment variables passed to the worker
    env: {
      ...process.env,
      WORKER_ID: String(workerId),
      WORKER_PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || "development",
    },
    
    // Stdio configuration
    stdout: "inherit", // Worker stdout goes to cluster stdout
    stderr: "inherit", // Worker stderr goes to cluster stderr
    stdin: "inherit",  // Allow stdin passthrough
    
    // Called when the spawned process exits
    onExit(proc, exitCode, signalCode, error) {
      const worker = workers.find(w => w.id === workerId);
      
      if (error) {
        console.error(`[Cluster] Worker ${workerId} error:`, error);
      }
      
      console.log(`[Cluster] Worker ${workerId} exited (code: ${exitCode}, signal: ${signalCode})`);
      
      if (worker) {
        worker.status = exitCode === 0 ? "stopped" : "crashed";
      }
      
      // Auto-restart crashed workers (with backoff)
      if (!isShuttingDown && exitCode !== 0 && worker) {
        const delay = Math.min(1000 * Math.pow(2, worker.restartCount), 30000);
        console.log(`[Cluster] Restarting worker ${workerId} in ${delay}ms (restart #${worker.restartCount + 1})...`);
        
        setTimeout(() => {
          const index = workers.findIndex(w => w.id === workerId);
          if (index !== -1 && !isShuttingDown) {
            workers[index] = spawnWorker(workerId, worker.restartCount + 1);
          }
        }, delay);
      }
    },
  });
  
  console.log(`[Cluster] Bun.spawn() → Worker ${workerId} (PID: ${proc.pid}, Port: ${port})`);
  
  return {
    proc,
    id: workerId,
    port,
    status: "running",
    restartCount,
  };
}

/**
 * Graceful shutdown - stops all spawned workers
 */
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n[Cluster] Received ${signal}, stopping all workers...`);
  
  // Send SIGTERM to all workers
  for (const worker of workers) {
    if (worker.proc.pid) {
      console.log(`[Cluster] Sending SIGTERM to worker ${worker.id} (PID: ${worker.proc.pid})`);
      worker.proc.kill("SIGTERM");
    }
  }
  
  // Wait for all workers to exit (with timeout)
  const timeout = setTimeout(() => {
    console.log("[Cluster] Timeout waiting for workers, force killing...");
    for (const worker of workers) {
      if (worker.proc.pid) {
        worker.proc.kill("SIGKILL");
      }
    }
  }, 5000);
  
  await Promise.all(workers.map(w => w.proc.exited));
  clearTimeout(timeout);
  
  console.log("[Cluster] All workers stopped. Goodbye!");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Spawn all workers using Bun.spawn()
for (let i = 0; i < numWorkers; i++) {
  workers.push(spawnWorker(i));
}

console.log(`
[Cluster] Successfully spawned ${numWorkers} workers!

Server endpoints:
${workers.map(w => `  • http://localhost:${w.port} (Worker ${w.id})`).join("\n")}

Press Ctrl+C to stop all workers.
`);

// Keep cluster manager alive
await Bun.sleep(Number.MAX_SAFE_INTEGER);
