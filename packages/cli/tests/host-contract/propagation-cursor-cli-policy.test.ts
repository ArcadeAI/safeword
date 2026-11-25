import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { PropagationOutcomeError } from '../../scripts/lib/propagation-policy-phases.js';
import {
  captureNativePropagationActor,
  nativePropagationExit,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import { readSessionActiveTicket } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { CursorCliCatalogueActor } from '../helpers/cursor-cli-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { preparePropagationCompletion } from '../helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Substitute the external vendor process only. Generated Stop bindings run
// directly as component characterization; later native-shaped catalogue and
// pre-shell events come from the substituted process. No native-host proof.
it.each(process.platform === 'darwin' ? ['portable-sh', 'macos-zsh'] : ['portable-sh'])(
  'refreshes the same Cursor CLI hook extension from its owned canonical policy (%s)',
  async transport => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-owned-policy-'));
    let actor: CursorCliCatalogueActor | undefined;
    try {
      mkdirSync(nodePath.join(root, 'vendor-empty-login'));
      const inputs = createCanonicalCatalogueInputs(root);
      const sourcePackage = createPropagationSource(root, inputs);
      const current = { ...inputs, sourcePackage };
      const binary = nodePath.join(root, 'version-only');
      writeFileSync(
        binary,
        '#!/bin/sh\n[ "$1" = --version ] || exit 91\necho 2026.11.05-86047df\n',
        {
          mode: 0o755,
        },
      );
      const marker = 'VERIFICATION_cc-dd';
      requirePropagationVerificationMarker(inputs, marker);
      actor = new CursorCliCatalogueActor(binary, current);
      await actor.prepare('Cursor', '2026.11.05-86047df', 'CLI');
      const installation = JSON.parse(actor.observedInstallation());
      const [extension, workspace] = installation as [string, string];
      const run = (evidence: string) => {
        const { ticket } = preparePropagationCompletion(
          workspace,
          'source-conversation',
          'cursor',
          evidence,
        );
        expect(
          readSessionActiveTicket(
            workspace,
            resolveRunIdentity({ conversation_id: 'source-conversation' }, { runtime: 'cursor' }),
          )?.folder,
          'PROPAGATION_CURSOR_TICKET_NOT_BOUND',
        ).toBe('PRP123-propagation');
        const executed = nodePath.join(workspace, '.host-contract/local-tests-ran');
        rmSync(executed, { force: true });
        appendFileSync(
          nodePath.join(workspace, 'fixture-test.cjs'),
          `require('node:fs').writeFileSync(${JSON.stringify(executed)}, 'actual-node-test');\n`,
        );
        const hooks = JSON.parse(
          readFileSync(nodePath.join(extension, 'hooks/hooks.json'), 'utf8'),
        );
        const binding = hooks.hooks.stop;
        expect(binding).toHaveLength(1);
        expect(binding[0].loop_limit).toBe(1);
        const result = spawnSync('sh', ['-c', binding[0].command], {
          cwd: workspace,
          encoding: 'utf8',
          env: { ...process.env, CURSOR_PLUGIN_ROOT: extension, SAFEWORD_CLI: undefined },
          input: JSON.stringify({
            workspace_roots: [workspace],
            conversation_id: 'source-conversation',
            status: 'completed',
            loop_count: 0,
          }),
        });
        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(executed, 'utf8')).toBe('actual-node-test');
        return {
          decision: JSON.parse(result.stdout),
          ticket: readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8'),
        };
      };
      const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
      const denied = run(scope);
      expect(
        denied.decision.followup_message,
        'PROPAGATION_CURSOR_EXTENSION_POLICY_STALE',
      ).toContain(marker);
      expect(denied.ticket).toMatch(/^status: in_progress$/mu);
      expect(run(`${scope}\n${marker}\n`)).toEqual({
        decision: {},
        ticket: expect.stringMatching(/^status: in_progress$/mu),
      });
      const next = 'VERIFICATION_ee-ff';
      requirePropagationVerificationMarker(inputs, next);
      await actor.refreshResources(current);
      expect(actor.observedInstallation()).toBe(JSON.stringify(installation));
      expect(run(`${scope}\n${marker}\n`).decision.followup_message).toContain(next);
      expect(run(`${scope}\n${marker}\n${next}\n`).decision).toEqual({});
      // Substitute the vendor process only; execute the actual generated hook
      // through the transparent frozen observer, with the real Cursor protocol.
      writeFileSync(
        binary,
        `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(nodePath.join(root, 'host.mjs'))} "$@"\n`,
        { mode: 0o755 },
      );
      writeFileSync(
        nodePath.join(root, 'host.mjs'),
        String.raw`
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(nodePath.join(root, 'vendor-environment.json'))}, JSON.stringify({ config: process.env.CURSOR_CONFIG_DIR, data: process.env.CURSOR_DATA_DIR }));
const extensions = args.flatMap((arg, index) => arg === '--plugin-dir' ? [args[index + 1]] : []);
const extension = extensions.find(item => existsSync(path.join(item, 'hooks/hooks.json')));
const catalogue = args.at(-1).includes('installed explain skill');
const session = catalogue ? 'catalogue-component-session' : 'native-component-session';
if (catalogue) {
  const core = extensions.find(item => existsSync(path.join(item, 'skills/explain/SKILL.md')));
  const command = 'bun ' + JSON.stringify(path.join(core, 'runtime/cli.js')) + ' project runtime audit-principle-trace --cwd ' + JSON.stringify(process.cwd()) + ' --';
  const helper = spawnSync('sh', ['-c', command], { env: process.env, encoding: 'utf8' });
  if (helper.status !== 0) throw new Error(helper.stderr);
  console.log(JSON.stringify({ type: 'tool_call', subtype: 'completed', tool_call: { shellToolCall: {
    args: { command, parsingResult: { executableCommands: [{ name: 'bun', fullText: command }] } },
    result: { success: { stdout: helper.stdout, exitCode: helper.status } }
  } } }));
  console.log(JSON.stringify({ type: 'assistant', text: readFileSync(path.join(core, 'skills/explain/SKILL.md'), 'utf8') + readFileSync(path.join(core, 'skills/explain/references/HOST_CONTRACT_GUIDE.md'), 'utf8') }));
}
if (!catalogue) {
  const command = /Command: (.+)\n/u.exec(args.at(-1))?.[1];
  if (!command) throw Error('No owned readiness command');
  const binding = JSON.parse(readFileSync(path.join(extension, 'hooks/hooks.json'), 'utf8')).hooks.beforeShellExecution[0];
  const observedCommand = existsSync(${JSON.stringify(nodePath.join(root, 'wrong-command'))}) ? 'printf unrelated' : command;
  let decision = { permission: 'allow' };
  if (!existsSync(${JSON.stringify(nodePath.join(root, 'omit'))})) {
    // Reset PATH in both process substitutes. Source only owned startup files
    // portably; macOS additionally exercises the real zsh login sequence.
    const shell = process.env.ZDOTDIR?.startsWith(path.dirname(process.cwd()) + path.sep)
      ? process.env.ZDOTDIR : ${JSON.stringify(nodePath.join(root, 'vendor-empty-login'))};
    const realLogin = ${JSON.stringify(transport)} === 'macos-zsh';
    const executable = realLogin ? '/bin/zsh' : 'sh';
    const hookArgs = realLogin ? ['-lc', binding.command] : [
      '-c', 'if [ -f "$ZDOTDIR/.zprofile" ]; then . "$ZDOTDIR/.zprofile"; fi\nexec sh -c "$1"',
      'cursor-login-fixture', binding.command
    ];
    const result = spawnSync(executable, hookArgs, {
      env: { ...process.env, ZDOTDIR: shell, PATH: path.dirname(process.env.SAFEWORD_OBSERVER_REAL_BUN) + ':' + process.env.PATH, CURSOR_PLUGIN_ROOT: extension }, encoding: 'utf8',
      input: JSON.stringify({ workspace_roots: [process.cwd()], conversation_id: session,
        hook_event_name: 'beforeShellExecution', command: observedCommand, cwd: '' })
    });
    if (result.status !== 0) throw new Error(result.stderr);
    decision = JSON.parse(result.stdout);
  }
  const permissions = JSON.parse(readFileSync(path.join(process.cwd(), '.cursor/cli.json'), 'utf8')).permissions.allow;
  const executable = command.match(/^('[^']+') /u)?.[1];
  const permitted = permissions.includes('Shell(' + executable + ')');
  const child = decision.permission === 'allow' && permitted && !existsSync(${JSON.stringify(nodePath.join(root, 'no-effect'))}) ? spawnSync('sh', ['-c', command], { encoding: 'utf8' }) : undefined;
  const event = { type: 'tool_call', subtype: 'completed', tool_call: { shellToolCall: {
    args: { command }, result: child ? { success: { stdout: child.stdout, exitCode: child.status } }
      : { rejected: { reason: 'Command execution was blocked by a hook: ' + decision.user_message } }
  } } };
  if (existsSync(${JSON.stringify(nodePath.join(root, 'no-effect'))})) event.tool_call.shellToolCall.result = { success: { stdout: '', exitCode: 0 } };
  if (existsSync(${JSON.stringify(nodePath.join(root, 'wrong-reason'))})) event.tool_call.shellToolCall.result = { rejected: { reason: 'Unrelated vendor permission refusal' } };
  console.log(JSON.stringify(event));
  if (existsSync(${JSON.stringify(nodePath.join(root, 'duplicate'))})) console.log(JSON.stringify(event));
}
if (existsSync(${JSON.stringify(nodePath.join(root, 'process-failure'))})) {
  console.log(JSON.stringify({ type: 'diagnostic', message: 'Actual partial vendor output' }));
  console.error('Actual vendor failure');
  process.exit(7);
}
console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: session }));
`,
      );
      await actor.invokeWorkflow();
      const environment = JSON.parse(
        readFileSync(nodePath.join(root, 'vendor-environment.json'), 'utf8'),
      );
      expect(environment.data, 'CURSOR_DATA_DIRECTORY_NOT_ISOLATED').toBe(
        nodePath.join(nodePath.dirname(workspace), 'data'),
      );
      expect(environment.config).toBe(nodePath.join(nodePath.dirname(workspace), 'profile'));
      expect(actor.observedResources().installation).toBe(actor.observedInstallation());
      const setup = `${scope}\n${marker}\n${next}\n`;
      const before = await actor.observeVerification(setup, setup);
      expect(before.decision).toEqual({ permission: 'allow' });
      expect(before.effect).toBe(before.expectedEffect);
      const resources = [
        'skills/explain/SKILL.md',
        'skills/explain/references/HOST_CONTRACT_GUIDE.md',
        'templates/hooks/audit-principle-trace.ts',
      ];
      const resourceBytes = resources.map(file =>
        readFileSync(nodePath.join(installation[2], file)),
      );
      const changed = 'VERIFICATION_ab-ab';
      requirePropagationVerificationMarker(inputs, changed);
      await actor.refreshResources(current);
      expect(actor.observedInstallation()).toBe(JSON.stringify(installation));
      expect(resources.map(file => readFileSync(nodePath.join(installation[2], file)))).toEqual(
        resourceBytes,
      );
      const valid = `${setup}${changed}\n`;
      const deniedTurn = await actor.observeVerification(setup, valid);
      expect(deniedTurn.decision.permission).toBe('deny');
      expect(deniedTurn.decision.user_message).toContain('invalid verification evidence');
      expect(deniedTurn.effect).toBeUndefined();
      writeFileSync(nodePath.join(root, 'wrong-reason'), '');
      await expect(actor.observeVerification(setup, valid)).rejects.toThrow(
        'CURSOR_NATIVE_DENIAL_NOT_OBSERVED',
      );
      const rejectedRawFile = nodePath.join(nodePath.dirname(workspace), 'readiness-3.jsonl');
      expect(
        readFileSync(rejectedRawFile, 'utf8'),
        'CURSOR_FAILED_TURN_RAW_NOT_RETAINED',
      ).toContain('Unrelated vendor permission refusal');
      rmSync(nodePath.join(root, 'wrong-reason'));
      const allowedTurn = await actor.observeVerification(valid, valid);
      expect(allowedTurn.installation).toBe(deniedTurn.installation);
      expect(allowedTurn.decision).toEqual({ permission: 'allow' });
      expect(allowedTurn.effect).toBe(allowedTurn.expectedEffect);
      expect(JSON.parse(allowedTurn.raw).observations[0].input.conversation_id).toBe(
        'native-component-session',
      );
      expect(JSON.parse(allowedTurn.raw).observations[0].input.hook_event_name).toBe(
        'beforeShellExecution',
      );
      writeFileSync(nodePath.join(root, 'wrong-command'), '');
      await expect(actor.observeVerification(valid, valid)).rejects.toThrow(
        'CURSOR_NATIVE_COMMAND_MISMATCH',
      );
      rmSync(nodePath.join(root, 'wrong-command'));
      writeFileSync(nodePath.join(root, 'no-effect'), '');
      await expect(actor.observeVerification(valid, valid)).rejects.toThrow(
        'CURSOR_ALLOWED_ACTION_EFFECT_MISSING',
      );
      rmSync(nodePath.join(root, 'no-effect'));
      writeFileSync(nodePath.join(root, 'duplicate'), '');
      await expect(actor.observeVerification(valid, valid)).rejects.toThrow(
        'Cursor readiness Shell attempt ambiguous',
      );
      rmSync(nodePath.join(root, 'duplicate'));
      writeFileSync(nodePath.join(root, 'omit'), '');
      await expect(actor.observeVerification(valid, valid)).rejects.toThrow(
        'native Cursor CLI readiness hook missing',
      );
      rmSync(nodePath.join(root, 'omit'));
      writeFileSync(nodePath.join(root, 'process-failure'), '');
      await expect(actor.observeVerification(valid, valid)).rejects.toThrow(
        'Actual vendor failure',
      );
      const failedRawFile = nodePath.join(nodePath.dirname(workspace), 'readiness-9.jsonl');
      expect(readFileSync(failedRawFile, 'utf8')).toContain('Actual partial vendor output');
      expect(readFileSync(`${failedRawFile}.stderr`, 'utf8')).toContain('Actual vendor failure');
      rmSync(nodePath.join(root, 'process-failure'));
      const retainedPolicy = await retainNativeResourceActor(actor).observeVerification(
        valid,
        valid,
      );
      expect(retainedPolicy.protocol).toBe('permission-json');
      assert.ok(retainedPolicy.protocol === 'permission-json');
      expect(retainedPolicy.observation.decision.permission).toBe('allow');
      expect(retainedPolicy.observation.effect).toBe(retainedPolicy.observation.expectedEffect);
      expect(retainedPolicy.observation.installation).toBe(allowedTurn.installation);
      const retainedDenied = await retainNativeResourceActor(actor).observeVerification(
        setup,
        valid,
      );
      assert.ok(retainedDenied.protocol === 'permission-json');
      expect(retainedDenied.observation.decision.permission).toBe('deny');
      expect(retainedDenied.observation.decision.user_message).toContain(
        'invalid verification evidence',
      );
      expect(retainedDenied.observation.effect).toBeUndefined();
      const captured = captureNativePropagationActor(
        retainNativeResourceActor(actor),
        'unit-cli',
        root,
      );
      writeFileSync(nodePath.join(root, 'no-effect'), '');
      await expect(captured.observeVerification(valid, valid)).rejects.toSatisfy(
        error => error instanceof PropagationOutcomeError && nativePropagationExit(error) === 2,
      );
      rmSync(nodePath.join(root, 'no-effect'));
      writeFileSync(nodePath.join(root, 'wrong-reason'), '');
      await expect(captured.observeVerification(setup, valid)).rejects.toSatisfy(
        error => !(error instanceof PropagationOutcomeError) && nativePropagationExit(error) === 3,
      );
    } finally {
      actor?.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);
