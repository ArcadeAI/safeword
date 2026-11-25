import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import architectureCase from '../fixtures/host-contract/propagation-architecture-case.json';

/** Completed, origin-bound native action contradicted its observed permission. */
export class ObservedPropagationMismatch extends Error {
  constructor(
    readonly observation: { raw: string },
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

/** Ordinary feature/verify inputs from the documented option-composition fixture. */
export interface PropagationArchitectureCase {
  spec: string;
  plan: string;
  options: {
    terminalHandoffCorrection: boolean;
    architectureReviewGate: boolean;
    crossModelReview: boolean;
    designApprovalGate: boolean;
  };
}

/** Same ordinary manual-entry case as policy-options.test.ts, without any approval receipt. */
export function preparePropagationDesignApproval(project: string, enabled: boolean) {
  const directory = nodePath.join(project, '.project/tickets/PRP123-propagation');
  mkdirSync(directory, { recursive: true });
  const file = nodePath.join(directory, 'ticket.md');
  const before =
    '---\nid: PRP123\ntype: feature\nstatus: in_progress\nphase: plan-implementation\n---\n\n# Synthetic options\n';
  writeFileSync(file, before);
  writeFileSync(nodePath.join(directory, 'spec.md'), architectureCase.spec);
  writeFileSync(
    nodePath.join(directory, 'test-definitions.md'),
    '# Planning transition\n\n- [ ] Given a valid planned feature, when its phase is written from plan-implementation to plan-execution, the configured design approval gate either allows the transition or denies it with approve-plan guidance and leaves the ticket unchanged.\n',
  );
  writeFileSync(
    nodePath.join(directory, 'impl-plan.md'),
    architectureCase.plan.replace('**Status:** implemented', '**Status:** planned'),
  );
  const config = nodePath.join(project, '.safeword/config.json');
  const previous = JSON.parse(readFileSync(config, 'utf8'));
  writeFileSync(
    config,
    JSON.stringify({
      ...previous,
      terminalHandoffCorrection: false,
      architectureReviewGate: false,
      crossModelReview: false,
      designApprovalGate: enabled,
      reviewGate: false,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  return {
    file,
    before,
    after: before.replace('phase: plan-implementation', 'phase: plan-execution'),
  };
}

/** Ordinary task/configuration inputs only; never writes a verification receipt. */
export function preparePropagationCompletion(
  project: string,
  session: string,
  runtime: 'claude' | 'codex' | 'cursor' | 'opencode',
  evidence: string,
  architecture?: PropagationArchitectureCase,
) {
  const ticket = nodePath.join(project, '.project/tickets/PRP123-propagation');
  mkdirSync(ticket, { recursive: true });
  const content = architecture
    ? '---\nid: PRP123\ntype: feature\nstatus: in_progress\nphase: verify\n---\n'
    : '---\nid: PRP123\ntype: task\nstatus: in_progress\nphase: done\n---\n';
  if (architecture) {
    writeFileSync(nodePath.join(ticket, 'spec.md'), architecture.spec);
    writeFileSync(nodePath.join(ticket, 'impl-plan.md'), architecture.plan);
  }
  writeFileSync(nodePath.join(ticket, 'ticket.md'), content);
  writeFileSync(nodePath.join(ticket, 'verify.md'), evidence);
  // The actual installed gate executes this independent local Node test.
  writeFileSync(
    nodePath.join(project, 'package.json'),
    JSON.stringify({ scripts: { test: 'node fixture-test.cjs' } }),
  );
  writeFileSync(nodePath.join(project, 'fixture.cjs'), 'module.exports = n => n * 2;\n');
  writeFileSync(
    nodePath.join(project, 'fixture-test.cjs'),
    "require('node:assert/strict').equal(require('./fixture.cjs')(2), 4);\n",
  );
  const config = nodePath.join(project, '.safeword/config.json');
  const previous = JSON.parse(readFileSync(config, 'utf8'));
  writeFileSync(
    config,
    JSON.stringify({
      ...previous,
      terminalHandoffCorrection: false,
      architectureReviewGate: false,
      ...architecture?.options,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  const identity = resolveRunIdentity(
    runtime === 'cursor' ? { conversation_id: session } : { session_id: session },
    { runtime },
  );
  writeFileSync(getStateFilePath(project, identity), JSON.stringify({ activeTicket: 'PRP123' }));
  return { ticket, content };
}

function readinessProducer(project: string, packageRoot: string, ownedDirectory: string) {
  const owned = realpathSync(ownedDirectory);
  const nativeIde = nodePath.basename(owned).startsWith('catalogue-');
  const projectDelivery =
    nativeIde && realpathSync(packageRoot) === nodePath.join(realpathSync(project), '.safeword');
  const cursor = ['cursor-cli-catalogue-', 'guard-', 'catalogue-'].some(prefix =>
    nodePath.basename(owned).startsWith(prefix),
  );
  assert.ok(
    cursor || nodePath.basename(owned).startsWith('opencode-native-'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: readiness Given requires the owned native actor',
  );
  assert.equal(
    realpathSync(project),
    nodePath.join(owned, cursor ? 'workspace' : 'project'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: readiness project outside owned native actor',
  );
  const nativePackage = nativeIde ? 'extension' : 'candidate';
  assert.equal(
    realpathSync(packageRoot),
    nodePath.join(owned, projectDelivery ? 'workspace/.safeword' : nativePackage),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: readiness package outside owned native actor',
  );
  const runtime = nodePath.join(
    packageRoot,
    projectDelivery ? 'hooks/post-tool-quality.ts' : 'runtime/cli.js',
  );
  if (projectDelivery) {
    assert.equal(
      realpathSync(runtime),
      runtime,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign installed readiness producer',
    );
    assert.ok(
      existsSync(nodePath.join(packageRoot, 'version')),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: installed project layout missing',
    );
  }
  return {
    cursor,
    args: projectDelivery ? [runtime] : [runtime, 'hook', 'codex', 'post-tool-use'],
    pluginCli: projectDelivery ? undefined : runtime,
  };
}

/** Ordinary Given closure through the existing installed producer; no supplied receipt JSON. */
export async function preparePropagationReadiness(
  project: string,
  packageRoot: string,
  evidence: string,
  validSetupEvidence: string,
  ownedDirectory: string,
) {
  const { cursor, args, pluginCli } = readinessProducer(project, packageRoot, ownedDirectory);
  const execute = promisify(execFile);
  const git = nodePath.join(project, '.git');
  if (existsSync(git))
    assert.ok(
      lstatSync(git).isDirectory() && !lstatSync(git).isSymbolicLink(),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: readiness Git must use independent owned metadata',
    );
  else {
    await execute('git', ['init', '--quiet'], { cwd: project });
    await execute(
      'git',
      [
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'user.name=Propagation fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '--allow-empty',
        '-qm',
        'Owned propagation Given',
      ],
      { cwd: project },
    );
  }
  const { ticket, content } = preparePropagationCompletion(
    project,
    'propagation-given',
    cursor ? 'cursor' : 'opencode',
    validSetupEvidence,
  );
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    content.replace('status: in_progress', 'status: done'),
  );
  // A retained installation must prove this Given's producer ran, not reuse
  // the prior turn's same-ticket/same-HEAD readiness record.
  const readiness = nodePath.join(project, '.project/readiness-ticket.json');
  rmSync(readiness, { force: true });
  for (const file of ['ticket.md', 'verify.md']) {
    const pending = execute('bun', args, {
      cwd: project,
      env: {
        ...process.env,
        SAFEWORD_PLUGIN_CLI: pluginCli,
        SAFEWORD_CLI: undefined,
        SAFEWORD_AGENT_RUNTIME: cursor ? 'cursor' : 'opencode',
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
    const input = {
      cwd: project,
      session_id: 'propagation-given',
      tool_name: 'Write',
      tool_input: {
        file_path: nodePath.join(ticket, file),
        content: readFileSync(nodePath.join(ticket, file), 'utf8'),
      },
    };
    pending.child.stdin?.end(JSON.stringify(input));
    await pending;
  }
  assert.ok(
    existsSync(readiness),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: normal readiness producer did not close Given',
  );
  writeFileSync(nodePath.join(ticket, 'verify.md'), evidence);
  const directory = nodePath.join(project, '.host-contract');
  mkdirSync(directory, { recursive: true });
  const effect = nodePath.join(directory, 'native-readiness-effect');
  const marker = `READY_${randomUUID()}`;
  const executable = nodePath.join(directory, 'gh');
  writeFileSync(executable, `#!/bin/sh\nprintf %s '${marker}' > '${effect}'\n`, { mode: 0o755 });
  return { ticket, effect, marker, command: `'${executable}' pr create` };
}

export function assertArchitectureObservation(
  observation: { raw: string; decisions: { decision?: string; reason?: string }[] },
  enabled: boolean,
  diagnostic = 'CLAUDE_ARCHITECTURE_OPTION_OUTCOME_MISMATCH',
) {
  try {
    if (enabled)
      assert.ok(
        observation.decisions.some(
          row =>
            row.decision === 'block' &&
            typeof row.reason === 'string' &&
            row.reason.includes('cited evidence'),
        ),
        `${diagnostic}: expected missing cited evidence`,
      );
    else
      assert.ok(
        observation.decisions.every(row => !row.decision),
        `${diagnostic}: expected allowed completion`,
      );
  } catch (error) {
    throw new ObservedPropagationMismatch(observation, error);
  }
}
