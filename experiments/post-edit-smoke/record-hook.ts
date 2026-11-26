import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Fixture-owned observer: forward the real hook's response without coaching it.
const root = process.cwd();
const before = readFileSync(path.join(root, 'greeting.mjs'), 'utf8');
const input = readFileSync(0, 'utf8');
const recordPath = process.env.POST_EDIT_SMOKE_RECORD;
if (!recordPath) throw new Error('POST_EDIT_SMOKE_RECORD is required');
const hook = path.resolve(
  import.meta.dirname,
  '../../packages/cli/templates/hooks/post-tool-lint.ts',
);
const result = spawnSync(process.execPath, [hook], {
  cwd: root,
  input,
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  timeout: 15_000,
});
appendFileSync(
  recordPath,
  `${JSON.stringify({
    before,
    after: readFileSync(path.join(root, 'greeting.mjs'), 'utf8'),
    output: result.stdout,
    status: result.status,
  })}\n`,
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
