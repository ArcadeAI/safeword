/**
 * `safeword project retro-drain` — drain acknowledged retro drafts, or emit the
 * spool as validated JSONL for tracker egress. Replaces the project-local
 * `.safeword/hooks/lib/drain-retro-spool.ts` invocation for hosts with no
 * installed hooks directory (Codex's self-contained plugin).
 *
 * The egress guards are not restated here: this delegates to the same exported
 * function the hook entrypoint uses, so the boundary cannot drift between the
 * two callers.
 */

import { statSync } from 'node:fs';

import { type CliResult, createResult } from '../cli-protocol/result.js';

/**
 * The drain reports no mutation of its own, so the spool is observed either
 * side of it: a drain that removed nothing must not claim a file effect.
 */
function spoolSize(path: string): number | undefined {
  try {
    return statSync(path).size;
  } catch {
    return undefined;
  }
}

export async function runRetroDrain(
  spoolPath: string | undefined,
  options: Readonly<Record<string, unknown>>,
): Promise<CliResult> {
  if (spoolPath === undefined || spoolPath.length === 0) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'RETRO_DRAIN_SPOOL_REQUIRED',
          message: 'project retro-drain requires a retro draft spool path.',
          retryable: false,
        },
      ],
    });
  }

  const { drainRetroSpool } = await import('../../templates/hooks/lib/drain-retro-spool.js');
  const before = spoolSize(spoolPath);
  const result = drainRetroSpool(
    spoolPath,
    options.validatedJsonl === true ? 'validated-jsonl' : 'drain',
  );

  if (result.state === 'refused' || result.state === 'egress_refused') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: result.state === 'refused' ? 'RETRO_DRAIN_REFUSED' : 'RETRO_DRAIN_EGRESS_REFUSED',
          message: result.message,
          retryable: false,
        },
      ],
    });
  }

  if (result.state === 'validated') {
    return createResult({
      state: 'healthy',
      // Raw stdout stays one JSON object per line: the filer streams it onward.
      presentation: {
        kind: 'raw',
        body: result.drafts.map(draft => JSON.stringify(draft)).join('\n'),
      },
      data: { command: 'project retro-drain', drafts: result.drafts },
    });
  }

  const drained = spoolSize(spoolPath) !== before;

  return createResult({
    state: drained ? 'changed' : 'healthy',
    changed: drained,
    ...(drained && { effects: { files: [{ kind: 'update', target: spoolPath }] } }),
    data: { command: 'project retro-drain', drained },
  });
}
