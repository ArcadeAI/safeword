/**
 * `safeword codify <ticket>` — emit derived test artifacts from a ticket's
 * `.feature` source when present, or legacy test-definitions.md otherwise.
 * Resolves the ticket folder, parses scenarios, and renders the skeleton to
 * stdout (default) or a file (`--out`, which refuses to overwrite). The
 * transforms live in pure utils; this command owns only I/O and errors.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { readBddConventionsPath, resolveTicketsDirectory } from '../utils/configured-paths.js';
import { findFeatureSourcePath } from '../utils/feature-source.js';
import { FeatureParseError, parseFeatureScenarios } from '../utils/gherkin-feature.js';
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

/** Abort the typed command so its boundary can convert the error into a result. */
function fail(message: string): never {
  throw new Error(message);
}
