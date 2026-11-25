import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect } from 'vitest';

import { cursorEditedMarkerPath } from '../../templates/hooks/lib/cursor-state.js';
import { QUALITY_REVIEW_MESSAGE } from '../../templates/hooks/lib/quality.js';
import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import { FILER_AGENT_NAME } from '../../templates/hooks/lib/retro-filing-gate.js';
import { hasNudged, sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
import { retroDraft } from '../helpers.js';

/** Actual installed commands; fixtures are ordinary domain state, never admitted proof. */
export function characterizeCursorStopOptions(
  project: string,
  command: string,
  env: NodeJS.ProcessEnv,
) {
  const temporary = nodePath.join(project, '.owned-runtime-tmp');
  mkdirSync(temporary);
  const config = (review = false, surface = false, file = false) => {
    writeFileSync(
      nodePath.join(project, '.safeword/config.json'),
      JSON.stringify({
        stopQualityReview: review,
        terminalHandoffCorrection: false,
        selfReport: { capture: false, surface, file },
      }),
    );
  };
  const transcript = nodePath.join(project, 'options-transcript.jsonl');
  writeFileSync(
    transcript,
    Array.from({ length: 8 }, (_, i) =>
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: `t${i}`, name: 'edit', input: {} }],
        },
      }),
    ).join('\n'),
  );
  const invoke = (id = 'cursor-feedback', extra: Record<string, unknown> = {}) => {
    const result = spawnSync('sh', ['-c', command], {
      cwd: project,
      env: {
        ...env,
        TMPDIR: temporary,
        SAFEWORD_PLUGIN_CLI: nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
      },
      encoding: 'utf8',
      timeout: 30_000,
      input: JSON.stringify({
        workspace_roots: [project],
        conversation_id: id,
        transcript_path: transcript,
        status: 'completed',
        loop_count: 0,
        ...extra,
      }),
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as { followup_message?: string };
  };
  config();
  const ticket = nodePath.join(project, '.project/tickets/ABC123-synthetic/ticket.md');
  writeFileSync(ticket, '---\nid: ABC123\ntype: task\nstatus: in_progress\nphase: done\n---\n');
  const packageFile = nodePath.join(project, 'package.json');
  writeFileSync(
    packageFile,
    JSON.stringify({
      name: 'owned-completion-fixture',
      scripts: { test: 'safeword-fixture-missing-command' },
    }),
  );
  expect(invoke('foreign-options-conversation')).toEqual({});
  for (const status of ['aborted', 'error'])
    expect(invoke('cursor-feedback', { status })).toEqual({});
  expect(invoke().followup_message).toContain('Test toolchain not found');
  expect(invoke('cursor-feedback', { loop_count: 1 }).followup_message).toContain(
    'Test toolchain not found',
  );
  writeFileSync(
    packageFile,
    JSON.stringify({
      name: 'owned-completion-fixture',
      scripts: { test: 'node --test synthetic.test.mjs' },
    }),
  );
  writeFileSync(
    nodePath.join(project, 'synthetic.test.mjs'),
    "import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,appendFileSync} from 'node:fs';test('owned completion',()=>{assert.equal(readFileSync('value.txt','utf8'),'green');appendFileSync('completion-observed.txt','passed\\n');});\n",
  );
  writeFileSync(nodePath.join(project, 'value.txt'), 'red');
  expect(invoke().followup_message).toContain('Tests failed');
  expect(existsSync(nodePath.join(project, 'completion-observed.txt'))).toBe(false);
  writeFileSync(nodePath.join(project, 'value.txt'), 'green');
  expect(invoke().followup_message).toContain('No valid verify.md');
  expect(readFileSync(nodePath.join(project, 'completion-observed.txt'), 'utf8')).toContain(
    'passed',
  );
  // Ordinary author-owned scope artifact after real fixture tests; no signed success receipt.
  writeFileSync(
    nodePath.join(nodePath.dirname(ticket), 'verify.md'),
    '**PR Scope:** ✅ Only this owned synthetic completion fixture.\n',
  );
  expect(invoke()).toEqual({});
  expect(readFileSync(ticket, 'utf8')).toContain('status: in_progress');
  const generated = nodePath.join(project, '.project/architecture.generated.md');
  const shape = (fingerprint: string) =>
    `---\ngenerator: safeword-architecture\nfingerprint: ${fingerprint}\n---\n`;
  writeFileSync(nodePath.join(project, 'ARCHITECTURE.md'), '# Owned synthetic architecture\n');
  // A new map relative to an absent baseline is a real documented drift case.
  // Keep generated-file ignore policy intact rather than forcing it into Git.
  rmSync(generated, { force: true });
  for (const args of [
    ['add', 'ARCHITECTURE.md'],
    [
      '-c',
      'user.name=Synthetic',
      '-c',
      'user.email=synthetic@localhost',
      'commit',
      '-m',
      'owned architecture baseline',
    ],
    ['branch', 'fixture-baseline'],
    ['checkout', '-b', 'fixture-current'],
    ['branch', '--set-upstream-to=fixture-baseline', 'fixture-current'],
  ]) {
    const result = spawnSync('git', args, { cwd: project, env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  }
  const ownMarker = cursorEditedMarkerPath({ conversation_id: 'cursor-feedback' });
  try {
    writeFileSync(generated, shape('after'));
    writeFileSync(ownMarker, '');
    expect(invoke().followup_message).toContain('ARCHITECTURE.md');
    rmSync(generated, { force: true });
    writeFileSync(ownMarker, '');
    expect(invoke()).toEqual({});
  } finally {
    rmSync(ownMarker, { force: true });
  }
  const id = `stop-options-${nodePath.basename(nodePath.dirname(project))}`;
  const marker = cursorEditedMarkerPath({ conversation_id: id });
  try {
    config(false, false);
    expect(invoke(id)).toEqual({});
    expect(hasNudged(id, temporary)).toBe(false);
    config(false, true);
    expect(invoke(id).followup_message).toContain(transcript);
    expect(hasNudged(id, temporary)).toBe(true);
    expect(invoke(id)).toEqual({});
    rmSync(sentinelPath(id, temporary), { force: true });
    config(true, true, true);
    spoolDrafts(project, id, [retroDraft('retro:aaaaaaaaaaaa')]);
    writeFileSync(marker, '');
    expect(invoke(id).followup_message).toBe(QUALITY_REVIEW_MESSAGE);
    expect(hasNudged(id, temporary)).toBe(false);
    config(false, true, true);
    writeFileSync(marker, '');
    expect(invoke(id).followup_message).toContain(FILER_AGENT_NAME);
    config(false, false, true);
    expect(invoke(id).followup_message).toContain(FILER_AGENT_NAME);
    expect(hasNudged(id, temporary)).toBe(false);
    config(false, false, false);
    expect(invoke(id)).toEqual({});
    for (const status of ['aborted', 'error']) expect(invoke(id, { status })).toEqual({});
  } finally {
    rmSync(marker, { force: true });
    rmSync(sentinelPath(id, temporary), { force: true });
  }
}
