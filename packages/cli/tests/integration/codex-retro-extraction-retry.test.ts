import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { draftSpoolPath } from '../../templates/hooks/lib/retro-draft-spool.js';
import { offsetStatePath } from '../../templates/hooks/lib/retro-trigger.js';
import { readSessionReports } from '../../templates/hooks/lib/self-report.js';
import {
  createTemporaryDirectory,
  readJsonlFile,
  removeTemporaryDirectory,
  sourceHookEnvironment,
  TIMEOUT_QUICK,
  writeSelfReportConfig,
  writeTestFile,
} from '../helpers';

const ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(ROOT, 'packages/cli/templates/hooks/codex/stop.ts');

function installFakeCodex(directory: string, initialMode: string) {
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin);
  const modePath = nodePath.join(directory, 'mode.txt');
  writeFileSync(modePath, initialMode);
  const callsPath = nodePath.join(directory, 'codex-calls.jsonl');
  writeFileSync(
    nodePath.join(bin, 'codex'),
    String.raw`#!/usr/bin/env bun
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const mode = readFileSync(${JSON.stringify(modePath)}, 'utf8');
appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify({ mode, argv, stdin: readFileSync(0, 'utf8') }) + '\n');
if (mode === 'nonzero') process.exit(7);
if (mode === 'missing') process.exit(0);
const findings = mode === 'invalid-schema' ? 'invalid' : mode === 'invalid-item' ? [{}] : [];
const output = mode === 'empty' ? '' : mode === 'malformed' ? '{ broken' : JSON.stringify({ findings });
writeFileSync(argv[argv.indexOf('-o') + 1], output);
`,
    { mode: 0o755 },
  );
  return { bin, modePath, callsPath };
}

