import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { runTests } from '../../templates/hooks/lib/test-runner.ts';

it('runs project tests without the calling hook project and plugin routes', () => {
  const project = mkdtempSync(path.join(tmpdir(), 'safeword-test-environment-'));
  const hookVariables = [
    'CLAUDE_PROJECT_DIR',
    'CLAUDE_PLUGIN_ROOT',
    'SAFEWORD_PLUGIN_CLI',
    'SAFEWORD_PACKAGED_CONTEXT_PATH',
  ];
  const overrides = {
    ...Object.fromEntries(hookVariables.map(key => [key, project])),
    SAFEWORD_CLI: path.resolve(import.meta.dirname, '../../src/cli.ts'),
    SAFEWORD_FAKE_TOOLS: 'all',
    SAFEWORD_TEST_APPLICATION_VALUE: 'retained',
  };
  const original = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  const script = `const keys = ${JSON.stringify(hookVariables)}; if (keys.some(key => process.env[key] !== undefined) || process.env.SAFEWORD_TEST_APPLICATION_VALUE !== 'retained') process.exit(1); console.log('ISOLATED_TEST_OK');`;
  writeFileSync(path.join(project, 'check.cjs'), script);
  writeFileSync(path.join(project, 'package-lock.json'), '{}\n');
  writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({ scripts: { 'test:done': 'node check.cjs', 'test:bdd': 'node check.cjs' } }),
  );
  try {
    Object.assign(process.env, overrides);
    const result = runTests(project);
    expect(result.skipped).toBe(false);
    expect(result.passed, result.output).toBe(true);
    expect(result.output).toContain('ISOLATED_TEST_OK');
    for (const key of hookVariables) expect(process.env[key]).toBe(project);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
    rmSync(project, { recursive: true, force: true });
  }
});
