import { appendFileSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

// Independent host-discovery control, never an enrollment or policy implementation.
const configPath = process.argv[2];
if (configPath === undefined || process.argv.length !== 3) {
  throw new Error('Expected the synthetic workspace discovery configuration');
}
const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
  workspace: string;
  version: string;
  pluginPaths: string[];
};
const input = JSON.parse(readFileSync(0, 'utf8')) as {
  hook_event_name?: string;
  cursor_version?: string;
  workspace_roots?: string[];
};
appendFileSync(
  nodePath.join(config.workspace, '.host-contract', 'workspace-open-observations.jsonl'),
  `${JSON.stringify({
    event: input.hook_event_name,
    version: input.cursor_version,
    roots: input.workspace_roots,
  })}\n`,
);
if (
  input.hook_event_name !== 'workspaceOpen' ||
  input.cursor_version !== config.version ||
  input.workspace_roots?.length !== 1 ||
  input.workspace_roots[0] === undefined ||
  realpathSync(input.workspace_roots[0]) !== realpathSync(config.workspace)
) {
  throw new Error('Workspace discovery control received a different host or workspace');
}
for (const pluginPath of config.pluginPaths) {
  if (!nodePath.isAbsolute(pluginPath)) throw new Error('Expected an absolute test plugin path');
  realpathSync(pluginPath);
}
writeFileSync(
  nodePath.join(config.workspace, '.host-contract', 'workspace-open.json'),
  `${JSON.stringify({
    event: input.hook_event_name,
    version: input.cursor_version,
    workspace: realpathSync(config.workspace),
    pluginPaths: config.pluginPaths,
  })}\n`,
);
process.stdout.write(`${JSON.stringify({ pluginPaths: config.pluginPaths })}\n`);
