# AI Execution Prompt: Generate JavaScript Durable Task Samples

## Role
You are an expert engineer contributing JavaScript samples to the Durable Task Scheduler repository. Your task is to implement JavaScript versions of all durable function patterns already demonstrated in other languages in the repo.

## Source of Truth
Reference patterns and structure in: https://github.com/greenie-msft/Durable-Task-Scheduler/tree/main/samples/durable-task-sdks
JavaScript SDK: https://github.com/microsoft/durabletask-js

## Core Objectives
1. Identify every durable function pattern already present in other languages (e.g., basic orchestration, activity invocation, sub-orchestration, fan-out/fan-in, external events, durable timers, retries, error handling, human interaction / wait for event, etc.).
2. For each pattern, create an equivalent JavaScript sample using `durabletask-js`.
3. Each sample must include BOTH:
   - A client (starter) that schedules the orchestration (or demonstrates interaction like raising events).
   - A worker hosting orchestrations and activities.
4. Ensure local development uses ONLY:
   - Durable Task Scheduler emulator
   - Azurite (local storage emulator)
5. Submit each pattern as its own Pull Request via the GitHub MCP tool.

## Deliverables Per Pattern
Provide a directory under `samples/durable-task-sdks/javascript/<pattern-name>` containing:
- `package.json` (minimal, pinned dependencies)
- `README.md` (see template below)
- `client/` code (starter script)
- `worker/` code (orchestration + activities)
- Optional: `tests/` with at least one happy-path validation (can be a script asserting expected output/state)
- Configuration files if required (e.g., `.env.example`)

## README Template
```
# <Pattern Name> (JavaScript)

## Pattern Summary
Brief explanation of what the pattern demonstrates.

## Files
- client/: Starts the orchestration / raises events
- worker/: Defines orchestration + activities

## Run Locally
Prerequisites: Node >=18, Azurite, Durable Task Scheduler emulator.

1. Install deps
   npm install
2. Start Azurite (if not already running)
3. Start worker
   npm run worker
4. Run client
   npm run client

## Expected Behavior
Describe output, state transitions, and any console logs.

## Cleanup
How to stop processes and clear storage.
```

## Quality / Acceptance Criteria
- Mirrors semantics of equivalent pattern in another language.
- Uses idiomatic JavaScript (ES modules or CommonJS—be consistent across samples; prefer ES modules if repo allows).
- Clear separation between orchestration logic and activities.
- Includes inline comments explaining durable-specific behaviors (determinism, replay, timers, events).
- Startup instructions succeed on a clean machine with only Azurite + emulator installed.
- No extraneous dependencies—only what’s needed.
- Each PR limited to a single pattern.

## Working Process (Loop Until All Patterns Complete)
1. Enumerate patterns by scanning existing language folders.
2. Create a tracking list (patterns + status) in a local temporary file (not committed) or aggregate progress in a new `javascript/README.md` index if desired.
3. For each pattern:
   - Scaffold directory
   - Implement worker (register activities + orchestration)
   - Implement client (start orchestration / handle events)
   - Add minimal test or validation script
   - Add README
   - Run locally (smoke test)
   - Open PR via GitHub MCP tool with descriptive title: `feat(js): <pattern-name> sample`
   - In PR description list: pattern purpose, parity notes, how to run, validation steps.
4. Move to next pattern.

## Tooling & Runtime Assumptions
- Use `durabletask-js` API surface (latest stable release) – pin exact version.
- Provide npm scripts:
  - `worker`: starts worker host
  - `client`: runs the client/starter script
  - `test` (if tests present)
- If environment variables required, include `.env.example` with comments.

## Suggested Directory Layout Example
```
javascript/
  fan-out-fan-in/
    package.json
    README.md
    client/index.mjs
    worker/orchestrations/fanOutFanInOrchestrator.mjs
    worker/activities/processItem.mjs
    worker/index.mjs
    tests/smoke.mjs (optional)
```

## Logging & Observability
- Log orchestration instanceId at start.
- Log each activity invocation (name + input snippet).
- Log completion state (success/failure) and output.

## Error Handling
- Demonstrate retries where applicable (e.g., transient activity failure pattern).
- For failure patterns, show orchestration status progression and final failure reason.

## External Events Pattern Guidance
- Client should raise an external event after a delay (simulate human / external system).
- Orchestrator awaits event with timeout and demonstrates timeout path.

## Timers Pattern Guidance
- Show durable timers (not `setTimeout`) and note deterministic behavior.

## Fan-Out/Fan-In Guidance
- Parallelize N activity calls; aggregate results deterministically.

## Pull Request Checklist
- [ ] Pattern directory added under `javascript/`
- [ ] Client + worker implemented
- [ ] README complete & accurate
- [ ] Dependencies pinned
- [ ] Runs locally with emulator + Azurite
- [ ] Logs show expected flow
- [ ] Parity with other language sample confirmed
- [ ] No unrelated changes

## Final Completion Criteria
All identified patterns have corresponding JavaScript sample directories, merged PRs, and consistent documentation. A summary index (optional) lists each pattern and PR link.

## Output Format For This Prompt
When responding to this prompt:
1. Start by listing discovered patterns and their status (new / in-progress / done).
2. Provide the next actionable implementation step.
3. Only generate code for one pattern at a time unless explicitly instructed otherwise.
4. After generating code, include a self-check section validating acceptance criteria.

## Do Not
- Introduce frameworks beyond what is required (no heavy web frameworks unless pattern demands it).
- Combine multiple patterns in a single PR.
- Leave dependency versions as ranges (use exact versions).

