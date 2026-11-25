import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { VERSION } from '../../src/version.js';
import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { refreshCursorProjectCatalogue } from '../helpers/cursor-project-catalogue.js';
import {
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
  refreshNativeCatalogueProbe,
} from '../helpers/native-catalogue-probe.js';
import {
  createPropagationSource,
  generatePropagationPackage,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Real reconciliation + installed hook process, not IDE delivery or native proof.
it('refreshes one canonical verification rule into an installed typed gate and preserves the old failure', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-policy-source-'));
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const source = createPropagationSource(root, inputs);
    const environment = {
      ...process.env,
      HOME: nodePath.join(root, 'private-home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'private-config'),
      CODEX_HOME: nodePath.join(root, 'private-codex'),
      CLAUDE_CONFIG_DIR: nodePath.join(root, 'private-claude'),
      OPENCODE_CONFIG_DIR: nodePath.join(root, 'private-opencode'),
      SAFEWORD_CLI: nodePath.join(source, 'src/cli.ts'),
      SAFEWORD_PLUGIN_CLI: nodePath.join(source, 'src/cli.ts'),
      SAFEWORD_NO_AUTO_UPGRADE: '1',
    };
    const workspace = nodePath.join(root, 'workspace');
    mkdirSync(workspace);
    const ticket = nodePath.join(workspace, '.project/tickets/PRP123-propagation');
    mkdirSync(ticket, { recursive: true });
    const content = '---\nid: PRP123\ntype: task\nstatus: in_progress\nphase: done\n---\n';
    writeFileSync(nodePath.join(ticket, 'ticket.md'), content);
    // A real local suite executes during done-gate evaluation; no receipt or
    // caller-authored test-success result is imported into the policy.
    writeFileSync(
      nodePath.join(workspace, 'package.json'),
      JSON.stringify({ scripts: { test: 'node fixture-test.cjs' } }),
    );
    writeFileSync(
      nodePath.join(workspace, 'fixture-test.cjs'),
      "require('node:assert/strict').equal(require('./fixture.cjs')(2), 4);\n",
    );
    writeFileSync(nodePath.join(workspace, 'fixture.cjs'), 'module.exports = n => n * 2;\n');
    const verify = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    writeFileSync(nodePath.join(ticket, 'verify.md'), verify);
    // Use the existing installed test toolchain without network installation.
    symlinkSync(
      nodePath.resolve(import.meta.dirname, '../../node_modules'),
      nodePath.join(workspace, 'node_modules'),
    );
    await refreshCursorProjectCatalogue(source, workspace, 'install', environment);
    const invoke = () => {
      const manifest = JSON.parse(
        readFileSync(nodePath.join(workspace, '.cursor/hooks.json'), 'utf8'),
      );
      const binding = manifest.hooks.preToolUse.find((row: { command: string }) =>
        row.command.includes('/cursor/pre-tool-quality.ts'),
      );
      expect(binding, 'INSTALLED_POLICY_BINDING_MISSING').toBeDefined();
      const result = spawnSync('sh', ['-c', binding.command], {
        cwd: workspace,
        env: environment,
        input: JSON.stringify({
          workspace_roots: [workspace],
          conversation_id: 'propagation-policy',
          tool_name: 'Write',
          tool_input: {
            file_path: nodePath.join(ticket, 'ticket.md'),
            content: content.replace('status: in_progress', 'status: done'),
          },
        }),
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout);
    };
    expect(invoke()).toEqual({ permission: 'allow' });
    const probe = await createNativeCatalogueProbe(root, undefined, 'explain', {
      ...inputs,
      sourcePackage: source,
    });
    const baseline = nodePath.join(root, 'baseline-package');
    cpSync(probe.packageRoot, baseline, { recursive: true });
    const marker = `VERIFICATION_${randomUUID()}`;
    requirePropagationVerificationMarker(inputs, marker);
    cpSync(inputs.canonicalRoot, nodePath.join(source, 'templates'), { recursive: true });
    await refreshCursorProjectCatalogue(source, workspace, 'upgrade', environment);
    expect(invoke(), 'CANONICAL_POLICY_REFRESH_NOT_OBSERVED').toMatchObject({
      permission: 'deny',
      user_message: expect.stringContaining(`PROPAGATION_VERIFICATION_MARKER_REQUIRED:${marker}`),
    });
    writeFileSync(nodePath.join(ticket, 'verify.md'), `${verify}\n${marker}\n`);
    expect(invoke()).toEqual({ permission: 'allow' });
    writeFileSync(nodePath.join(ticket, 'verify.md'), `**PR Scope:** ❌ Wrong scope\n${marker}\n`);
    expect(invoke()).toMatchObject({
      permission: 'deny',
      user_message: expect.stringContaining('PR scope failed'),
    });
    const refreshed = await refreshNativeCatalogueProbe(probe, {
      ...inputs,
      sourcePackage: source,
    });
    const current = refreshed.packageRoot;
    expect(current).toBe(probe.packageRoot);
    const runtime = readFileSync(nodePath.join(current, 'runtime/cli.js'), 'utf8');
    expect(runtime).toContain(marker);
    expect(runtime).not.toBe(readFileSync(nodePath.join(baseline, 'runtime/cli.js'), 'utf8'));
    const config = nodePath.join(workspace, '.safeword/config.json');
    const settings = JSON.parse(readFileSync(config, 'utf8'));
    writeFileSync(
      config,
      JSON.stringify({
        ...settings,
        terminalHandoffCorrection: false,
        architectureReviewGate: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    const stop = (carrier: string, evidence: string) => {
      writeFileSync(nodePath.join(ticket, 'ticket.md'), content);
      writeFileSync(nodePath.join(ticket, 'verify.md'), evidence);
      const session = 'propagation-stop';
      const identity = resolveRunIdentity({ session_id: session }, { runtime: 'codex' });
      writeFileSync(
        getStateFilePath(workspace, identity),
        JSON.stringify({ activeTicket: 'PRP123' }),
      );
      const result = spawnSync(
        'bun',
        [nodePath.join(carrier, 'runtime/cli.js'), 'hook', 'codex', 'stop'],
        {
          cwd: workspace,
          env: {
            PATH: process.env.PATH,
            HOME: nodePath.join(root, 'private-home'),
            CODEX_HOME: nodePath.join(root, 'private-codex'),
            SAFEWORD_NO_AUTO_UPGRADE: '1',
            SAFEWORD_SKIP_INSTALL: '1',
          },
          input: JSON.stringify({ cwd: workspace, session_id: session, hook_event_name: 'Stop' }),
          encoding: 'utf8',
          timeout: 30_000,
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout);
    };
    expect(stop(baseline, verify)).toEqual({});
    expect(
      readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8'),
      'CODEX_BASELINE_COMPLETION_NOT_RUN',
    ).toMatch(/^status: done$/mu);
    expect(stop(current, verify), 'GENERATED_RUNTIME_POLICY_NOT_REFRESHED').toMatchObject({
      decision: 'block',
      reason: expect.stringContaining(`PROPAGATION_VERIFICATION_MARKER_REQUIRED:${marker}`),
    });
    expect(stop(current, `${verify}\n${marker}\n`)).toEqual({});
    expect(stop(current, `**PR Scope:** ❌ Wrong scope\n${marker}\n`)).toMatchObject({
      decision: 'block',
      reason: expect.stringContaining('PR scope failed'),
    });
    const sdk = nodePath.join(root, 'sdk-package');
    await generatePropagationPackage({ ...inputs, sourcePackage: source }, sdk, 'opencode');
    expect(readFileSync(nodePath.join(sdk, 'runtime/cli.js'), 'utf8')).toContain(marker);
    const sdkManifest = JSON.parse(readFileSync(nodePath.join(sdk, 'package.json'), 'utf8'));
    expect(sdkManifest.dependencies['@opencode/plugin']).toBe('2.0.32');
    const claude = nodePath.join(root, 'claude-package');
    await generatePropagationPackage({ ...inputs, sourcePackage: source }, claude, 'claude');
    expect(readFileSync(nodePath.join(claude, 'runtime/cli.js'), 'utf8')).toContain(marker);
    const identity = JSON.parse(readFileSync(nodePath.join(claude, 'identity.json'), 'utf8'));
    expect(identity).toMatchObject({ schema_version: 1, plugin_version: VERSION });
    const claudeSession = 'propagation-claude-stop';
    const claudeIdentity = resolveRunIdentity({ session_id: claudeSession }, { runtime: 'claude' });
    const hooks = JSON.parse(readFileSync(nodePath.join(claude, 'hooks/hooks.json'), 'utf8'));
    const stopBinding = hooks.hooks.Stop.flatMap(
      (row: { hooks: { command: string }[] }) => row.hooks,
    ).find((row: { command: string }) => row.command.includes('/runtime/hooks/stop-quality.ts'));
    expect(stopBinding, 'GENERATED_CLAUDE_STOP_BINDING_MISSING').toBeDefined();
    const invokeClaude = (evidence: string) => {
      writeFileSync(nodePath.join(ticket, 'ticket.md'), content);
      writeFileSync(nodePath.join(ticket, 'verify.md'), evidence);
      writeFileSync(
        getStateFilePath(workspace, claudeIdentity),
        JSON.stringify({ activeTicket: 'PRP123' }),
      );
      const dispatched = spawnSync('sh', ['-c', stopBinding.command], {
        cwd: workspace,
        env: {
          ...environment,
          SAFEWORD_CLI: undefined,
          SAFEWORD_PLUGIN_CLI: nodePath.join(claude, 'runtime/cli.js'),
          CLAUDE_PLUGIN_ROOT: claude,
          CLAUDE_PROJECT_DIR: workspace,
        },
        input: JSON.stringify({
          cwd: workspace,
          session_id: claudeSession,
          hook_event_name: 'Stop',
        }),
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(dispatched.error).toBeUndefined();
      expect(dispatched.status, dispatched.stderr).toBe(0);
      return dispatched.stdout;
    };
    expect(JSON.parse(invokeClaude(verify)), 'CLAUDE_GENERATED_POLICY_NOT_OBSERVED').toMatchObject({
      decision: 'block',
      reason: expect.stringContaining(`PROPAGATION_VERIFICATION_MARKER_REQUIRED:${marker}`),
    });
    expect(invokeClaude(`${verify}\n${marker}\n`), 'CLAUDE_MARKER_PRESENT_NOT_ALLOWED').toBe('');
    expect(JSON.parse(invokeClaude(`**PR Scope:** ❌ Wrong scope\n${marker}\n`))).toMatchObject({
      decision: 'block',
      reason: expect.stringContaining('PR scope failed'),
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
