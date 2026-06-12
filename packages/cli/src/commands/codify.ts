/**
 * `safeword codify <ticket>` — emit a native vitest test skeleton from a ticket's
 * test-definitions.md (ticket CS86B0). Resolves the ticket folder, parses its
 * scenarios, and renders the skeleton to stdout (default) or a file (`--out`,
 * which refuses to overwrite). The transform itself lives in the pure
 * `utils/test-skeleton.ts`; this command owns only the I/O and error reporting.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import { error, success } from '../utils/output.js';
import { emitGherkinFeature, emitVitestSkeleton, parseScenarios } from '../utils/test-skeleton.js';

export interface CodifyOptions {
  /** Output format: `vitest` (default) or `gherkin`. */
  format?: string;
  /** Emit throwing `it(...)` bodies (a true-RED board) instead of pending stubs (vitest only). */
  red?: boolean;
  /** Write to this path (refusing to overwrite) instead of stdout. */
  out?: string;
}

export function codify(ticket: string, options: CodifyOptions): Promise<void> {
  codifySync(ticket, options);
  return Promise.resolve();
}

function codifySync(ticket: string, options: CodifyOptions): void {
  const cwd = process.cwd();
  const format = resolveFormat(options.format);

  const ticketDirectory = resolveTicketDirectory(cwd, ticket);
  if (ticketDirectory === undefined) {
    fail(`No ticket folder for "${ticket}" under the tickets directory.`);
  }

  const testDefinitionsPath = nodePath.join(ticketDirectory, 'test-definitions.md');
  if (!existsSync(testDefinitionsPath)) {
    fail(
      `No test-definitions.md in ${nodePath.relative(cwd, ticketDirectory)} — nothing to codify.`,
    );
  }

  const content = readFileSync(testDefinitionsPath, 'utf8');
  const scenarios = parseScenarios(content);
  if (scenarios.length === 0) {
    fail(`No scenarios found in ${nodePath.relative(cwd, testDefinitionsPath)}.`);
  }

  const skeleton =
    format === 'gherkin'
      ? emitGherkinFeature(content, { source: ticket })
      : emitVitestSkeleton(content, { red: options.red, source: ticket });
  if (options.out === undefined) {
    process.stdout.write(skeleton);
    return;
  }
  writeSkeleton(nodePath.resolve(cwd, options.out), options.out, skeleton, scenarios.length);
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
