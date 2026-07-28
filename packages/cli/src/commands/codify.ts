/**
 * `safeword codify <ticket>` — emit derived test artifacts from a ticket's
 * `.feature` source when present, or legacy test-definitions.md otherwise.
 * Resolves the ticket folder, parses scenarios, and renders the skeleton to
 * stdout (default) or a file (`--out`, which refuses to overwrite). The
 * transforms live in pure utils; this command owns only I/O and errors.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { readBddConventionsPath, resolveTicketsDirectory } from '../utils/configured-paths.js';
import { findFeatureSourcePath } from '../utils/feature-source.js';
import { FeatureParseError, parseFeatureScenarios } from '../utils/gherkin-feature.js';
import { error, success } from '../utils/output.js';
import {
  emitGherkinFeature,
  emitVitestSkeleton,
  emitVitestSkeletonFromScenarios,
  type ParsedScenario,
  parseScenarios,
} from '../utils/test-skeleton.js';

export interface CodifyOptions {
  /** Output format: `vitest` (default) or `gherkin`. */
  format?: string;
  /** Emit throwing `it(...)` bodies (a true-RED board) instead of pending stubs (vitest only). */
  red?: boolean;
  /** Write to this path (refusing to overwrite) instead of stdout. */
  out?: string;
}

export function codify(ticket: string, options: CodifyOptions): Promise<void> {
  try {
    codifySync(ticket, options);
  } catch (codifyError) {
    fail(codifyError instanceof Error ? codifyError.message : String(codifyError));
  }
  return Promise.resolve();
}

function codifySync(ticket: string, options: CodifyOptions): void {
  const cwd = process.cwd();
  const format = resolveFormat(options.format);

  const ticketDirectory = resolveTicketDirectory(cwd, ticket);
  if (ticketDirectory === undefined) {
    fail(`No ticket folder for "${ticket}" under the tickets directory.`);
  }

  const source = readCodifySource(cwd, ticketDirectory);
  const scenarios = parseCodifyScenarios(source);
  if (scenarios.length === 0) {
    fail(`No scenarios found in ${source.displayPath}.`);
  }

  const skeleton = renderSkeleton(format, source, scenarios, ticket, options.red);
  if (options.out === undefined) {
    process.stdout.write(skeleton);
  } else {
    writeSkeleton(nodePath.resolve(cwd, options.out), options.out, skeleton, scenarios.length);
  }
  printConventionsPointer(cwd);
}

export function codifyResult(
  cwd: string,
  ticket: string,
  options: CodifyOptions,
): Promise<CliResult> {
  try {
    const format = resolveFormat(options.format);
    const ticketDirectory = resolveTicketDirectory(cwd, ticket);
    if (ticketDirectory === undefined) {
      throw new Error(`No ticket folder for "${ticket}" under the tickets directory.`);
    }
    const source = readCodifySource(cwd, ticketDirectory);
    const scenarios = parseCodifyScenarios(source);
    if (scenarios.length === 0) {
      throw new Error(`No scenarios found in ${source.displayPath}.`);
    }
    const skeleton = renderSkeleton(format, source, scenarios, ticket, options.red);
    if (options.out === undefined) {
      const conventions = readBddConventionsPath(cwd);
      return Promise.resolve(
        createResult({
          state: 'healthy',
          presentation: { kind: 'raw', body: skeleton },
          findings:
            conventions === undefined
              ? []
              : [
                  {
                    code: 'HOST_BDD_CONVENTIONS',
                    message: `Host conventions: ${conventions} — follow it for stub shape, verification, and tags.`,
                    severity: 'info',
                  },
                ],
          data: {
            command: 'project codify',
            format,
            scenarios: scenarios.length,
            output: skeleton,
          },
        }),
      );
    }
    const outputPath = nodePath.resolve(cwd, options.out);
    writeFileSync(outputPath, skeleton, { flag: 'wx' });
    return Promise.resolve(
      createResult({
        state: 'changed',
        effects: {
          files: [{ kind: 'create', target: nodePath.relative(cwd, outputPath) }],
        },
        data: {
          command: 'project codify',
          format,
          scenarios: scenarios.length,
        },
      }),
    );
  } catch (codifyError) {
    const errorCode =
      codifyError instanceof Error && (codifyError as NodeJS.ErrnoException).code === 'EEXIST'
        ? 'CODIFY_OUTPUT_EXISTS'
        : 'CODIFY_FAILED';
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: errorCode,
            message: codifyError instanceof Error ? codifyError.message : String(codifyError),
            retryable: false,
          },
        ],
      }),
    );
  }
}

