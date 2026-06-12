/**
 * Integration: architecture review gate (ticket MR5M3A)
 *
 * Proves the stop hook, when `architectureReviewGate` is enabled, requires a
 * new-flow feature leaving implement (verify/done) to carry cited evidence in
 * its impl-plan Decisions AND a matching design-review stamp — and, when
 * `crossModelReview` is set, a stamp whose recorded model differs from the
 * author's. Default-off and task/grandfathered exemptions covered too.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  formatReviewStamp,
  hashArtifact,
  reviewScope,
} from '../../templates/hooks/lib/review-ledger.js';
import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  removeTemporaryDirectory,
  setupOrThrow,
  writeTestFile,
} from '../helpers.js';

let projectDirectory: string;

beforeAll(async () => {
  projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(projectDirectory);
  initGitRepo(projectDirectory);
  await setupOrThrow(projectDirectory);
});

afterAll(() => {
  if (projectDirectory) removeTemporaryDirectory(projectDirectory);
});

function plan(decisions: string, status = 'implemented'): string {
  return `# Impl Plan: test

**Status:** ${status}

## Approach

One slice.

## Decisions

${decisions}

## Arch alignment

skip: no ADRs in this project yet

## Known deviations

None planned.

## Assessment triggers

Revisit past 10x load.
`;
}

const CITED = plan('We chose a file store. See https://example.com/adr-1 for why.');
const UNCITED = plan('We chose a file store because it is simpler than a database.');

function setConfig(flags: Record<string, unknown>): void {
  writeTestFile(
    projectDirectory,
    '.safeword/config.json',
    JSON.stringify({ installedPacks: ['typescript'], ...flags }),
  );
}

function writeTicket(id: string, type: 'feature' | 'task', implPlan?: string, spec = true): void {
  const folder = `.safeword-project/tickets/${id}`;
  mkdirSync(nodePath.join(projectDirectory, folder), { recursive: true });
  writeTestFile(
    projectDirectory,
    `${folder}/ticket.md`,
    `---\nid: ${id}\ntype: ${type}\nphase: verify\nstatus: in_progress\nlast_modified: 2026-01-06T10:00:00Z\n---\n# Test\n`,
  );
  if (type === 'feature') {
    writeTestFile(
      projectDirectory,
      `${folder}/test-definitions.md`,
      '# Test Definitions\n\n## Rule: r\n\n### Scenario: s\n\n- [x] RED abc1234\n',
    );
  }
  if (spec) {
    writeTestFile(
      projectDirectory,
      `${folder}/spec.md`,
      '# Spec\n\n## Jobs To Be Done\n\nskip: fixture\n',
    );
  }
  if (implPlan !== undefined) writeTestFile(projectDirectory, `${folder}/impl-plan.md`, implPlan);
}

/** Append a design-review stamp for the impl-plan to the invocation log. */
function writeStamp(
  id: string,
  planContent: string,
  options: { model?: string; skip?: string; scopeId?: string; hashOf?: string } = {},
): void {
  const scope = reviewScope(
    options.scopeId ?? id,
    'impl-plan',
    hashArtifact(options.hashOf ?? planContent),
  );
  const line = `2026-06-12T00:00:00Z sess ${formatReviewStamp(scope, options.skip, options.model)}`;
  appendFileSync(
    nodePath.join(projectDirectory, '.safeword-project', 'skill-invocations.log'),
    `${line}\n`,
  );
}

function runStopHook(id: string, env: Record<string, string> = {}): string {
  const sessionId = `session-${id}`;
  const transcriptPath = nodePath.join(projectDirectory, `transcript-${id}.jsonl`);
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'done' },
          { type: 'tool_use', name: 'Edit' },
        ],
      },
    })}\n`,
  );
  writeFileSync(
    nodePath.join(projectDirectory, '.safeword-project', `quality-state-${sessionId}.json`),
    JSON.stringify({ activeTicket: id }),
  );
  const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
    input: JSON.stringify({ transcript_path: transcriptPath, session_id: sessionId }),
    cwd: projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory, ...env },
    encoding: 'utf8',
  });
  try {
    return (JSON.parse(result.stdout.trim()).reason as string) ?? '';
  } catch {
    return '';
  }
}

const CITATION_MSG = 'cited evidence';
const REVIEW_MSG = 'independent design review';
const CROSS_MODEL_MSG = 'different model';

describe('architecture review gate (MR5M3A)', () => {
  it('allows everything when the gate is disabled (default-off)', () => {
    setConfig({});
    writeTicket('ARG001', 'feature', UNCITED);
    const reason = runStopHook('ARG001');
    expect(reason).not.toContain(CITATION_MSG);
    expect(reason).not.toContain(REVIEW_MSG);
  });

  it('blocks an uncited Decisions section when enabled', () => {
    setConfig({ architectureReviewGate: true });
    writeTicket('ARG002', 'feature', UNCITED);
    writeStamp('ARG002', UNCITED);
    expect(runStopHook('ARG002')).toContain(CITATION_MSG);
  });

  it('blocks when cited but no design-review stamp exists', () => {
    setConfig({ architectureReviewGate: true });
    writeTicket('ARG003', 'feature', CITED);
    expect(runStopHook('ARG003')).toContain(REVIEW_MSG);
  });

  it('allows when cited and a matching stamp exists', () => {
    setConfig({ architectureReviewGate: true });
    writeTicket('ARG004', 'feature', CITED);
    writeStamp('ARG004', CITED);
    const reason = runStopHook('ARG004');
    expect(reason).not.toContain(CITATION_MSG);
    expect(reason).not.toContain(REVIEW_MSG);
  });

  it('blocks when the stamp is stale (plan edited after review)', () => {
    setConfig({ architectureReviewGate: true });
    writeTicket('ARG005', 'feature', CITED);
    writeStamp('ARG005', CITED, { hashOf: 'an older version of the plan' });
    expect(runStopHook('ARG005')).toContain(REVIEW_MSG);
  });

  it('blocks under cross-model when the stamp model equals the author model', () => {
    setConfig({ architectureReviewGate: true, crossModelReview: true });
    writeTicket('ARG006', 'feature', CITED);
    writeStamp('ARG006', CITED, { model: 'claude-opus-4-8' });
    expect(runStopHook('ARG006', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' })).toContain(
      CROSS_MODEL_MSG,
    );
  });

  it('allows under cross-model when the stamp model differs from the author model', () => {
    setConfig({ architectureReviewGate: true, crossModelReview: true });
    writeTicket('ARG007', 'feature', CITED);
    writeStamp('ARG007', CITED, { model: 'claude-sonnet-4-6' });
    const reason = runStopHook('ARG007', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' });
    expect(reason).not.toContain(CROSS_MODEL_MSG);
    expect(reason).not.toContain(REVIEW_MSG);
  });

  it('blocks under cross-model when the stamp records no model (fails closed)', () => {
    setConfig({ architectureReviewGate: true, crossModelReview: true });
    writeTicket('ARG008', 'feature', CITED);
    writeStamp('ARG008', CITED);
    expect(runStopHook('ARG008', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' })).toContain(
      CROSS_MODEL_MSG,
    );
  });

  it('exempts tasks from the gate', () => {
    setConfig({ architectureReviewGate: true });
    writeTicket('ARG009', 'task', undefined, false);
    const reason = runStopHook('ARG009');
    expect(reason).not.toContain(CITATION_MSG);
    expect(reason).not.toContain(REVIEW_MSG);
  });
});
