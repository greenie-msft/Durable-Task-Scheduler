// Simple smoke test: starts a worker in-process, schedules orchestration, asserts output shape.
import { TaskHubGrpcClient, TaskHubGrpcWorker } from "durabletask-js";
import { functionChainingOrchestrator } from "../worker/orchestrations/functionChainingOrchestrator.mjs";
import { hello } from "../worker/activities/hello.mjs";

const GRPC_ADDRESS = process.env.DURABLE_TASK_GRPC_ADDRESS || "localhost:4001";

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function run() {
  const worker = new TaskHubGrpcWorker(GRPC_ADDRESS);
  worker.addOrchestrator(functionChainingOrchestrator);
  worker.addActivity(hello);
  await worker.start();
  const client = new TaskHubGrpcClient(GRPC_ADDRESS);
  const id = await client.scheduleNewOrchestration(functionChainingOrchestrator);
  const state = await client.waitForOrchestrationCompletion(id, undefined, 30);
  if (!state) throw new Error("No state returned");
  const output = JSON.parse(state.serializedOutput);
  if (!Array.isArray(output) || output.length !== 3) {
    throw new Error(`Unexpected output: ${state.serializedOutput}`);
  }
  console.log("[test] PASS output:", output);
  await client.stop();
  await worker.stop();
  // give time for shutdown
  await sleep(200);
}

run().catch(err => {
  console.error("[test] FAIL", err);
  process.exit(1);
});