/**
 * Surface the host's conventions doc (`bdd.conventions`, ticket 7CK2KP) when
 * configured. Goes to stderr so `codify > file.test.ts` output stays clean.
 */
function printConventionsPointer(cwd: string): void {
  const conventions = readBddConventionsPath(cwd);
  if (conventions === undefined) return;
  process.stderr.write(
    `Host conventions: ${conventions} — follow it for stub shape, verification, and tags.\n`,
  );
}

function parseCodifyScenarios(source: CodifySource): ParsedScenario[] {
  try {
    const parse = source.kind === 'feature' ? parseFeatureScenarios : parseScenarios;
    return parse(source.content);
  } catch (parseError: unknown) {
    if (parseError instanceof FeatureParseError) {
      fail(`${source.displayPath}: invalid Gherkin feature: ${parseError.message}`);
    }
    throw parseError;
  }
}

function renderSkeleton(
  format: 'gherkin' | 'vitest',
  source: CodifySource,
  scenarios: readonly ParsedScenario[],
  ticket: string,
  red: boolean | undefined,
): string {
  if (format === 'gherkin') {
    if (source.kind === 'feature') return source.content;
    return emitGherkinFeature(source.content, { source: ticket });
  }

  if (source.kind === 'feature') {
    return emitVitestSkeletonFromScenarios(scenarios, { red, source: ticket });
  }
  return emitVitestSkeleton(source.content, { red, source: ticket });
}

type CodifySource =
  | { kind: 'feature'; content: string; displayPath: string }
  | { kind: 'markdown'; content: string; displayPath: string };

function readCodifySource(cwd: string, ticketDirectory: string): CodifySource {
  const featurePath = findFeatureSourcePath(cwd, nodePath.basename(ticketDirectory));
  if (featurePath !== undefined) {
    return {
      kind: 'feature',
      content: readFileSync(featurePath, 'utf8'),
      displayPath: nodePath.relative(cwd, featurePath),
    };
  }

  const testDefinitionsPath = nodePath.join(ticketDirectory, 'test-definitions.md');
  if (!existsSync(testDefinitionsPath)) {
    fail(
      `No feature source or test-definitions.md in ${nodePath.relative(cwd, ticketDirectory)} — nothing to codify.`,
    );
  }
  return {
    kind: 'markdown',
    content: readFileSync(testDefinitionsPath, 'utf8'),
    displayPath: nodePath.relative(cwd, testDefinitionsPath),
  };
}

/** Validate `--format`, defaulting to vitest; fail on an unknown value. */
function resolveFormat(format = 'vitest'): 'gherkin' | 'vitest' {
  if (format !== 'gherkin' && format !== 'vitest') {
    fail(`Invalid --format=${format}. Must be one of: vitest, gherkin.`);
  }
  return format;
}

/** Write the skeleton to a fresh path; refuse to clobber, report write failures with context. */
function writeSkeleton(
  outPath: string,
  displayPath: string,
  skeleton: string,
  count: number,
): void {
  try {
    // `wx` = write but fail atomically if the path exists — no check-then-write TOCTOU gap.
    writeFileSync(outPath, skeleton, { flag: 'wx' });
  } catch (writeError: unknown) {
    const code =
      writeError instanceof Error ? (writeError as NodeJS.ErrnoException).code : undefined;
    if (code === 'EEXIST') {
      fail(`Refusing to overwrite ${displayPath} — delete it first or choose another path.`);
    }
    const reason = writeError instanceof Error ? writeError.message : 'unknown error';
    fail(`Failed to write ${displayPath}: ${reason}`);
  }
  success(`Wrote ${count} test stub${count === 1 ? '' : 's'} to ${displayPath}`);
}

/** Find the ticket folder whose name is `ticket` or starts with `${ticket}-`. */
function resolveTicketDirectory(cwd: string, ticket: string): string | undefined {
  const ticketsRoot = resolveTicketsDirectory(cwd);
  let entries: string[];
  try {
    entries = readdirSync(ticketsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return undefined;
  }
  // Exact id wins over a `${id}-slug` prefix, independent of readdir order.
  const match =
    entries.find(name => name === ticket) ?? entries.find(name => name.startsWith(`${ticket}-`));
  return match === undefined ? undefined : nodePath.join(ticketsRoot, match);
}

/** Report an error to stderr and exit non-zero. */
function fail(message: string): never {
  error(message);
  process.exit(1);
}
