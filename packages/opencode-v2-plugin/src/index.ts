import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Plugin } from '@opencode/plugin';
import * as Tool from '@opencode/plugin/promise/tool';

import type { WorkerContract } from '../../cli/src/host-contract/workers.js';
import { workerInvocationHeader } from '../../cli/src/host-contract/workers.js';
import type { OPENCODE_V2_PLUGIN_LAYOUT } from '../../cli/src/schema.js';
import { hasSafewordProjectMarker } from '../../cli/src/utils/configured-paths.js';
import { canonicalDirectory } from '../../cli/src/utils/fs.js';

// The generator injects paths from the schema without bundling the entire schema into the SDK entry.
declare const __SAFEWORD_OPENCODE_LAYOUT__: typeof OPENCODE_V2_PLUGIN_LAYOUT;
const layout = __SAFEWORD_OPENCODE_LAYOUT__;
const packageRoot = import.meta.dirname;

async function registerWorkerRestrictions(context: Plugin.Context): Promise<void> {
  const workers = JSON.parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- schema-owned resource in this bundle
    readFileSync(nodePath.join(packageRoot, layout.workers), 'utf8'),
  ) as WorkerContract[];
  const nativeTools = new Map([['Read', 'read']]);
  const masks = new Map(
    workers
      .filter(worker => worker.tools !== undefined)
      .map(worker => {
        const mask = new Set(
          worker.tools?.map(tool => {
            const native = nativeTools.get(tool);
            if (native === undefined)
              throw new Error(
                `OpenCode V2 cannot preserve worker tool authority: ${worker.name}/${tool}`,
              );
            return native;
          }),
        );
        return [workerInvocationHeader(worker.name), mask] as const;
      }),
  );
  const sessions = new Map<string, ReadonlySet<string>>();
  await context.session.hook('prompt', async event => {
    const header = event.prompt.text.split('\n').find(line => masks.has(line));
    if (header === undefined) return;
    const session = await context.session.get({ sessionID: event.sessionID });
    const mask = masks.get(header);
    if (session.parentID !== undefined && mask !== undefined) sessions.set(session.id, mask);
  });
  await context.session.hook('context', event => {
    const mask = sessions.get(event.sessionID);
    if (mask === undefined) return;
    for (const tool of Object.keys(event.tools))
      if (!mask.has(tool)) Reflect.deleteProperty(event.tools, tool);
  });
}

/** Transport only: the bundled shared dispatcher owns every permission decision. */
function dispatch(project: string, envelope: object): Promise<void> {
  return new Promise((resolve, reject) => {
    // Resolve Bun through the host's configured toolchain, as the other native carriers do.
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- use the host-selected Bun toolchain
    const child = spawn('bun', [nodePath.join(packageRoot, layout.dispatcher)], {
      cwd: project,
      env: { ...process.env, SAFEWORD_PLUGIN_CLI: nodePath.join(packageRoot, layout.runtime) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.once('error', error => {
      reject(new Tool.Error({ message: `Safeword guard unavailable: ${error.message}`, error }));
    });
    child.once('close', status => {
      if (status === 0) resolve();
      else
        reject(
          new Tool.Error({
            message: output.trim() || `Safeword guard failed (exit ${String(status)})`,
          }),
        );
    });
    child.stdin.on('error', error => {
      reject(new Tool.Error({ message: `Safeword guard input failed: ${error.message}`, error }));
    });
    child.stdin.end(JSON.stringify(envelope));
  });
}

export default Plugin.define({
  id: 'safeword',
  async setup(context) {
    const project = canonicalDirectory(context.options.projectDirectory);
    if (
      !project ||
      project !== canonicalDirectory(context.location.directory) ||
      !hasSafewordProjectMarker(project)
    )
      return;
    await context.tool.hook('execute.before', async event => {
      await dispatch(project, {
        cwd: project,
        session_id: event.sessionID,
        hook_event_name: 'PreToolUse',
        tool_name: event.tool === 'shell' ? 'Bash' : event.tool,
        tool_input: event.input,
      });
    });
    await registerWorkerRestrictions(context);
  },
});
