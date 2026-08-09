import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const HOOK_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
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
    'inspiration_contract: v1',
    'inspiration_contract_scaffold: v1',
    `created: ${TODAY}T00:00:00.000Z`,
    '---',
    '# Inspiration gate',
  ].join('\n');
}

function spec(withEvidence: boolean): string {
  return [
    '# Spec',
    '<!-- safeword:inspiration-contract:v1 -->',
    '',
    ...(withEvidence
      ? [
          '## Product Inspiration',
          '',
          '| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          `| https://linear.app/docs/issue-templates | ${TODAY} | n/a | Faster issue filing | Default good practice | Do not copy UI | retained: supports direction |`,
          '',
        ]
      : []),
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

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'sw-inspiration-intake-'));
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
});
