import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse, stringify } from 'yaml';

export interface GeneratedPluginAsset {
  relativePath: string;
  content: string;
}

export const CODEX_SKILL_METADATA_LIMIT = 8000;
export const CODEX_MARKETPLACE_NAME = 'safeword';
export const CODEX_PLUGIN_NAME = 'safeword';

interface CanonicalSkillMetadata extends Record<string, unknown> {
  name?: unknown;
  description?: unknown;
}

interface CanonicalSkillAsset {
  relativePath: string;
  skill: string;
  filename: string;
}

const FRONTMATTER = /^---\r?\n(?<metadata>[\s\S]*?)\r?\n---\r?\n/u;
const SUPPORTED_SOURCE_METADATA = new Set([
  'name',
  'description',
  'allowed-tools',
  'disallowed-tools',
  'disable-model-invocation',
  'effort',
  'user-invocable',
]);

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const relativePath = nodePath.join(prefix, entry.name);
      const absolutePath = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(absolutePath, relativePath);
      return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : [];
    })
    .toSorted((left, right) => left.localeCompare(right));
}

function canonicalSkillPath(relativePath: string): { skill: string; filename: string } {
  const [skill, filename, ...rest] = relativePath.split(nodePath.sep);
  if (skill === undefined || filename === undefined || rest.length > 0) {
    throw new Error(`unexpected canonical skill path: ${relativePath}`);
  }
  return { skill, filename };
}

function isCanonicalSkillMetadata(value: unknown): value is CanonicalSkillMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFrontmatter(content: string): { body: string; metadata: unknown } | undefined {
  const frontmatter = FRONTMATTER.exec(content);
  if (frontmatter?.groups?.metadata === undefined) return undefined;

  return {
    body: content.slice(frontmatter[0].length),
    metadata: parse(frontmatter.groups.metadata),
  };
}

function parseSkill(content: string, skill: string): { body: string; description: string } {
  const frontmatter = readFrontmatter(content);
  if (frontmatter === undefined) {
    throw new Error(`canonical skill ${skill} has no YAML frontmatter`);
  }

  const { metadata } = frontmatter;
  if (!isCanonicalSkillMetadata(metadata)) {
    throw new Error(`canonical skill ${skill} has invalid metadata`);
  }

  const unsupportedMetadata = Object.keys(metadata).find(
    key => !SUPPORTED_SOURCE_METADATA.has(key),
  );
  if (unsupportedMetadata !== undefined) {
    throw new Error(`canonical skill ${skill} has unsupported metadata: ${unsupportedMetadata}`);
  }

  if (metadata.name !== skill || typeof metadata.description !== 'string') {
    throw new Error(`canonical skill ${skill} has invalid name or description metadata`);
  }

  return {
    body: frontmatter.body,
    description: metadata.description,
  };
}

function isAsciiLowercase(character: string): boolean {
  return character >= 'a' && character <= 'z';
}

function isAsciiUppercase(character: string): boolean {
  return character >= 'A' && character <= 'Z';
}

function isAsciiDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

function isWorkflowNameCharacter(character: string): boolean {
  return isAsciiLowercase(character) || character === '-';
}

function isWorkflowPathExtensionStart(character: string): boolean {
  return (
    isAsciiLowercase(character) ||
    isAsciiUppercase(character) ||
    isAsciiDigit(character) ||
    character === '_' ||
    character === '-'
  );
}

function isWorkflowInvocationPrefix(character: string | undefined): boolean {
  return (
    character === undefined ||
    (!isWorkflowNameCharacter(character) &&
      !isAsciiDigit(character) &&
      character !== '_' &&
      character !== '/')
  );
}

function hasWorkflowPathSuffix(markdown: string, nameEnd: number): boolean {
  const suffix = markdown[nameEnd];
  const firstPathCharacter = markdown[nameEnd + 1] ?? '';
  return suffix === '/' || (suffix === '.' && isWorkflowPathExtensionStart(firstPathCharacter));
}

function hasWorkflowInvocationBoundary(markdown: string, nameEnd: number): boolean {
  const next = markdown[nameEnd];
  return (
    next === undefined || (!isWorkflowNameCharacter(next) && !isAsciiDigit(next) && next !== '_')
  );
}

