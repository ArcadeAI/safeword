import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluateFeatureTicketReadiness } from '../../templates/hooks/lib/active-ticket.js';
import {
  INSPIRATION_SPEC_MARKER,
  inspirationActivationLines,
  validProductInspirationLines,
} from '../fixtures/inspiration.js';
import { expectHookAllow, expectHookDeny, type HookResult, writeGateConfig } from '../helpers';

const HOOK_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
const CODEX_HOOK_PATH = nodePath.resolve(
  __dirname,
  '../../templates/hooks/codex/pre-tool-quality.ts',
);
const TODAY = new Date().toISOString().slice(0, 10);

function ticket(phase: string): string {
  return [
    '---',
    'id: INS001',
    'type: feature',
    `phase: ${phase}`,
    'status: in_progress',
    'scope: inspiration gate',
    'out_of_scope: unrelated work',
    'done_when: evidence is captured',
    ...inspirationActivationLines(TODAY),
    '---',
    '# Inspiration gate',
  ].join('\n');
}

function spec(withEvidence: boolean): string {
  return [
    '# Spec',
    INSPIRATION_SPEC_MARKER,
    '',
    ...(withEvidence ? validProductInspirationLines(TODAY) : []),
    '## Jobs To Be Done',
    '',
    'skip: fixture focuses on transition wiring',
  ].join('\n');
}

