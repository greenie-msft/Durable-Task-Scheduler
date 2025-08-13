# Function Chaining (JavaScript)

## Pattern Summary
Sequential execution of multiple activities where each step depends on the result of the previous step. Demonstrates deterministic orchestrator generator function, ordered activity calls, and returning a final aggregated result.

## Files
- `client/`: Starts the orchestration and waits for completion.
- `worker/`: Registers the orchestration + activities and hosts the worker.
- `tests/`: Simple smoke test to validate happy path.

## Run Locally
Prerequisites: Node >=18, Durable Task Scheduler emulator running (gRPC on localhost:4001). If using the official emulator container ensure it exposes port 4001.

1. Install dependencies
```sh
npm install
```
2. Start the worker (in one terminal)
```sh
npm run worker
```
3. Run the client (in another terminal)
```sh
npm run client
```

## Expected Behavior
Console logs show each activity invocation and final orchestration output array with three greeting strings, e.g.: `["Hello Tokyo!","Hello Seattle!","Hello London!"]`.

## Cleanup
Stop the worker with Ctrl+C. No persistent storage is used beyond the emulator's in‑memory state.