describe('Codex Stop retries through the real extraction CLI', () => {
  let directory: string;
  let session: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
    session = `retro-retry-${nodePath.basename(directory)}`;
    writeTestFile(directory, '.safeword/SAFEWORD.md', '# enrolled\n');
    writeSelfReportConfig(directory, { surface: true, file: false });
    mkdirSync(nodePath.join(directory, 'gh-config'));
  });

  afterEach(() => {
    rmSync(offsetStatePath(session), { force: true });
    removeTemporaryDirectory(directory);
  });

  it.each([
    { mode: 'nonzero', reason: 'spawn_nonzero' },
    { mode: 'missing', reason: 'missing_output' },
    { mode: 'empty', reason: 'invalid_output' },
    { mode: 'malformed', reason: 'invalid_output' },
    { mode: 'invalid-schema', reason: 'invalid_output' },
    { mode: 'invalid-item', reason: 'invalid_output' },
  ])(
    'preserves the transcript after $mode output and commits one empty retry',
    ({ mode, reason }) => {
      const cli = nodePath.join(directory, 'packages/cli/src/cli.ts');
      mkdirSync(nodePath.dirname(cli), { recursive: true });
      symlinkSync(nodePath.join(ROOT, 'packages/cli/src/cli.ts'), cli);

      const { bin, modePath, callsPath } = installFakeCodex(directory, mode);
      const transcript = [
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: 'Synthetic transcript for extraction retry proof.' },
            ],
          },
        }),
        ...Array.from({ length: 8 }, (_, index) =>
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'function_call',
              call_id: `synthetic_${index}`,
              name: 'synthetic_tool',
            },
          }),
        ),
      ].join('\n');
      const transcriptPath = nodePath.join(directory, 'rollout.jsonl');
      writeFileSync(transcriptPath, transcript);
      const statePath = offsetStatePath(session);
      const spoolPath = draftSpoolPath(directory, session);
      const spoolContents = () => (existsSync(spoolPath) ? readFileSync(spoolPath, 'utf8') : '');
      const debugPath = nodePath.join(directory, 'debug.jsonl');
      const stop = () =>
        spawnSync('bun', [HOOK], {
          cwd: directory,
          input: JSON.stringify({
            session_id: session,
            transcript_path: transcriptPath,
            cwd: directory,
          }),
          env: sourceHookEnvironment(directory, {
            PATH: `${bin}${nodePath.delimiter}${process.env.PATH}`,
            GH_CONFIG_DIR: nodePath.join(directory, 'gh-config'),
            GITHUB_TOKEN: undefined,
            GH_TOKEN: undefined,
            GITHUB_ENTERPRISE_TOKEN: undefined,
            GH_ENTERPRISE_TOKEN: undefined,
            SAFEWORD_RETRO_CHILD: undefined,
            SAFEWORD_RETRO_DEBUG_LOG: debugPath,
          }),
          encoding: 'utf8',
          timeout: TIMEOUT_QUICK,
        });

      const failed = stop();
      expect(failed.error).toBeUndefined();
      expect(failed.status).toBe(0);
      expect(JSON.parse(failed.stdout)).toEqual({});
      expect(failed.stderr).toBe('');
      const failedCalls = readJsonlFile(callsPath);
      expect(failedCalls).toEqual([expect.objectContaining({ mode, stdin: '' })]);
      const argv = failedCalls[0]?.argv as string[];
      expect(argv).toEqual(expect.any(Array));
      const modelIndex = argv.indexOf('-m');
      expect(argv.slice(modelIndex, modelIndex + 2)).toEqual(['-m', 'gpt-6-luna']);
      const reasoningIndex = argv.indexOf('model_reasoning_effort="low"');
      expect(argv.slice(reasoningIndex - 1, reasoningIndex + 1)).toEqual([
        '-c',
        'model_reasoning_effort="low"',
      ]);
      const failedEvents = readJsonlFile(debugPath);
      expect(failedEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'retro_cli_extraction',
            ok: false,
            failureReason: reason,
          }),
          expect.objectContaining({ event: 'codex_stop_child_exit', status: 1, ok: false }),
        ]),
      );
      expect(failedEvents).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'retro_cli_extraction', ok: true }),
        ]),
      );
      expect(existsSync(statePath)).toBe(false);
      expect(spoolContents()).toBe('');
      expect(readSessionReports(directory, session)).toEqual([]);

      writeFileSync(modePath, 'success');
      const retry = stop();
      expect(retry.error).toBeUndefined();
      expect(retry.status).toBe(0);
      expect(JSON.parse(retry.stdout)).toEqual({});
      expect(retry.stderr).toBe('');
      const offset = { offset: transcript.length, toolUses: 8, fires: 1 };
      expect(JSON.parse(readFileSync(statePath, 'utf8'))).toEqual(offset);
      const eventsAfterRetry = readJsonlFile(debugPath);
      const retryEvents = eventsAfterRetry.slice(failedEvents.length);
      expect(retryEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'retro_cli_extraction', ok: true, findingsCount: 0 }),
          expect.objectContaining({ event: 'codex_stop_child_exit', status: 0, ok: true }),
        ]),
      );
      expect(retryEvents).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'retro_cli_extraction', ok: false }),
        ]),
      );
      expect(spoolContents()).toBe('');
      expect(readSessionReports(directory, session)).toEqual([]);

      const unchanged = stop();
      expect(unchanged.error).toBeUndefined();
      expect(unchanged.status).toBe(0);
      expect(JSON.parse(unchanged.stdout)).toEqual({});
      expect(unchanged.stderr).toBe('');
      expect(JSON.parse(readFileSync(statePath, 'utf8'))).toEqual(offset);
      const unchangedEvents = readJsonlFile(debugPath).slice(eventsAfterRetry.length);
      expect(unchangedEvents).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ event: 'retro_cli_extraction' })]),
      );
      expect(readJsonlFile(callsPath)).toEqual([
        expect.objectContaining({ mode, stdin: '' }),
        expect.objectContaining({ mode: 'success', stdin: '' }),
      ]);
    },
  );
});