describe('activated intake inspiration transition wiring', () => {
  let projectRoot: string;
  let ticketDirectory: string;
  let ticketFile: string;

  function advance(): HookResult {
    const result = spawnSync('bun', [HOOK_PATH], {
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketFile,
          old_string: 'phase: intake',
          new_string: 'phase: define-behavior',
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function advanceThroughCodex(): HookResult {
    const result = spawnSync('bun', [CODEX_HOOK_PATH], {
      cwd: projectRoot,
      input: JSON.stringify({
        session_id: 'inspiration-codex',
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketFile,
          old_string: 'phase: intake',
          new_string: 'phase: define-behavior',
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function writeTransitionThroughCodex(content: string): HookResult {
    return writeThroughCodex(ticketFile, content, 'inspiration-codex-write');
  }

  function writeThroughCodex(filePath: string, content: string, sessionId: string): HookResult {
    const result = spawnSync('bun', [CODEX_HOOK_PATH], {
      cwd: projectRoot,
      input: JSON.stringify({
        session_id: sessionId,
        tool_name: 'Write',
        tool_input: { file_path: filePath, content },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function bashThroughHook(command: string): HookResult {
    const result = spawnSync('bun', [HOOK_PATH], {
      cwd: projectRoot,
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'sw-inspiration-intake-'));
    writeGateConfig(projectRoot, { reviewGate: false });
    ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', 'INS001-gate');
    mkdirSync(ticketDirectory, { recursive: true });
    ticketFile = nodePath.join(ticketDirectory, 'ticket.md');
    writeFileSync(ticketFile, ticket('intake'));
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one dimension');
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('denies without Product Inspiration and leaves the artifact untouched', () => {
    const originalSpec = spec(false);
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), originalSpec);

    expectHookDeny(advance(), 'Product Inspiration');
    expect(readFileSync(nodePath.join(ticketDirectory, 'spec.md'), 'utf8')).toBe(originalSpec);
  });

  it('allows current Product Inspiration through the real pre-tool hook', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(true));

    expectHookAllow(advance());
  });

  it('allows current Product Inspiration through CRLF ticket and spec artifacts', () => {
    writeFileSync(ticketFile, ticket('intake').replaceAll('\n', '\r\n'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(true).replaceAll('\n', '\r\n'));

    expectHookAllow(advance());
  });

  it('denies missing Product Inspiration through CRLF ticket and spec artifacts', () => {
    writeFileSync(ticketFile, ticket('intake').replaceAll('\n', '\r\n'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(false).replaceAll('\n', '\r\n'));

    expectHookDeny(advance(), 'Product Inspiration');
  });

  it('keeps a legacy artifact signal-free when marker text appears only in fenced code', () => {
    writeFileSync(
      ticketFile,
      ticket('intake')
        .replace('inspiration_contract: v1\n', '')
        .replace('inspiration_contract_scaffold: v1\n', ''),
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n\n```md\n<!-- safeword:inspiration-contract:v1 -->\n```\n\n## Jobs To Be Done\n\nskip: legacy fixture\n',
    );

    expectHookAllow(advance());
  });

  it('carries inspiration denial and acceptance through the Codex adapter', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(false));
    expectHookDeny(advanceThroughCodex(), 'Product Inspiration');

    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(true));
    expectHookAllow(advanceThroughCodex());
  });

  it('denies Codex full-write removal of uncommitted activation signals during transition', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(false));
    const proposed = ticket('define-behavior')
      .replace('inspiration_contract: v1\n', '')
      .replace('inspiration_contract_scaffold: v1\n', '');

    expectHookDeny(writeTransitionThroughCodex(proposed), 'all three');
  });

  it('retains uncommitted activation across a removal edit and a later transition', () => {
    const specFile = nodePath.join(ticketDirectory, 'spec.md');
    writeFileSync(specFile, spec(false));
    const ticketWithoutSignals = ticket('intake')
      .replace('inspiration_contract: v1\n', '')
      .replace('inspiration_contract_scaffold: v1\n', '');

    expectHookAllow(
      writeThroughCodex(ticketFile, ticketWithoutSignals, 'inspiration-remove-ticket-signals'),
    );
    writeFileSync(ticketFile, ticketWithoutSignals);

    const specWithoutSignal = spec(false).replace(
      '<!-- safeword:inspiration-contract:v1 -->\n',
      '',
    );
    expectHookDeny(
      writeThroughCodex(specFile, specWithoutSignal, 'inspiration-remove-last-signal'),
      'last inspiration-contract activation signal',
    );
    expectHookDeny(advanceThroughCodex(), 'all three');
  });

  it('denies Bash removal of uncommitted activation signals through the real hook route', () => {
    const specFile = nodePath.join(ticketDirectory, 'spec.md');
    writeFileSync(specFile, spec(false));

    expectHookDeny(
      bashThroughHook(`sed -i 's/inspiration_contract[^[:space:]]*//' ${ticketFile} ${specFile}`),
      'inspiration activation artifacts',
    );
  });

  it('denies silent signal removal after an activated scaffold was committed', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(true));
    expect(spawnSync('git', ['init'], { cwd: projectRoot }).status).toBe(0);
    expect(spawnSync('git', ['add', '.'], { cwd: projectRoot }).status).toBe(0);
    expect(
      spawnSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'],
        { cwd: projectRoot },
      ).status,
    ).toBe(0);

    writeFileSync(
      ticketFile,
      ticket('intake')
        .replace('inspiration_contract: v1\n', '')
        .replace('inspiration_contract_scaffold: v1\n', ''),
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n\n## Jobs To Be Done\n\nskip: provenance fixture\n',
    );

    expectHookDeny(advance(), 'previously activated');
  });

  it.each([
    {
      name: 'ticket marker',
      committedTicket: ticket('intake').replace('inspiration_contract_scaffold: v1\n', ''),
      committedSpec: '# Spec\n\n## Jobs To Be Done\n\nskip: marker-only history\n',
      removedTicket: ticket('intake')
        .replace('inspiration_contract: v1\n', '')
        .replace('inspiration_contract_scaffold: v1\n', ''),
      removedSpec: '# Spec\n\n## Jobs To Be Done\n\nskip: removed marker history\n',
    },
    {
      name: 'spec marker',
      committedTicket: ticket('intake')
        .replace('inspiration_contract: v1\n', '')
        .replace('inspiration_contract_scaffold: v1\n', ''),
      committedSpec:
        '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n\n## Jobs To Be Done\n\nskip: spec-only history\n',
      removedTicket: ticket('intake')
        .replace('inspiration_contract: v1\n', '')
        .replace('inspiration_contract_scaffold: v1\n', ''),
      removedSpec: '# Spec\n\n## Jobs To Be Done\n\nskip: removed spec history\n',
    },
  ])('remembers committed partial activation from the $name', fixture => {
    writeFileSync(ticketFile, fixture.committedTicket);
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), fixture.committedSpec);
    expect(spawnSync('git', ['init'], { cwd: projectRoot }).status).toBe(0);
    expect(spawnSync('git', ['add', '.'], { cwd: projectRoot }).status).toBe(0);
    expect(
      spawnSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'],
        { cwd: projectRoot },
      ).status,
    ).toBe(0);

    writeFileSync(ticketFile, fixture.removedTicket);
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), fixture.removedSpec);

    expectHookDeny(advance(), 'previously activated');
  });

  it('preserves committed activation provenance when the ticket folder is renamed', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec(true));
    expect(spawnSync('git', ['init'], { cwd: projectRoot }).status).toBe(0);
    expect(spawnSync('git', ['add', '.'], { cwd: projectRoot }).status).toBe(0);
    const commit = (message: string) =>
      spawnSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', message],
        { cwd: projectRoot },
      );
    expect(commit('activated fixture').status).toBe(0);

    const renamedDirectory = nodePath.join(projectRoot, '.project', 'tickets', 'INS001-renamed');
    renameSync(ticketDirectory, renamedDirectory);
    ticketDirectory = renamedDirectory;
    ticketFile = nodePath.join(ticketDirectory, 'ticket.md');
    expect(spawnSync('git', ['add', '-A'], { cwd: projectRoot }).status).toBe(0);
    expect(commit('rename fixture').status).toBe(0);

    writeFileSync(
      ticketFile,
      ticket('intake')
        .replace('inspiration_contract: v1\n', '')
        .replace('inspiration_contract_scaffold: v1\n', ''),
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n\n## Jobs To Be Done\n\nskip: renamed provenance fixture\n',
    );

    expectHookDeny(advance(), 'previously activated');
  });

  it('fails closed when repository history exists but cannot be inspected', () => {
    writeFileSync(
      ticketFile,
      ticket('intake')
        .replace('inspiration_contract: v1\n', '')
        .replace('inspiration_contract_scaffold: v1\n', ''),
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n\n## Jobs To Be Done\n\nskip: unavailable provenance fixture\n',
    );
    const originalPath = process.env.PATH;
    process.env.PATH = '';
    let readiness: ReturnType<typeof evaluateFeatureTicketReadiness>;
    try {
      readiness = evaluateFeatureTicketReadiness(projectRoot, 'INS001-gate', {
        evaluationDate: TODAY,
      });
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
    expect(readiness.ok).toBe(false);
    expect(readiness.issues.some(issue => issue.reason.includes('could not be verified'))).toBe(
      true,
    );
  });
});
