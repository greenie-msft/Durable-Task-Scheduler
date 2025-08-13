// Worker host: registers orchestrations and activities and starts the gRPC worker.
import { TaskHubGrpcWorker } from "durabletask-js";
import { functionChainingOrchestrator } from "./orchestrations/functionChainingOrchestrator.mjs";
import { hello } from "./activities/hello.mjs";

const GRPC_ADDRESS = process.env.DURABLE_TASK_GRPC_ADDRESS || "localhost:4001";

async function main() {
  const worker = new TaskHubGrpcWorker(GRPC_ADDRESS);
  worker.addOrchestrator(functionChainingOrchestrator);
  worker.addActivity(hello);

  console.log(`[worker] Starting worker against ${GRPC_ADDRESS}`);
  await worker.start();
  console.log(`[worker] Worker started. Press Ctrl+C to exit.`);

  // Keep process alive
  process.stdin.resume();

  const shutdown = async () => {
    console.log("[worker] Stopping worker...");
    await worker.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => {
  console.error("[worker] Fatal error starting worker", err);
  process.exit(1);
});
