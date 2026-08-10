import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { compatibilityRoutes, publicCommands } from '../src/cli-protocol/catalog.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const referencePath = nodePath.join(
  repoRoot,
  'packages/website/src/content/docs/reference/cli.mdx',
);

function markdownTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map(row => row[index]?.length ?? 0)),
  );
  const row = (cells: readonly string[]): string =>
    `| ${cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(' | ')} |`;
  return [
    row(headers),
    row(widths.map(width => '-'.repeat(width))),
    ...rows.map(cells => row(cells)),
  ].join('\n');
}

function generatedRegion(name: string, body: string): string {
  return [
    `{/* safeword:generated-cli-${name}:start */}`,
    '',
    body,
    '',
    `{/* safeword:generated-cli-${name}:end */}`,
  ].join('\n');
}

function replaceRegion(source: string, name: string, body: string): string {
  const start = `{/* safeword:generated-cli-${name}:start */}`;
  const end = `{/* safeword:generated-cli-${name}:end */}`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Missing generated CLI reference region: ${name}`);
  }
  return `${source.slice(0, startIndex)}${generatedRegion(name, body)}${source.slice(endIndex + end.length)}`;
}

function commandRows(): string[][] {
  return publicCommands
    .filter(command => command.aliasFor === undefined)
    .map(command => [
      `\`${command.name}\``,
      command.effectClass,
      command.description.replaceAll('|', String.raw`\|`),
    ]);
}

function compatibilityRows(): string[][] {
  return compatibilityRoutes.map(route => [
    route.route === 'bare safeword' ? 'bare `safeword`' : `\`${route.route}\``,
    `\`${route.replacement}\``,
  ]);
}

export function renderCliReference(source: string): string {
  const commands = markdownTable(['Command', 'Effect', 'Purpose'], commandRows());
  const compatibility = markdownTable(
    ['Retained route', 'Canonical replacement'],
    compatibilityRows(),
  );
  return `${replaceRegion(replaceRegion(source, 'commands', commands), 'compatibility', compatibility).trimEnd()}\n`;
}

if (import.meta.main) {
  const source = readFileSync(referencePath, 'utf8');
  const rendered = renderCliReference(source);
  if (process.argv.includes('--check')) {
    if (source !== rendered) {
      console.error(
        `Generated CLI reference is stale: ${nodePath.relative(repoRoot, referencePath)}`,
      );
      process.exitCode = 1;
    }
  } else {
    writeFileSync(referencePath, rendered);
    console.log(`Generated ${nodePath.relative(repoRoot, referencePath)}.`);
  }
}
