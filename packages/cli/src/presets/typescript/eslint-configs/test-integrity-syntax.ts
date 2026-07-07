/**
 * Shared no-restricted-syntax entries for the test-integrity graduation
 * (VFD6X1 + review hardening, issue #773): the testing-guide invariants that
 * need no plugin, consumable by both the vitest lane and the bun:test lane so
 * the guide's promise holds on either runner.
 */

interface RestrictedSyntaxEntry {
  selector: string;
  message: string;
}

/**
 * Arbitrary-sleep idioms. Selectors match the *idioms*, not every setTimeout —
 * fake-timer scheduling and template-string fixtures stay legal. Known
 * accepted false positive: a timeout-guard race (`await new Promise((res,
 * rej) => { start(res); setTimeout(() => rej(...), 5000); })`) matches the
 * descendant selector even though it isn't a sleep — vi.waitFor/expect.poll
 * are the better pattern there anyway, and an inline disable with a reason is
 * the escape hatch.
 */
export const SLEEP_RESTRICTED_SYNTAX: RestrictedSyntaxEntry[] = [
  {
    selector:
      "AwaitExpression > NewExpression[callee.name='Promise'] CallExpression[callee.name='setTimeout']",
    message:
      'Arbitrary sleep (await new Promise + setTimeout) — poll an observable condition instead (expect.poll / vi.waitFor). See testing-guide.md.',
  },
  {
    selector: "CallExpression[callee.object.name='Bun'][callee.property.name='sleep']",
    message:
      'Arbitrary sleep (Bun.sleep) — poll an observable condition instead (expect.poll / vi.waitFor). See testing-guide.md.',
  },
  {
    selector: "CallExpression[callee.name='sleep']",
    message:
      'Arbitrary sleep — poll an observable condition instead (expect.poll / vi.waitFor). See testing-guide.md.',
  },
];

/**
 * Deferred-test marker for lanes WITHOUT the vitest plugin (the vitest lane
 * uses the plugin's warn rule for this marker, which robustly covers chained
 * modifiers). Two attribute shapes: a direct `it.<marker>(...)` and a chained
 * `it.concurrent.<marker>(...)` — the chained form was a verified bypass of
 * the direct-only selector (quality review, 2026-07-07).
 */
export const DEFERRED_TEST_RESTRICTED_SYNTAX: RestrictedSyntaxEntry[] = [
  {
    selector:
      "CallExpression > MemberExpression[property.name='todo']:matches([object.name=/^(it|test|describe)$/], [object.object.name=/^(it|test|describe)$/])",
    message:
      'Deferred-test marker parks a gap the suite then reports as green — write the test or delete the stub (an inline eslint-disable with a reason is the sanctioned escape hatch).',
  },
];
