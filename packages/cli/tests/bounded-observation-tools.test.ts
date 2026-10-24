import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  controlledEnvironment,
  executionToolDetails,
  toolInventory,
} from '../src/bounded-observation/tools.js';

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

it('executes the copied checkout tool at the path retained in its evidence', () => {
  const prefix = nodePath.join(tmpdir(), 'bounded-tool-copy-');
  const directory = realpathSync(mkdtempSync(prefix));
  temporary.push(directory);
  const root = nodePath.join(directory, 'original');
  const clone = nodePath.join(directory, 'candidate');
  const bin = nodePath.join(directory, 'bin');
  const home = nodePath.join(directory, 'home');
  const scratch = nodePath.join(directory, 'tmp');
  const probes = nodePath.join(directory, 'probes');
  for (const path of [bin, home, scratch, probes]) mkdirSync(path);
  for (const tree of [root, clone]) {
    const path = nodePath.join(tree, 'node_modules/.bin');
    mkdirSync(path, { recursive: true });
    const executable = nodePath.join(path, 'codex');
    writeFileSync(
      executable,
      "#!/usr/bin/env node\nconsole.log(require('node:fs').realpathSync(process.argv[1]));\n",
    );
    chmodSync(executable, 0o755);
  }
  const tools = toolInventory(root);
  const environment = controlledEnvironment(tools, bin, home);
  const details = executionToolDetails(tools, root, clone, environment, probes);
  const actual = execFileSync(nodePath.join(bin, 'codex'), ['--version'], {
    env: environment,
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  const codex = details.codex;
  if (codex === undefined) throw new Error('Copied Codex metadata is missing');
  expect(codex.execution_path).toBe(nodePath.join(clone, 'node_modules/.bin/codex'));
  expect(actual).toBe(codex.execution_path);
});
