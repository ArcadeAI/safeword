import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');
const MIGRATED_CONFIG_ONLY_TEST_FILES = [
  'tests/commands/setup-cursor.test.ts',
  'tests/commands/setup-git.test.ts',
  'tests/commands/setup-hooks.test.ts',
  'tests/commands/setup-templates.test.ts',
  'tests/integration/conditional-setup.test.ts',
  'tests/integration/invisible-extension.test.ts',
];

const CLI_HELPER_EXPORTS = new Set(['runCli', 'runCliSync', 'runCliWithoutInstall']);

interface HelperImports {
  aliases: Map<string, string>;
  namespaces: Set<string>;
}

function getHelperBindings(statement: ts.Statement): ts.NamedImportBindings | undefined {
  if (
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    !/(?:^|\/)helpers(?:\.ts)?$/.test(statement.moduleSpecifier.text)
  ) {
    return undefined;
  }
  return statement.importClause?.namedBindings;
}

function registerHelperBindings(bindings: ts.NamedImportBindings, imports: HelperImports): void {
  if (ts.isNamespaceImport(bindings)) {
    imports.namespaces.add(bindings.name.text);
    return;
  }
  for (const element of bindings.elements) {
    const importedName = element.propertyName?.text ?? element.name.text;
    if (CLI_HELPER_EXPORTS.has(importedName)) {
      imports.aliases.set(element.name.text, importedName);
    }
  }
}

function collectHelperImports(sourceFile: ts.SourceFile): HelperImports {
  const imports: HelperImports = { aliases: new Map(), namespaces: new Set() };

  for (const statement of sourceFile.statements) {
    const bindings = getHelperBindings(statement);
    if (bindings) {
      registerHelperBindings(bindings, imports);
    }
  }

  return imports;
}

function resolveCliHelperCall(node: ts.CallExpression, imports: HelperImports): string | undefined {
  if (ts.isIdentifier(node.expression)) {
    return imports.aliases.get(node.expression.text);
  }
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    imports.namespaces.has(node.expression.expression.text) &&
    CLI_HELPER_EXPORTS.has(node.expression.name.text)
  ) {
    return node.expression.name.text;
  }
  return undefined;
}

function collectCliHelperCallNames(source: string, fileName = 'fixture.ts'): Set<string> {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const imports = collectHelperImports(sourceFile);
  const callNames = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const helperName = resolveCliHelperCall(node, imports);
      if (helperName) {
        callNames.add(helperName);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return callNames;
}

describe('default test install boundary', () => {
  it.each(MIGRATED_CONFIG_ONLY_TEST_FILES)(
    '%s keeps its audited setup calls on the explicit no-install helper',
    relativePath => {
      const source = readFileSync(nodePath.join(CLI_ROOT, relativePath), 'utf8');
      const callNames = collectCliHelperCallNames(source, relativePath);

      expect(callNames).toContain('runCliWithoutInstall');
      expect(callNames).not.toContain('runCli');
      expect(callNames).not.toContain('runCliSync');
    },
  );

  it('recognizes aliased and namespace calls to CLI helpers', () => {
    const source = `
      import { runCli as installCapable, runCliWithoutInstall as noInstall } from '../helpers';
      import * as helpers from '../helpers';

      installCapable(['setup']);
      noInstall(['setup']);
      helpers.runCliSync(['setup']);
      unrelated.runCli(['setup']);
    `;

    expect(collectCliHelperCallNames(source)).toEqual(
      new Set(['runCli', 'runCliWithoutInstall', 'runCliSync']),
    );
  });

  it('keeps the non-git dependency installation proof in a dedicated slow file', () => {
    const proofPath = nodePath.join(
      CLI_ROOT,
      'tests/integration/non-git-install-proof.slow.test.ts',
    );

    expect(existsSync(proofPath)).toBe(true);
    expect(proofPath).toMatch(/\.slow\.test\.ts$/);
  });

  it('runs the focused physical-install proof in CI', () => {
    const packageJson = JSON.parse(
      readFileSync(nodePath.join(CLI_ROOT, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };
    const workflowSource = readFileSync(
      nodePath.resolve(CLI_ROOT, '..', '..', '.github/workflows/ci.yml'),
      'utf8',
    );

    expect(packageJson.scripts?.['test:slow:install-proof']).toBe(
      'node scripts/run-vitest-with-build-lock.mjs --config vitest.slow.config.ts ' +
        'tests/integration/non-git-install-proof.slow.test.ts',
    );
    expect(workflowSource).toContain('bun run --cwd packages/cli test:slow:install-proof');
  });
});
