/**
 * Deprecation notice for commands that still accept the pre-envelope
 * `--format json` output. Shared by every such command, so the wording and
 * the retention promise stay identical wherever the legacy format survives.
 */

import type { CliResult } from './result.js';

export function withLegacyRawJsonGuidance(
  result: CliResult,
  options: Readonly<Record<string, unknown>>,
  command: string,
): CliResult {
  if (options.format !== 'json') return result;
  return {
    ...result,
    findings: [
      ...result.findings,
      {
        code: 'CLI_RAW_JSON_DEPRECATED',
        message: `The legacy raw JSON format for \`${command}\` remains available; use global \`--json\` for the canonical versioned envelope.`,
        severity: 'warning',
        metadata: { replacement: '--json', retention: 'indefinite' },
      },
    ],
  };
}