export function adaptCodexWorkflowInvocations(
  markdown: string,
  knownSkillNames: ReadonlySet<string>,
): string {
  let adapted = '';
  let copiedThrough = 0;
  let slash = markdown.indexOf('/');

  while (slash !== -1) {
    const nameStart = slash + 1;
    let nameEnd = nameStart;
    while (isWorkflowNameCharacter(markdown[nameEnd] ?? '')) nameEnd += 1;
    const name = markdown.slice(nameStart, nameEnd);

    if (
      isAsciiLowercase(name[0] ?? '') &&
      isWorkflowInvocationPrefix(markdown[slash - 1]) &&
      knownSkillNames.has(name) &&
      !hasWorkflowPathSuffix(markdown, nameEnd) &&
      hasWorkflowInvocationBoundary(markdown, nameEnd)
    ) {
      adapted += `${markdown.slice(copiedThrough, slash)}$safeword:${name}`;
      copiedThrough = nameEnd;
    }
    slash = markdown.indexOf('/', slash + 1);
  }

  return `${adapted}${markdown.slice(copiedThrough)}`;
}

// Codex skills invoke project-local `.safeword/hooks` scripts, none of which
// exist in Codex's self-contained plugin. Each is rewritten to the equivalent
// public subcommand in the plugin's bundled CLI. Skills do not receive the
// PLUGIN_ROOT variable that hook-command shells receive, so use Codex's stable
// versioned plugin-cache layout instead.
//
// Codex cannot instead ship and call those scripts: its plugin-root anchor
// (`PLUGIN_ROOT`) is injected only into hook-command shells, never into the
// shell a skill's bash block runs in, so a vendored path would rest on the
// model resolving a relative path — too soft for a gate.
//
// `{cli}` in a replacement is filled with the host's packaged CLI command.
const SCRIPT_REWRITES: readonly { readonly invocation: string; readonly replacement: string }[] = [
  // Prefix swap: `review run …` and its own arguments follow unchanged.
  //
  // The rewrite carries the one thing the wrapper did that the bare subcommand
  // does not: `SAFEWORD_REVIEW_PROGRESS`. The wrapper set it in the child
  // environment for exactly this shape of call (`review run … --json`), and it
  // is what promotes a `--json` review from silent to heartbeating. Reviews run
  // for minutes; the heartbeat is the only proof the coordinator is still
  // alive. It is read and deleted before any reviewer subprocess spawns, so it
  // cannot leak onward, and progress is written to stderr — never stdout, which
  // stays clean for the caller parsing the JSON envelope.
  {
    invocation: 'bun .safeword/hooks/run-review.ts ',
    replacement: 'SAFEWORD_REVIEW_PROGRESS=1 {cli} ',
  },
  // Whole-invocation swap: the script takes no arguments at its call sites, and
  // the caller reads the JSON envelope.
  {
    invocation: 'bun .safeword/hooks/resolve-project-knowledge.ts',
    replacement: '{cli} project review-knowledge --json',
  },
  // Prefix swap with no `--json`: the caller consumes raw stdout (the retro
  // filer streams the validated JSONL onward), which the envelope would replace.
  {
    invocation: 'bun .safeword/hooks/lib/drain-retro-spool.ts ',
    replacement: '{cli} project retro-drain ',
  },
  {
    invocation: 'source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"',
    replacement: 'source <({cli} project audit-scope)',
  },
  {
    invocation: 'bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" ',
    replacement: '{cli} project record-skill-invocation ',
  },
  {
    invocation: 'bun "$PROJECT_DIR/.safeword/hooks/audit-principle-trace.ts" "$PROJECT_DIR"',
    replacement: '{cli} project runtime audit-principle-trace',
  },
  {
    invocation: 'bun "$PROJECT_DIR/.safeword/hooks/resolve-verify-ticket.ts" "$PROJECT_DIR"',
    replacement: '{cli} project runtime resolve-verify-ticket',
  },
  {
    invocation: 'bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" ',
    replacement: '{cli} project runtime write-review-stamp ',
  },
  {
    invocation: 'bun .safeword/hooks/write-review-stamp.ts ',
    replacement: '{cli} project runtime write-review-stamp ',
  },
  {
    invocation: 'bun .safeword/scripts/closeout-cleanup.ts ',
    replacement: '{cli} project runtime closeout-cleanup ',
  },
  {
    invocation: './.safeword/scripts/cleanup-zombies.sh',
    replacement: '{cli} project runtime cleanup-zombies',
  },
];

