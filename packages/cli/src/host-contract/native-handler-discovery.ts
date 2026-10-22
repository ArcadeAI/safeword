import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import ts from 'typescript';

import type { HostHandlerRegistration, NativeHandlerSource } from '../lifecycle/integrations.js';
import { configuredCommandHandlers } from './handlers.js';

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, child => {
    walk(child, visit);
  });
}

function propertyName(name: ts.PropertyName): string {
  return ts.isStringLiteral(name) || ts.isIdentifier(name) ? name.text : name.getText();
}

function callbackEvents(file: ts.SourceFile): { event: string; node: ts.Node }[] {
  const events: { event: string; node: ts.Node }[] = [];
  walk(file, node => {
    if (
      !ts.isReturnStatement(node) ||
      !node.expression ||
      !ts.isObjectLiteralExpression(node.expression)
    )
      return;
    for (const property of node.expression.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isArrowFunction(property.initializer)) continue;
      const event = propertyName(property.name);
      events.push({ event, node: property });
      if (event !== 'event') continue;
      walk(property.initializer, branch => {
        if (
          !ts.isBinaryExpression(branch) ||
          branch.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken
        )
          return;
        if (
          ts.isPropertyAccessExpression(branch.left) &&
          branch.left.name.text === 'type' &&
          ts.isStringLiteral(branch.right)
        )
          events.push({ event: branch.right.text, node: branch });
      });
    }
  });
  return events;
}

function sdkEvents(file: ts.SourceFile): { event: string; node: ts.Node }[] {
  const events: { event: string; node: ts.Node }[] = [];
  const contexts = new Set<string>();
  walk(file, node => {
    if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      node.type?.getText(file).endsWith('.Context')
    )
      contexts.add(node.name.text);
    if (ts.isMethodDeclaration(node) && propertyName(node.name) === 'setup') {
      const context = node.parameters[0]?.name;
      if (context && ts.isIdentifier(context)) contexts.add(context.text);
      events.push({ event: 'plugin.setup', node });
    }
  });
  walk(file, node => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    const method = node.expression;
    const receiver = method.expression;
    if (
      !ts.isPropertyAccessExpression(receiver) ||
      !ts.isIdentifier(receiver.expression) ||
      !contexts.has(receiver.expression.text)
    )
      return;
    if (method.name.text === 'transform')
      events.push({ event: `${receiver.name.text}.transform`, node });
    else if (
      method.name.text === 'hook' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      events.push({ event: `${receiver.name.text}.${node.arguments[0].text}`, node });
  });
  return events;
}

/** Build-time source inspection only; this module must not enter a shipped host runtime. */
export function discoverNativeHandlers(
  root: string,
  host: string,
  source: NativeHandlerSource,
): HostHandlerRegistration[] {
  const content = source.generate?.() ?? readFileSync(nodePath.join(root, source.source), 'utf8');
  if (source.format === 'command-manifest') {
    const manifest = JSON.parse(content) as {
      hooks: Parameters<typeof configuredCommandHandlers>[1];
    };
    return configuredCommandHandlers(host, manifest.hooks).map(handler => ({
      ...handler,
      handler_path: source.source,
      source_family: source.family,
    }));
  }
  const file = ts.createSourceFile(source.source, content, ts.ScriptTarget.Latest, true);
  const events = source.format === 'callback-object' ? callbackEvents(file) : sdkEvents(file);
  const digest = createHash('sha256').update(content).digest('hex');
  return events.map(({ event, node }) => ({
    host,
    event,
    handler_path: source.source,
    source_family: source.family,
    execution: 'native-callback',
    configuration: {
      source: source.source,
      source_sha256: digest,
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    },
  }));
}
