import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

// Test-only host control. This is deliberately not a Safeword policy adapter.
const payload = readFileSync(0, 'utf8');
const input = JSON.parse(payload) as {
  hook_event_name: string;
  cursor_version: string;
  workspace_roots: string[];
  command?: string;
};
const workspace = input.workspace_roots[0];
if (!workspace || !nodePath.isAbsolute(workspace)) throw new Error('Missing workspace');
const disposition = process.argv[2];
let decision: { permission: string; user_message?: string };
if (disposition === 'shared') {
  const adapter = nodePath.resolve(
    import.meta.dirname,
    '../../../templates/hooks/cursor/before-shell-execution.ts',
  );
  const result = spawnSync('bun', [adapter], {
    cwd: workspace,
    input: payload,
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (result.status !== 0) throw new Error('Shared Safeword adapter failed');
  decision = JSON.parse(result.stdout) as typeof decision;
} else {
  if (disposition !== 'allow' && disposition !== 'deny') throw new Error('Missing disposition');
  decision = {
    permission: disposition,
    user_message: `SAFEWORD_CLI_BOUNDARY_CONTROL_${disposition.toUpperCase()}`,
  };
}
appendFileSync(
  nodePath.join(workspace, '.host-contract/boundary-decisions.jsonl'),
  `${JSON.stringify({
    event: input.hook_event_name,
    version: input.cursor_version,
    command: input.command,
    decision,
  })}\n`,
);
process.stdout.write(`${JSON.stringify(decision)}\n`);