function codexBundledCliCommand(version: string): string {
  return `bun "\${CODEX_HOME:-$HOME/.codex}/plugins/cache/${CODEX_MARKETPLACE_NAME}/${CODEX_PLUGIN_NAME}/${version}/runtime/cli.js"`;
}

function adaptRuntimeInvocations(markdown: string, cli: string): string {
  let adapted = markdown;
  for (const { invocation, replacement } of SCRIPT_REWRITES) {
    adapted = adapted.split(invocation).join(replacement.split('{cli}').join(cli));
  }
  return adapted;
}

export function adaptPackagedRuntimeInvocations(markdown: string, version: string): string {
  return adaptRuntimeInvocations(markdown, `bunx --bun safeword@${version}`);
}

export function adaptNativeRuntimeInvocations(markdown: string, version: string): string {
  const cli = `bunx --bun safeword@${version}`;
  return adaptNamespaceRootInvocations(adaptRuntimeInvocations(markdown, cli), cli);
}

function adaptCodexNativeRuntimeInvocations(markdown: string, version: string): string {
  const cli = codexBundledCliCommand(version);
  return adaptNamespaceRootInvocations(adaptRuntimeInvocations(markdown, cli), cli);
}

// resolve-namespace-root.ts needs its own pass: its positional modes map onto
// `project namespace-root`'s flags. The script's third argument defaults to
// `<key>.md` (see resolveConfiguredPath), which is also the subcommand's own
// default, so `<key>` and `<key> <key>.md` both reduce to `--key <key>`.
//
// PRESERVE ON ANYTHING UNRECOGNISED, on every branch. The subcommand takes no
// operands, so emitting the new command in front of an argument form we did not
// map produces a command that exits 1 — and these invocations are captured as
// `NS_ROOT="$(… 2> /dev/null)"`, which turns that failure into a silent empty
// path. Leaving the original text alone instead fails loudly at generation
// review rather than quietly at runtime.
const NAMESPACE_ROOT_INVOCATION_PREFIX =
  'bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR"';
