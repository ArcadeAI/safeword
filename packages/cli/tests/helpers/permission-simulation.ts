/** Detects uid-dependent permission-failure simulations in test source. */

import ts from 'typescript';

/** Owner read+write. A mode missing either bit removes access. */
const OWNER_READ_WRITE = 0o600;

const CHMOD_NAMES = new Set(['chmod', 'chmodSync', 'lchmod', 'lchmodSync', 'fchmod', 'fchmodSync']);

const SHELL_CHMOD_CALL = /chmod\s+(?:-[A-Za-z-]+\s+)*(?<mode>[^\s;&|)'"`]+)/gu;

interface Simulation {
  label: string;
  offset: number;
}

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile(
    'permission-simulation.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function visit(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  ts.forEachChild(node, child => {
    visit(child, visitor);
  });
}

function importedChmodNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set(CHMOD_NAMES);
  visit(sourceFile, node => {
    if (!ts.isImportSpecifier(node)) return;
    const imported = (node.propertyName ?? node.name).text;
    if (CHMOD_NAMES.has(imported)) names.add(node.name.text);
  });
  return names;
}

function calledName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteral(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text;
  }
  return undefined;
}

/** The numeric value of a literal chmod mode, or undefined when it is dynamic. */
export function literalMode(argument: string): number | undefined {
  const octal = /^0o([0-7]{3,4})$/u.exec(argument);
  if (octal?.[1] !== undefined) return Number.parseInt(octal[1], 8);
  const quoted = /^(['"])([0-7]{1,4})\1$/u.exec(argument);
  if (quoted?.[2] !== undefined) return Number.parseInt(quoted[2], 8);
  return argument === '0' ? 0 : undefined;
}

function chmodModeArgumentsFromFile(
  sourceFile: ts.SourceFile,
): { mode: string; name: string; offset: number }[] {
  const names = importedChmodNames(sourceFile);
  const modes: { mode: string; name: string; offset: number }[] = [];
  visit(sourceFile, node => {
    if (!ts.isCallExpression(node)) return;
    const name = calledName(node.expression);
    const mode = node.arguments[1];
    if (name === undefined || !names.has(name) || mode === undefined) return;
    modes.push({ mode: mode.getText(sourceFile), name, offset: node.getStart(sourceFile) });
  });
  return modes;
}

/** Every fs chmod call and its second (mode) argument. */
export function chmodModeArguments(
  source: string,
): { mode: string; name: string; offset: number }[] {
  return chmodModeArgumentsFromFile(parse(source));
}

interface OwnerAccess {
  read: boolean;
  write: boolean;
}

function applySymbolicClause(access: OwnerAccess, clause: string): OwnerAccess | undefined {
  const symbolic = /^([augo]*)([-+=])([rwxXst]*)$/u.exec(clause);
  if (!symbolic) return undefined;
  const [, who = '', operator, permissions = ''] = symbolic;
  if (who !== '' && !who.includes('a') && !who.includes('u')) return access;
  if (operator === '=') {
    return { read: permissions.includes('r'), write: permissions.includes('w') };
  }
  return {
    read: permissions.includes('r') ? operator === '+' : access.read,
    write: permissions.includes('w') ? operator === '+' : access.write,
  };
}

/** Whether a command-line chmod mode removes owner read or write. */
export function shellModeRemovesAccess(mode: string): boolean {
  const numeric = /^([0-7]{3,4})$/u.exec(mode);
  if (numeric?.[1] !== undefined) {
    return (Number.parseInt(numeric[1], 8) & OWNER_READ_WRITE) !== OWNER_READ_WRITE;
  }
  let access: OwnerAccess = { read: true, write: true };
  for (const clause of mode.split(',')) {
    const next = applySymbolicClause(access, clause);
    if (!next) return false;
    access = next;
  }
  return !access.read || !access.write;
}

function literalText(node: ts.Node | undefined): string | undefined {
  if (node && (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node))) return node.text;
  return undefined;
}

function spawnedSimulations(sourceFile: ts.SourceFile): Simulation[] {
  const found: Simulation[] = [];
  visit(sourceFile, node => {
    if (!ts.isCallExpression(node) || literalText(node.arguments[0]) !== 'chmod') return;
    const argv = node.arguments[1];
    if (!argv || !ts.isArrayLiteralExpression(argv)) return;
    const mode = argv.elements.map(literalText).find(value => value && !value.startsWith('-'));
    if (mode && shellModeRemovesAccess(mode)) {
      found.push({ label: `chmod ${mode} (spawned)`, offset: node.getStart(sourceFile) });
    }
  });
  return found;
}

function shellSimulations(sourceFile: ts.SourceFile): Simulation[] {
  const found: Simulation[] = [];
  visit(sourceFile, node => {
    const text = literalText(node);
    if (text === undefined) return;
    for (const match of text.matchAll(SHELL_CHMOD_CALL)) {
      const mode = match.groups?.mode ?? '';
      if (shellModeRemovesAccess(mode)) {
        found.push({ label: match[0], offset: node.getStart(sourceFile) });
      }
    }
  });
  return found;
}

function bindingSimulations(sourceFile: ts.SourceFile): Simulation[] {
  return chmodModeArgumentsFromFile(sourceFile)
    .filter(call => {
      const mode = literalMode(call.mode);
      return mode !== undefined && (mode & OWNER_READ_WRITE) !== OWNER_READ_WRITE;
    })
    .map(call => ({ label: `${call.name}(…, ${call.mode})`, offset: call.offset }));
}

function testDeclaration(call: ts.CallExpression): boolean {
  let expression: ts.Expression = call.expression;
  while (ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression)) {
    expression = expression.expression;
  }
  return ts.isIdentifier(expression) && (expression.text === 'it' || expression.text === 'test');
}

function enclosingTest(sourceFile: ts.SourceFile, offset: number): ts.CallExpression | undefined {
  let enclosing: ts.CallExpression | undefined;
  visit(sourceFile, node => {
    if (!ts.isCallExpression(node) || !testDeclaration(node)) return;
    if (node.getStart(sourceFile) <= offset && offset < node.getEnd()) enclosing = node;
  });
  return enclosing;
}

function guardedAsNonRoot(sourceFile: ts.SourceFile, simulation: Simulation): boolean {
  const test = enclosingTest(sourceFile, simulation.offset);
  if (!test || !ts.isCallExpression(test.expression)) return false;
  const modifier = test.expression;
  if (!ts.isPropertyAccessExpression(modifier.expression)) return false;
  if (modifier.expression.name.text !== 'skipIf') return false;
  return modifier.arguments[0]?.getText(sourceFile).includes('process.getuid') ?? false;
}

/**
 * Finds literal permission-removing simulations not enclosed by a root-skipped
 * test. TypeScript owns source parsing; this module only interprets chmod calls
 * and shell strings, avoiding a second, incomplete JavaScript lexer.
 */
export function permissionSimulations(source: string): string[] {
  const sourceFile = parse(source);
  const found = [
    ...bindingSimulations(sourceFile),
    ...spawnedSimulations(sourceFile),
    ...shellSimulations(sourceFile),
  ];
  return found
    .filter(simulation => !guardedAsNonRoot(sourceFile, simulation))
    .map(simulation => simulation.label);
}
