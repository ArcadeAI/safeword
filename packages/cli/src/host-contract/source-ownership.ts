import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import ts from 'typescript';

import type { Finding } from '../cli-protocol/result.js';

const CODEX_ADAPTER = 'packages/cli/src/commands/codex-hook.ts';
const OPENCODE_CATALOGUE = 'packages/cli/src/opencode/catalogue.ts';
const SHARED_GATE = 'packages/cli/templates/hooks/pre-tool-quality.ts';

function source(root: string, path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(nodePath.join(root, path), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

function initializerValue(value: ts.Expression): ts.Expression {
  let expression = value;
  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  )
    expression = expression.expression;
  return expression;
}

function declaredStringArrays(
  file: ts.SourceFile,
): { name: string; values: string[]; line: number }[] {
  const arrays: { name: string; values: string[]; line: number }[] = [];
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const expression = initializerValue(node.initializer);
      if (ts.isArrayLiteralExpression(expression)) {
        const values = expression.elements.flatMap(entry =>
          ts.isStringLiteral(entry) ? [entry.text] : [],
        );
        if (values.length === expression.elements.length)
          arrays.push({
            name: node.name.text,
            values,
            line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return arrays;
}

function competingOwner(id: string, path: string, declaration: string, line: number): Finding {
  return {
    code: 'COMPETING_HOST_CONTRACT_OWNER',
    severity: 'error',
    message: `${id}: independently authored policy remains at ${path}:${line} (${declaration}).`,
    metadata: { owner_id: id, path, declaration, line },
  };
}

function intakeOwners(root: string): Finding[] {
  // Compare with the existing decision owner's actual inputs, not a second list.
  const declarations = declaredStringArrays(source(root, SHARED_GATE)).filter(
    entry => entry.name === 'required',
  );
  if (declarations.length !== 1 || !declarations[0]?.values.length)
    throw new Error(`Cannot identify one shared intake input declaration in ${SHARED_GATE}`);
  const expected = new Set(declarations[0].values);
  return declaredStringArrays(source(root, CODEX_ADAPTER))
    .filter(entry => {
      const actual = new Set(entry.values);
      return actual.size === expected.size && [...expected].every(value => actual.has(value));
    })
    .map(entry =>
      competingOwner('codex.intake.required-fields', CODEX_ADAPTER, entry.name, entry.line),
    );
}

function importedOwner(module: string, imported: string): string | undefined {
  if (module.endsWith('/codex-plugin/catalogue.js') && imported === 'generateCodexPluginAssets')
    return 'opencode.catalogue.codex-renderer-authority';
  if (module.endsWith('/cursor-wrappers.js') && imported === 'CURSOR_COMMAND_WRAPPERS')
    return 'opencode.catalogue.cursor-command-authority';
  return undefined;
}

function importOwners(file: ts.SourceFile, statement: ts.Statement): Finding[] {
  if (
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
  )
    return [];
  const module = statement.moduleSpecifier.text;
  const bindings = statement.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  return bindings.elements.flatMap(binding => {
    if (binding.isTypeOnly) return [];
    const imported = (binding.propertyName ?? binding.name).text;
    const owner = importedOwner(module, imported);
    if (owner === undefined) return [];
    const line = file.getLineAndCharacterOfPosition(binding.getStart()).line + 1;
    return [competingOwner(owner, OPENCODE_CATALOGUE, imported, line)];
  });
}

function catalogueOwners(root: string): Finding[] {
  const file = source(root, OPENCODE_CATALOGUE);
  return file.statements.flatMap(statement => importOwners(file, statement));
}

/** Source facts only; no host decision or caller-authored maintenance-savings claim. */
export function findCompetingHostContractOwners(root: string): Finding[] {
  return [...intakeOwners(root), ...catalogueOwners(root)];
}
