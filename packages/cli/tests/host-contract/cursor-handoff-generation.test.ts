import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';

import { cursorEditedMarkerPath } from '../../templates/hooks/lib/cursor-state.js';
import { QUALITY_REVIEW_MESSAGE } from '../../templates/hooks/lib/quality.js';
import { createTypeScriptPackageJson, setupOrThrow } from '../helpers.js';

const fixture = { project: '', plugin: '' };
const markers = new Set<string>();
type Mode = 'project' | 'native';
beforeAll(async () => {
  fixture.project = mkdtempSync('/tmp/safeword-handoff-generation-');
  createTypeScriptPackageJson(fixture.project);
  await setupOrThrow(fixture.project);
  fixture.plugin = nodePath.join(fixture.project, 'cursor-extension');
  const generated = spawnSync(
    'bun',
    [
      nodePath.resolve(import.meta.dirname, '../../scripts/generate-cursor-plugin.ts'),
      '--output',
      fixture.plugin,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(generated.status, 0, generated.stderr);
});
afterEach(() => {
  for (const marker of markers) rmSync(marker, { force: true });
  markers.clear();
});
afterAll(() => {
  if (fixture.project) rmSync(fixture.project, { recursive: true, force: true });
});

function given(enabled = true, review = false) {
  const id = `generation-${randomUUID()}`;
  const transcript = nodePath.join(fixture.project, `${id}.jsonl`);
  writeFileSync(transcript, `${JSON.stringify({ role: 'assistant', content: 'READY' })}\n`);
  writeFileSync(
    nodePath.join(fixture.project, '.safeword/config.json'),
    JSON.stringify({
      terminalHandoffCorrection: enabled,
      stopQualityReview: review,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  const marker = cursorEditedMarkerPath({ conversation_id: id });
  markers.add(marker);
  return { id, transcript, marker };
}
function invoke(mode: Mode, event: 'stop' | 'afterFileEdit', payload: Record<string, unknown>) {
  const root = mode === 'native' ? fixture.plugin : fixture.project;
  const manifest = JSON.parse(
    readFileSync(
      nodePath.join(root, mode === 'native' ? 'hooks/hooks.json' : '.cursor/hooks.json'),
      'utf8',
    ),
  );
  expect(manifest.hooks[event]).toHaveLength(1);
  expect(manifest.hooks.stop[0].loop_limit).toBe(1);
  const excluded = new Set([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'CLAUDE_PROJECT_DIR',
    'SAFEWORD_CLI',
    'SAFEWORD_PLUGIN_CLI',
  ]);
  const environment = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !excluded.has(key))),
    CURSOR_PLUGIN_ROOT: fixture.plugin,
  };
  const result = spawnSync('sh', ['-c', manifest.hooks[event][0].command], {
    cwd: fixture.project,
    env: environment,
    encoding: 'utf8',
    input: JSON.stringify({ workspace_roots: [fixture.project], ...payload }),
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}
function edit(mode: Mode, id: string, generation: unknown) {
  const file = nodePath.join(fixture.project, 'owned-edit.txt');
  // Only the external edit boundary is substituted; the installed hook writes its own marker.
  writeFileSync(file, 'source transport edit\n');
  invoke(mode, 'afterFileEdit', {
    conversation_id: id,
    generation_id: generation,
    file_path: file,
  });
}
function stop(
  mode: Mode,
  c: ReturnType<typeof given>,
  generation: unknown,
  extra: Record<string, unknown> = {},
) {
  return invoke(mode, 'stop', {
    conversation_id: c.id,
    generation_id: generation,
    transcript_path: c.transcript,
    status: 'completed',
    loop_count: 0,
    ...extra,
  });
}
for (const mode of ['project', 'native'] as const) {
  it(`${mode}: a later generation cannot reuse an earlier edit`, () => {
    const c = given();
    expect(stop(mode, c, 'before')).toEqual({});
    edit(mode, c.id, 'current');
    expect(stop(mode, c, 'current').followup_message).toContain('terminal-handoff/v1 correction');
    expect(existsSync(c.marker)).toBe(true);
    // The actual host skips managed Stop1 at cap1; no fake cleanup or second decision.
    expect(stop(mode, c, 'later'), 'CURSOR_HANDOFF_STALE_GENERATION_REQUIRED').toEqual({});
  });
  it(`${mode}: OFF/ON/OFF retains current-edit correction only while enabled`, () => {
    const c = given(false);
    for (const [i, enabled] of [false, true, false].entries()) {
      const config = nodePath.join(fixture.project, '.safeword/config.json');
      writeFileSync(
        config,
        JSON.stringify({
          terminalHandoffCorrection: enabled,
          selfReport: { capture: false, surface: false, file: false },
        }),
      );
      edit(mode, c.id, `turn-${i}`);
      const output = stop(mode, c, `turn-${i}`);
      if (enabled) expect(output.followup_message).toContain('terminal-handoff/v1 correction');
      else expect(output).toEqual({});
    }
  });
  const cases: [string, unknown, unknown, string?][] = [
    ['missing edit generation', undefined, 'current'],
    ['both identities missing', undefined, undefined],
    ['both identities blank', ' ', ' '],
    ['both identities nonstring', 42, 42],
    ['legacy raw matching identity', 'current', 'current', 'current'],
    ['blank matching metadata', 'current', ' ', '{"generation_id":" "}'],
    ['nonstring matching metadata', 'current', 42, '{"generation_id":42}'],
    ['blank edit generation', ' '.repeat(3), 'current'],
    ['nonstring edit generation', 42, 'current'],
    ['missing Stop generation', 'current', undefined],
    ['blank Stop generation', 'current', ' '],
    ['nonstring Stop generation', 'current', 42],
    ['raw identity whitespace', 'current', ' current '],
    ['legacy marker', 'current', 'current', ''],
    ['malformed marker', 'current', 'current', '{'],
    ['missing metadata identity', 'current', 'current', '{}'],
    ['nonstring metadata', 'current', 'current', '{"generation_id":42}'],
  ];
  it.each(cases)(
    `${mode}: refuses %s as current-turn evidence`,
    (_name, writeGeneration, readGeneration, contents) => {
      const c = given();
      edit(mode, c.id, writeGeneration);
      if (contents !== undefined) writeFileSync(c.marker, contents); // Deliberate corrupt/legacy state, supporting fault control only.
      expect(stop(mode, c, readGeneration)).toEqual({});
    },
  );
  it(`${mode}: preserves exact nonblank identity without trimming`, () => {
    const c = given();
    edit(mode, c.id, ' current ');
    expect(stop(mode, c, ' current ').followup_message).toContain('terminal-handoff/v1 correction');
  });
  it(`${mode}: a foreign conversation cannot borrow an edit`, () => {
    const c = given();
    edit(mode, c.id, 'current');
    expect(stop(mode, { ...c, id: `foreign-${c.id}` }, 'current')).toEqual({});
  });
  it(`${mode}: structured reply eligibility stays independent of edits`, () => {
    const c = given();
    writeFileSync(
      c.transcript,
      `${JSON.stringify({ role: 'assistant', content: '**CONFIDENT** — The source change is complete.\n\n**Next:** READY' })}\n`,
    );
    expect(stop(mode, c, undefined).followup_message).toContain('terminal-handoff/v1 correction');
  });
  it(`${mode}: unknown edit identity still feeds presence-only quality review`, () => {
    const c = given(false, true);
    edit(mode, c.id, undefined);
    expect(existsSync(c.marker)).toBe(true);
    expect(stop(mode, c, undefined).followup_message).toBe(QUALITY_REVIEW_MESSAGE);
    expect(existsSync(c.marker)).toBe(false);
  });
  it(`${mode}: loop1 never spends another handoff correction`, () => {
    const c = given();
    edit(mode, c.id, 'current');
    expect(stop(mode, c, 'current', { loop_count: 1 })).toEqual({});
  });
}
