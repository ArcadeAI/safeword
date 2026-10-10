import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function outputText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function callClaude(
  model: string,
  prompt: string,
  schema: unknown,
  environment?: NodeJS.ProcessEnv,
): unknown {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-planning-eval-'));
  try {
    const result = spawnSync(
      'claude',
      [
        '-p',
        prompt,
        '--model',
        model,
        '--effort',
        'low',
        '--max-turns',
        '3',
        '--tools',
        '',
        '--setting-sources',
        '',
        '--no-session-persistence',
        '--output-format',
        'json',
        '--json-schema',
        JSON.stringify(schema),
      ],
      {
        cwd: directory,
        env: environment,
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    const stdout = outputText(result.stdout);
    const stderr = outputText(result.stderr).trim();
    if (result.error !== undefined || result.status !== 0)
      throw new Error(
        `Claude ${model} failed (status ${result.status}, signal ${result.signal}): ${result.error?.message ?? stderr} ${stdout.slice(-500)}`,
      );
    const envelope: unknown = JSON.parse(stdout);
    if (!isRecord(envelope) || envelope.is_error !== false || !isRecord(envelope.modelUsage))
      throw new Error(`Claude ${model} returned an invalid eval envelope.`);
    // Claude may report auxiliary model usage alongside the requested review model.
    if (!Object.hasOwn(envelope.modelUsage, model))
      throw new Error(`Claude eval used a model other than pinned ${model}.`);
    return envelope.structured_output;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
