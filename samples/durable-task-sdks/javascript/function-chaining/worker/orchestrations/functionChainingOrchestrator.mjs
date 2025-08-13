// Orchestrator: function chaining pattern
// This generator function MUST be deterministic. No Date.now(), random(), or non-durable timers.
// Use yield to schedule activities in sequence and capture their results.
import { whenAll } from "durabletask-js"; // (Not strictly needed here but shows how parallel fan-in would work.)
import { hello } from "../activities/hello.mjs";

export const functionChainingOrchestrator = async function* (ctx) {
  const cities = [];
  const result1 = yield ctx.callActivity(hello, "Tokyo");
  cities.push(result1);
  const result2 = yield ctx.callActivity(hello, "Seattle");
  cities.push(result2);
  const result3 = yield ctx.callActivity(hello, "London");
  cities.push(result3);
  // Return value becomes orchestration output (serialized JSON string in state)
  return cities;
};
