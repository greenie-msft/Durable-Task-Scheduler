// Client starter: schedules the function chaining orchestration and waits for completion.
// Expects the Durable Task Scheduler emulator gRPC endpoint exposed locally.
import { TaskHubGrpcClient } from "durabletask-js";
import { functionChainingOrchestrator } from "../worker/orchestrations/functionChainingOrchestrator.mjs";

const GRPC_ADDRESS = process.env.DURABLE_TASK_GRPC_ADDRESS || "localhost:4001";

async function run() {
  const client = new TaskHubGrpcClient(GRPC_ADDRESS);
  console.log(`[client] Scheduling function-chaining orchestration...`);
  const instanceId = await client.scheduleNewOrchestration(functionChainingOrchestrator);
  console.log(`[client] Instance scheduled with ID: ${instanceId}`);

  // Wait up to 30s for completion
  const state = await client.waitForOrchestrationCompletion(instanceId, undefined, 30);
  if (!state) {
    console.error("[client] Orchestration did not complete within timeout.");
  } else {
    console.log(`[client] Orchestration runtime status: ${state.runtimeStatus}`);
    console.log(`[client] Orchestration output: ${state.serializedOutput}`);
  }
  await client.stop();
}

run().catch(err => {
  console.error("[client] Error running client:", err);
  process.exit(1);
});
