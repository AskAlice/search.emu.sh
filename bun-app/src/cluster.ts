/**
 * Cluster Manager - Multi-process HTTP Server
 * 
 * Uses Bun.spawn() to create worker processes, each running Bun.serve()
 * for true multi-core parallelism.
 * 
 * Architecture:
 * ┌────────────────────────────────────────────────────┐
 * │              Cluster Manager (this)                │
 * │                  Bun.spawn() × N                   │
 * └────────────────────────────────────────────────────┘
 *                         │
 *        ┌────────────────┼────────────────┐
 *        ▼                ▼                ▼
 * ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 * │  Worker 0   │  │  Worker 1   │  │  Worker N   │
 * │ Bun.serve() │  │ Bun.serve() │  │ Bun.serve() │
 * └─────────────┘  └─────────────┘  └─────────────┘
 *        │                │                │
 *        └────────────────┴────────────────┘
 *                         │
 *                    Port 3006
 *                  (reusePort: true)
 */

import { cpus } from "node:os";
import { join } from "node:path";

// Configuration
const NUM_WORKERS = parseInt(process.env.NUM_WORKERS || "") || cpus().length;
const PORT = parseInt(process.env.PORT || "3006");

// Track worker processes
interface WorkerState {
  id: number;
  proc: ReturnType<typeof Bun.spawn>;
  restarts: number;
}

const workers: WorkerState[] = [];
let shuttingDown = false;

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          Bun Search Server - Cluster Mode                     ║
║             Bun.spawn() + Bun.serve()                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Bun Version: ${Bun.version.padEnd(45)}║
║  CPU Cores: ${String(cpus().length).padEnd(48)}║
║  Workers: ${String(NUM_WORKERS).padEnd(50)}║
║  Port: ${String(PORT).padEnd(53)}║
║  Manager PID: ${String(process.pid).padEnd(46)}║
╚═══════════════════════════════════════════════════════════════╝

Starting workers with Bun.spawn()...
`);

/**
 * Spawn a worker process using Bun.spawn()
 */
function spawnWorker(id: number, restarts: number = 0): WorkerState {
  const proc = Bun.spawn({
    cmd: ["bun", "run", join(import.meta.dir, "server.ts")],
    env: {
      ...process.env,
      WORKER_ID: String(id),
      PORT: String(PORT),
    },
    stdout: "inherit",
    stderr: "inherit",
    onExit(proc, exitCode, signal, error) {
      console.log(`[Cluster] Worker ${id} exited (code=${exitCode}, signal=${signal})`);
      
      // Auto-restart on crash
      if (!shuttingDown && exitCode !== 0) {
        const workerState = workers.find(w => w.id === id);
        if (workerState && workerState.restarts < 5) {
          const delay = Math.min(1000 * (workerState.restarts + 1), 5000);
          console.log(`[Cluster] Restarting worker ${id} in ${delay}ms...`);
          setTimeout(() => {
            const idx = workers.findIndex(w => w.id === id);
            if (idx !== -1) {
              workers[idx] = spawnWorker(id, workerState.restarts + 1);
            }
          }, delay);
        }
      }
    },
  });

  console.log(`[Cluster] Worker ${id} spawned (PID: ${proc.pid})`);
  return { id, proc, restarts };
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  
  console.log(`\n[Cluster] ${signal} received, stopping workers...`);
  
  // Send SIGTERM to all workers
  for (const w of workers) {
    w.proc.kill("SIGTERM");
  }
  
  // Wait for exit with timeout
  const timeout = setTimeout(() => {
    console.log("[Cluster] Force killing workers...");
    workers.forEach(w => w.proc.kill("SIGKILL"));
  }, 5000);
  
  await Promise.all(workers.map(w => w.proc.exited));
  clearTimeout(timeout);
  
  console.log("[Cluster] All workers stopped");
  process.exit(0);
}

// Signal handlers
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Spawn workers
for (let i = 0; i < NUM_WORKERS; i++) {
  workers.push(spawnWorker(i));
}

console.log(`
[Cluster] ${NUM_WORKERS} workers running on port ${PORT}
[Cluster] Press Ctrl+C to stop
`);

// Keep alive
await Bun.sleep(Number.MAX_SAFE_INTEGER);
