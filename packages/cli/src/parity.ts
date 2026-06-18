import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { ContractDefinition, FileDefinition } from './schema.js';

interface ParitySchema {
  ownedFiles: Record<string, FileDefinition>;
  // Optional: personas/glossary templates are referenced here, not in ownedFiles.
  // Included so the orphan-template scan doesn't false-flag them.
  managedFiles?: Record<string, FileDefinition>;
  contracts: Record<string, ContractDefinition>;
}

interface ParityFailure {
  kind: 'pair' | 'contract' | 'orphan-template' | 'cursor-rule';
  message: string;
}

export interface ParityResult {
  failures: ParityFailure[];
  passedCount: number;
}

export interface ParityInput {
  schema: ParitySchema;
  mode: 'all' | 'contracts-only';
  rootDirectory: string;
  templatesDirectory: string;
}

function checkPair(
  destinationPath: string,
  template: string,
  rootDirectory: string,
  templatesDirectory: string,
): ParityFailure | undefined {
  const templateFile = nodePath.join(templatesDirectory, template);
  const dogfoodFile = nodePath.join(rootDirectory, destinationPath);
  const templateExists = existsSync(templateFile);
  const dogfoodExists = existsSync(dogfoodFile);

  if (!templateExists || !dogfoodExists) {
    const missing: string[] = [];
    if (!templateExists) missing.push(template);
    if (!dogfoodExists) missing.push(destinationPath);
    return { kind: 'pair', message: `[PAIR] Missing file(s): ${missing.join(', ')}` };
  }

  if (readFileSync(templateFile, 'utf8') === readFileSync(dogfoodFile, 'utf8')) {
    return undefined;
  }
  return { kind: 'pair', message: `[PAIR] Drift: ${destinationPath} ≠ ${template}` };
}

function checkContract(
  path: string,
  contract: ContractDefinition,
  rootDirectory: string,
): ParityFailure | undefined {
  const filePath = nodePath.join(rootDirectory, path);
  if (!existsSync(filePath)) {
    return { kind: 'contract', message: `[CONTRACT] Target file missing: ${path}` };
  }
  const content = readFileSync(filePath, 'utf8');
  const missing = contract.requires.filter(s => !content.includes(s));
  if (missing.length === 0) return undefined;
  return {
    kind: 'contract',
    message: `[CONTRACT] Missing in ${path}: ${missing.join(', ')}`,
  };
}

/** Every file under templatesDirectory, recursively. Skips `_`-prefixed dirs
 * (shared includes, not installable templates) — mirrors the schema test. */
function collectTemplateFiles(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;
      files.push(...collectTemplateFiles(nodePath.join(directory, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

/** template → schema: every template file must be referenced by an
 * ownedFiles/managedFiles `template:` value, else it ships but is never
 * deployed/reconciled (the spec-template.md gap, ticket 04NKDR). */
function checkOrphanTemplates(templatesDirectory: string, schema: ParitySchema): ParityFailure[] {
  const referenced = new Set<string>(
    [...Object.values(schema.ownedFiles), ...Object.values(schema.managedFiles ?? {})]
      .map(definition => definition.template)
      .filter((template): template is string => template !== undefined),
  );
  return collectTemplateFiles(templatesDirectory)
    .filter(file => !referenced.has(file))
    .map(file => ({
      kind: 'orphan-template' as const,
      message: `[TEMPLATE] Unregistered template (no ownedFiles/managedFiles entry): ${file}`,
    }));
}

/** Every Cursor rule must be a thin `@reference` pointer to its canonical
 * skill/instruction file — never duplicated content. Parity-check validates
 * template↔dogfood within a toolchain but NOT Claude-skill↔Cursor-rule
 * equivalence, so a fat rule silently drifts from the skill it mirrors. This
 * guard keeps the skill the single source of truth (ticket 151): after the YAML
 * frontmatter, every non-blank body line must be an `@`-reference. */
function checkCursorRulesThin(templatesDirectory: string): ParityFailure[] {
  const rulesDirectory = nodePath.join(templatesDirectory, 'cursor', 'rules');
  if (!existsSync(rulesDirectory)) return [];
  const failures: ParityFailure[] = [];
  for (const entry of readdirSync(rulesDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.mdc')) continue;
    const lines = readFileSync(nodePath.join(rulesDirectory, entry.name), 'utf8').split('\n');
    const frontmatterEnd = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
    const bodyLines = frontmatterEnd === -1 ? lines : lines.slice(frontmatterEnd + 1);
    const fatLines = bodyLines
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('@'));
    if (fatLines.length > 0) {
      failures.push({
        kind: 'cursor-rule',
        message: `[CURSOR-RULE] cursor/rules/${entry.name} is not a thin @reference pointer (${fatLines.length} content line(s)) — Cursor skill-rules must be a single \`@.claude/skills/<name>/SKILL.md\` pointer, not duplicated skill content (ticket 151).`,
      });
    }
  }
  return failures;
}

export function runParity(input: ParityInput): ParityResult {
  const failures: ParityFailure[] = [];
  let passedCount = 0;

  if (input.mode === 'all') {
    for (const [destinationPath, definition] of Object.entries(input.schema.ownedFiles)) {
      if (!definition.template) continue;
      const failure = checkPair(
        destinationPath,
        definition.template,
        input.rootDirectory,
        input.templatesDirectory,
      );
      if (failure) failures.push(failure);
      else passedCount += 1;
    }
  }

  for (const [path, contract] of Object.entries(input.schema.contracts)) {
    const failure = checkContract(path, contract, input.rootDirectory);
    if (failure) failures.push(failure);
    else passedCount += 1;
  }

  // Orphan-template + cursor-rule scans run in BOTH modes (like contracts) so
  // pre-commit's --mode=contracts-only hard-blocks an unregistered template or a
  // re-fattened Cursor rule before it lands (tickets 04NKDR, 151).
  failures.push(
    ...checkOrphanTemplates(input.templatesDirectory, input.schema),
    ...checkCursorRulesThin(input.templatesDirectory),
  );

  return { failures, passedCount };
}