// Matched in two steps rather than one optional group, which keeps each
// pattern trivially linear.
const NAMESPACE_ROOT_KEY = /^ (?<key>[a-z]{1,32})(?=[ )"]|$)/u;
const NAMESPACE_ROOT_BASENAME = /^ (?<basename>[\w.-]{1,64})(?=[ )"]|$)/u;
/** A tail that continues with a positional operand rather than closing the call. */
const TRAILING_OPERAND = /^ (?!\d?[<>]|[|&#])\S/u;

function namespaceRootKey(tail: string): string | undefined {
  const match = NAMESPACE_ROOT_KEY.exec(tail);
  return match?.groups?.key;
}

function namespaceRootBasename(afterKey: string): string | undefined {
  const match = NAMESPACE_ROOT_BASENAME.exec(afterKey);
  return match?.groups?.basename;
}

/** Rewrite one invocation's trailing text, or return it unchanged to preserve. */
function rewriteNamespaceRootTail(tail: string, replacement: string): string {
  const preserved = NAMESPACE_ROOT_INVOCATION_PREFIX + tail;
  const key = namespaceRootKey(tail);

  // No key: safe only when nothing positional follows (`)"`, ` 2> /dev/null)"`).
  if (key === undefined) {
    return TRAILING_OPERAND.test(tail) ? preserved : replacement + tail;
  }

  const afterKey = tail.slice(key.length + 1);
  const basename = namespaceRootBasename(afterKey);

  // A non-default basename has no flag to carry it, so rewriting would
  // silently resolve a different file.
  if (basename !== undefined && basename !== `${key}.md`) return preserved;

  const remainder = basename === undefined ? afterKey : afterKey.slice(basename.length + 1);

  // The same guard the no-key branch uses: a key we mapped does not license
  // dropping an operand we did not.
  return TRAILING_OPERAND.test(remainder) ? preserved : `${replacement} --key ${key}${remainder}`;
}

function adaptNamespaceRootInvocations(markdown: string, cli: string): string {
  const replacement = `${cli} project namespace-root --cwd "$PROJECT_DIR"`;
  const [head, ...rest] = markdown.split(NAMESPACE_ROOT_INVOCATION_PREFIX);
  let adapted = head ?? '';

  for (const tail of rest) {
    adapted += rewriteNamespaceRootTail(tail, replacement);
  }

  return adapted;
}

function adaptWorkflowMarkdown(
  markdown: string,
  knownSkillNames: ReadonlySet<string>,
  version: string,
): string {
  let adapted = adaptCodexWorkflowInvocations(markdown, knownSkillNames);
  adapted = adaptCodexNativeRuntimeInvocations(adapted, version);

  return formatMarkdownTables(adapted);
}

function adaptReferenceDestination(
  destination: string,
  referenceNames: ReadonlySet<string>,
): string {
  const suffixIndex = destination.search(/[?#]/u);
  const path = suffixIndex === -1 ? destination : destination.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : destination.slice(suffixIndex);
  const unprefixedPath = path.startsWith('./') ? path.slice(2) : path;

  return referenceNames.has(unprefixedPath) ? `references/${unprefixedPath}${suffix}` : destination;
}

function adaptReferenceLinks(markdown: string, referenceNames: string[]): string {
  if (referenceNames.length === 0) return markdown;

  const knownReferences = new Set(referenceNames);
  let adapted = '';
  let cursor = 0;

  while (cursor < markdown.length) {
    const linkStart = markdown.indexOf('](', cursor);
    if (linkStart === -1) return adapted + markdown.slice(cursor);

    const prefixEnd = linkStart + 2;
    adapted += markdown.slice(cursor, prefixEnd);

    let destinationStart = prefixEnd;
    while (/\s/u.test(markdown[destinationStart] ?? '')) destinationStart += 1;
    adapted += markdown.slice(prefixEnd, destinationStart);

    const enclosed = markdown[destinationStart] === '<';
    if (enclosed) {
      adapted += '<';
      destinationStart += 1;
    }

    let destinationEnd = destinationStart;
    while (!/[\s)>]/u.test(markdown[destinationEnd] ?? ')')) destinationEnd += 1;

    const destination = markdown.slice(destinationStart, destinationEnd);
    adapted += adaptReferenceDestination(destination, knownReferences);
    cursor = destinationEnd;
  }

  return adapted;
}

function adaptInstalledReferencePaths(
  markdown: string,
  skill: string,
  referenceNames: string[],
): string {
  let adapted = markdown;
  for (const referenceName of referenceNames) {
    adapted = adapted.replaceAll(
      `\`.safeword/skills/${skill}/${referenceName}\``,
      () => `\`references/${referenceName}\``,
    );
  }
  return adapted;
}

function adaptSkillBody(
  body: string,
  skill: string,
  knownSkillNames: ReadonlySet<string>,
  referenceNames: string[],
  version: string,
): string {
  // Canonical skills have one blank line after frontmatter. The generated
  // frontmatter supplies that separator, so avoid duplicating it here.
  let adapted = body.replace(/^\r?\n/u, '');
  adapted = adaptInstalledReferencePaths(adapted, skill, referenceNames);
  adapted = adaptReferenceLinks(adapted, referenceNames);

  return adaptWorkflowMarkdown(adapted, knownSkillNames, version);
}

function tableCells(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim());
}

function isTableDelimiter(cells: string[], columnCount: number): boolean {
  return cells.length === columnCount && cells.every(cell => /^:?-{3,}:?$/u.test(cell));
}

/**
 * Rebuild one delimiter cell at the column's width while keeping its alignment.
 * `isTableDelimiter` accepts `:---`, `---:`, and `:---:`, so dropping the colons
 * would re-align every table the generator was only supposed to reformat.
 */
function formatDelimiterCell(source: string, width: number): string {
  const left = source.startsWith(':');
  const right = source.endsWith(':');
  const colons = (left ? 1 : 0) + (right ? 1 : 0);
  const dashes = Math.max(3, width - colons);
  return `${left ? ':' : ''}${'-'.repeat(dashes)}${right ? ':' : ''}`;
}

function formatMarkdownTable(rows: string[][]): string[] {
  const contentRows = rows.filter((_, rowIndex) => rowIndex !== 1);
  const widths = rows[0]?.map((headerCell, column) =>
    Math.max(headerCell.length, ...contentRows.map(cells => cells[column]?.length ?? 0)),
  );
  if (widths === undefined) return [];

  return rows.map((cells, row) => {
    const formattedCells = cells.map((cell, column) => {
      const width = widths[column];
      if (width === undefined) throw new Error('Markdown table has an invalid column width');
      return row === 1 ? formatDelimiterCell(cell, width) : cell.padEnd(width);
    });
    return `| ${formattedCells.join(' | ')} |`;
  });
}

/** Keep transformed Markdown tables stable under the repository's Prettier config. */
function formatMarkdownTables(markdown: string): string {
  const lines = markdown.split('\n');

  for (let start = 0; start < lines.length; start += 1) {
    const header = lines[start];
    const delimiter = lines[start + 1];
    if (header === undefined || delimiter === undefined || !header.startsWith('|')) continue;

    const headerCells = tableCells(header);
    if (!isTableDelimiter(tableCells(delimiter), headerCells.length)) continue;

    let end = start + 2;
    while (lines[end]?.startsWith('|') === true) end += 1;
    const rows = lines.slice(start, end).map(line => tableCells(line));
    if (rows.some(cells => cells.length !== headerCells.length)) continue;

    lines.splice(start, end - start, ...formatMarkdownTable(rows));
    start = end - 1;
  }

  return lines.join('\n');
}

/**
 * Adapt the canonical skill corpus into Codex's plugin layout. Only the source
 * metadata, explicit workflow invocations, and sibling reference paths change.
 *
 * `version` is REQUIRED, not defaulted: it is what the generated skills use
 * to address their bundled CLI in Codex's versioned plugin cache, so a caller that omitted it
 * would silently produce a catalogue that compares unequal to what ships —
 * the failure mode this signature exists to make a compile error. Production
 * callers pass {@link VERSION}; tests pin a literal.
 */
export function generateCodexPluginAssets(
  canonicalSkillsDirectory: string,
  version: string,
): GeneratedPluginAsset[] {
  const canonicalAssets: CanonicalSkillAsset[] = markdownFiles(canonicalSkillsDirectory).map(
    relativePath => ({ relativePath, ...canonicalSkillPath(relativePath) }),
  );
  const knownSkillNames = new Set(canonicalAssets.map(asset => asset.skill));
  const referenceNamesBySkill = new Map<string, string[]>();

  for (const asset of canonicalAssets) {
    if (asset.filename === 'SKILL.md') continue;
    const referenceNames = referenceNamesBySkill.get(asset.skill) ?? [];
    referenceNames.push(asset.filename);
    referenceNamesBySkill.set(asset.skill, referenceNames);
  }

  return canonicalAssets.map(({ relativePath, skill, filename }) => {
    const content = readFileSync(nodePath.join(canonicalSkillsDirectory, relativePath), 'utf8');
    if (filename !== 'SKILL.md') {
      return {
        relativePath: nodePath.join('skills', skill, 'references', filename),
        content: adaptWorkflowMarkdown(content, knownSkillNames, version),
      };
    }

    const { body, description } = parseSkill(content, skill);
    const referenceNames = referenceNamesBySkill.get(skill) ?? [];

    return {
      relativePath: nodePath.join('skills', skill, 'SKILL.md'),
      content: `---\n${stringify({
        name: skill,
        description: adaptCodexWorkflowInvocations(description, knownSkillNames),
      }).trimEnd()}\n---\n\n${adaptSkillBody(body, skill, knownSkillNames, referenceNames, version)}`,
    };
  });
}

function skillMetadataLength(asset: GeneratedPluginAsset): number {
  if (nodePath.basename(asset.relativePath) !== 'SKILL.md') return 0;
  const frontmatter = readFrontmatter(asset.content);
  if (frontmatter === undefined) {
    throw new Error(`generated skill ${asset.relativePath} has no YAML frontmatter`);
  }
  const { metadata } = frontmatter;
  if (
    !isCanonicalSkillMetadata(metadata) ||
    typeof metadata.name !== 'string' ||
    typeof metadata.description !== 'string'
  ) {
    throw new Error(
      `generated skill ${asset.relativePath} has invalid name or description metadata`,
    );
  }

  // Codex's initial skill list contains each skill's name, description, and file path.
  return metadata.name.length + metadata.description.length + asset.relativePath.length;
}

export function codexSkillMetadataCharacters(assets: GeneratedPluginAsset[]): number {
  return assets.reduce((total, asset) => total + skillMetadataLength(asset), 0);
}

export function assertCodexSkillMetadataBudget(assets: GeneratedPluginAsset[]): void {
  const characters = codexSkillMetadataCharacters(assets);
  if (characters > CODEX_SKILL_METADATA_LIMIT) {
    throw new Error(
      `Generated Codex skill metadata is ${characters} characters; limit is ${CODEX_SKILL_METADATA_LIMIT}.`,
    );
  }
}

function expectedAssetPaths(assets: GeneratedPluginAsset[]): Set<string> {
  return new Set(assets.map(asset => asset.relativePath));
}

function pluginAssetPaths(pluginDirectory: string): string[] {
  const skillsDirectory = nodePath.join(pluginDirectory, 'skills');
  if (!existsSync(skillsDirectory)) return [];
  return markdownFiles(skillsDirectory).map(relativePath => nodePath.join('skills', relativePath));
}

// All three failures below mean the checked-in catalogue no longer matches its
// canonical source, and share one remedy. The non-obvious trigger is a merge:
// git combines an edit to templates/skills/ with an untouched generated plugin
// cleanly, because they are different files — it has no notion that one derives
// from the other.
// Name the directory rather than using `--cwd packages/cli`: that flag resolves
// against the caller's cwd, so it fails from packages/cli — which is exactly
// where `bun run test:release` surfaces these errors.
const REGENERATE_REMEDY =
  'Regenerate the catalogue: `bun run generate:codex-plugin` from packages/cli.';
const UNBUNDLED_RUNTIME_HELPERS = [
  '.safeword/hooks/run-review.ts',
  '.safeword/hooks/resolve-project-knowledge.ts',
  '.safeword/hooks/resolve-namespace-root.ts',
  '.safeword/hooks/lib/drain-retro-spool.ts',
] as const;

/** Ensure the checked-in plugin is the exact allowed transformation of canonical skills. */
export function assertCodexPluginCatalogue(
  canonicalSkillsDirectory: string,
  pluginDirectory: string,
  version: string,
): void {
  const expectedAssets = generateCodexPluginAssets(canonicalSkillsDirectory, version);
  assertCodexSkillMetadataBudget(expectedAssets);
  for (const asset of expectedAssets) {
    const residualHelper = UNBUNDLED_RUNTIME_HELPERS.find(helper => asset.content.includes(helper));
    if (residualHelper !== undefined) {
      throw new Error(
        `Codex plugin asset retains unbundled runtime helper ${residualHelper}: ${asset.relativePath}\n${REGENERATE_REMEDY}`,
      );
    }
  }

  const expectedPaths = expectedAssetPaths(expectedAssets);
  const actualPaths = pluginAssetPaths(pluginDirectory);
  const missingPath = [...expectedPaths].find(path => !actualPaths.includes(path));
  if (missingPath !== undefined) {
    throw new Error(`Codex plugin is missing expected asset: ${missingPath}\n${REGENERATE_REMEDY}`);
  }

  const unexpectedPath = actualPaths.find(path => !expectedPaths.has(path));
  if (unexpectedPath !== undefined) {
    throw new Error(`Codex plugin has unexpected asset: ${unexpectedPath}\n${REGENERATE_REMEDY}`);
  }

  for (const asset of expectedAssets) {
    const actualPath = nodePath.join(pluginDirectory, asset.relativePath);
    const actualContent = readFileSync(actualPath, 'utf8');
    if (actualContent !== asset.content) {
      throw new Error(
        `Codex plugin asset differs from the canonical transformation: ${asset.relativePath}\n${REGENERATE_REMEDY}`,
      );
    }
  }
}

export function writeCodexPluginCatalogue(
  canonicalSkillsDirectory: string,
  pluginDirectory: string,
  version: string,
): GeneratedPluginAsset[] {
  const assets = generateCodexPluginAssets(canonicalSkillsDirectory, version);
  const skillsDirectory = nodePath.join(pluginDirectory, 'skills');
  rmSync(skillsDirectory, { recursive: true, force: true });

  for (const asset of assets) {
    const destination = nodePath.join(pluginDirectory, asset.relativePath);
    mkdirSync(nodePath.dirname(destination), { recursive: true });
    writeFileSync(destination, asset.content);
  }

  return assets;
}
