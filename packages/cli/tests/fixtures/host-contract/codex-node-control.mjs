// Supporting real Node observation, never a native Codex receipt.
import path from 'node:path';
import process from 'node:process';
import { run } from 'node:test';

const observed = { passed: 0, failed: 0, events: [], success: false };
const events = run({
  cwd: process.cwd(),
  testSkipPatterns: process.argv[2] ? [process.argv[2]] : [],
});
for await (const event of events) {
  if (!['test:pass', 'test:fail', 'test:summary'].includes(event.type)) continue;
  observed.events.push(event);
  const data = event.data;
  if (event.type === 'test:summary' && data.file === undefined) observed.success = data.success;
  if (data.details?.type !== 'test' || data.skip || data.todo || !data.file) continue;
  // Node synthesizes a file-level pass/fail when no actual case was reported.
  if ([data.file, path.relative(process.cwd(), data.file)].includes(data.name)) continue;
  if (event.type === 'test:pass') observed.passed++;
  else if (event.type === 'test:fail') observed.failed++;
}
process.stdout.write(
  `${JSON.stringify(observed, (_key, value) =>
    value instanceof Error ? { name: value.name, message: value.message, code: value.code } : value,
  )}\n`,
);
process.exitCode = observed.success ? 0 : 1;
