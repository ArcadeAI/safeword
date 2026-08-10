import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

/**
 * A Codex reviewer that answers in its own natural vocabulary — `high`/`medium`
 * severities and `path`/`title`/`recommendation` fields — unless it is handed a
 * schema to conform to. This is the observed production behaviour: in 13 of 13
 * real fallback attempts Codex answered off-contract and was rejected, because
 * Safeword never told it what shape the answer had to take.
 *
 * It records the schema path it was given so the test can read back the exact
 * contract Safeword delivered.
 */
function installSchemaAwareCodex(directory: string): string {
  const bin = nodePath.join(
    tmpdir(),
    `safeword-codexcontract-${Buffer.from(directory).toString('hex')}`,
    'bin',
  );
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'
  exit 0
fi
schema=''
previous=''
for argument in "$@"; do
  if [ "$previous" = "--output-schema" ]; then schema="$argument"; fi
  previous="$argument"
done
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
emit_event() {
  # An agent_message carries the answer as an escaped JSON string, so build the
  # inner document first and escape it rather than hand-writing the nesting.
  escaped=$(printf '%s' "$1" | sed 's/"/\\"/g')
  printf '{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"%s"}}\n' "$escaped"
}
if [ -z "$schema" ]; then
  # Ungoverned: Codex's own vocabulary, which the strict parser refuses.
  emit_event "$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[{"severity":"high","path":"a.ts","title":"t","recommendation":"r"}]}' "$dispatch_id")"
  exit 0
fi
printf '%s\n' "$schema" > "$SAFEWORD_REVIEW_SCHEMA_PATH_LOG"
cp "$schema" "$SAFEWORD_REVIEW_SCHEMA_COPY"
emit_event "$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[{"severity":"warning","message":"noted"}]}' "$dispatch_id")"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function reviewEnvironment(bin: string, directory: string): Record<string, string> {
  return {
    PATH: `${bin}:/usr/bin:/bin`,
    SAFEWORD_AGENT_RUNTIME: 'claude',
    SAFEWORD_REVIEW_SCHEMA_PATH_LOG: nodePath.join(directory, 'schema-path.log'),
    SAFEWORD_REVIEW_SCHEMA_COPY: nodePath.join(directory, 'schema-copy.json'),
    SAFEWORD_NO_UPDATE_CHECK: '1',
  };
}

async function runReview(directory: string, bin: string) {
  return runCli(
    [
      'review',
      'run',
      'quality-review',
      'review-input.md',
      '--json',
      '--no-input',
      '--cwd',
      directory,
    ],
    { cwd: directory, env: reviewEnvironment(bin, directory) },
  );
}

describe('Codex typed-output contract', () => {
  it('hands Codex the result contract so its review is accepted', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installSchemaAwareCodex(directory);

    const result = await runReview(directory, bin);

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        assigned_reviewer: 'codex',
        independence: 'cross-agent',
        reviewer_output: { reviewer_agent: 'codex', findings: [{ severity: 'warning' }] },
      },
    });
  });

  it('delivers a contract that permits exactly what the check enforces', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installSchemaAwareCodex(directory);

    await runReview(directory, bin);

    const schema = JSON.parse(
      readFileSync(nodePath.join(directory, 'schema-copy.json'), 'utf8'),
    ) as {
      required: string[];
      additionalProperties: boolean;
      properties: {
        verdict: { enum: unknown[] };
        findings: {
          items: {
            properties: { severity: { enum: unknown[] } };
            additionalProperties: boolean;
          };
        };
      };
    };

    // The six fields the parser allows, and nothing else.
    expect([...schema.required].toSorted((left, right) => left.localeCompare(right))).toEqual([
      'dispatch_id',
      'findings',
      'reviewer_agent',
      'schema_version',
      'summary',
      'verdict',
    ]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.verdict.enum).toEqual(['approve', 'request_changes']);
    // The severities the parser accepts — not Codex's natural high/medium/low.
    expect(schema.properties.findings.items.properties.severity.enum).toEqual([
      'info',
      'warning',
      'error',
    ]);
    expect(schema.properties.findings.items.additionalProperties).toBe(false);
  });
});
