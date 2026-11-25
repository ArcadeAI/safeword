import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import {
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
} from '../helpers/native-catalogue-probe.js';
import { preparePropagationReadiness } from '../helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Actual installed post-tool producer -> native transport's real dispatcher.
// No native host, model or external PR creation in this source control.
it('uses normal closure evidence before observing the current shared verification rule', async () => {
  const root = mkdtempSync(nodePath.join('/tmp', 'opencode-native-readiness-'));
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const sourcePackage = createPropagationSource(root, inputs);
    const marker = 'VERIFICATION_ab-cd';
    requirePropagationVerificationMarker(inputs, marker);
    const probe = await createNativeCatalogueProbe(root, undefined, 'explain', {
      ...inputs,
      sourcePackage,
    });
    const project = nodePath.join(root, 'project');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), 'Synthetic enrollment\n');
    writeFileSync(nodePath.join(project, '.safeword/config.json'), '{}');
    const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const fixture = await preparePropagationReadiness(
      project,
      probe.packageRoot,
      scope,
      `${scope}${marker}\n`,
      root,
    );
    const receipt = JSON.parse(
      readFileSync(nodePath.join(project, '.project/readiness-ticket.json'), 'utf8'),
    );
    expect(receipt.ticket_id).toBe('PRP123');
    const invoke = () =>
      spawnSync(
        'bun',
        [nodePath.join(probe.packageRoot, 'runtime/cli.js'), 'hook', 'codex', 'pre-tool-use'],
        {
          cwd: project,
          encoding: 'utf8',
          env: {
            ...process.env,
            SAFEWORD_AGENT_RUNTIME: 'opencode',
            SAFEWORD_CODEX_DENY_MODE: 'exit-code',
            SAFEWORD_PLUGIN_CLI: nodePath.join(probe.packageRoot, 'runtime/cli.js'),
            SAFEWORD_CLI: undefined,
          },
          input: JSON.stringify({
            cwd: project,
            session_id: 'source-native-session',
            hook_event_name: 'PreToolUse',
            tool_name: 'Bash',
            tool_input: { command: fixture.command },
          }),
        },
      );
    const denied = invoke();
    expect(denied.status, denied.stderr).toBe(2);
    expect(denied.stderr).toContain('invalid verification evidence');
    writeFileSync(nodePath.join(fixture.ticket, 'verify.md'), `${scope}${marker}\n`);
    const allowed = invoke();
    expect(allowed.status, allowed.stderr).toBe(0);
    const effect = spawnSync('sh', ['-c', fixture.command], { cwd: project, encoding: 'utf8' });
    expect(effect.status, effect.stderr).toBe(0);
    expect(readFileSync(fixture.effect, 'utf8')).toBe(fixture.marker);
    // A retained same-ticket/HEAD record cannot stand in for a later producer
    // invocation. Substitute only this disposable installed producer's process.
    writeFileSync(nodePath.join(probe.packageRoot, 'runtime/cli.js'), 'process.exit(0);\n');
    await expect(
      preparePropagationReadiness(project, probe.packageRoot, scope, `${scope}${marker}\n`, root),
    ).rejects.toThrow('normal readiness producer did not close Given');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
