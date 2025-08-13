// Activity: hello
// Activities run outside the deterministic orchestrator and can perform I/O.
// They may be re-run if the orchestration is replayed after a failure (at-least-once).
export async function hello(_ctx, name) {
  console.log(`[activity:hello] Saying hello to ${name}`);
  return `Hello ${name}!`;
}
