import { createHash } from 'node:crypto';

import ts from 'typescript';

import type { IsolatedGraderBinding } from '../../src/review/isolated-grader.js';

/** Trusted compiler output only, never native/model input. Normalize exactly
 * one bound JSON literal; every other byte remains part of calibration identity.
 */
export function isolatedBuildIdentity(bundle: string, binding: IsolatedGraderBinding): string {
  const source = ts.createSourceFile(
    'bundle.js',
    bundle,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const matches: ts.StringLiteral[] = [];
  const encoded = JSON.stringify(binding);
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && node.text === encoded) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  const literal = matches[0];
  if (matches.length !== 1 || literal === undefined)
    throw new Error('Isolated build requires one unique binding literal');
  const parent = literal.parent;
  if (
    !ts.isCallExpression(parent) ||
    parent.arguments.length !== 1 ||
    !ts.isPropertyAccessExpression(parent.expression) ||
    !ts.isIdentifier(parent.expression.expression) ||
    parent.expression.expression.text !== 'JSON' ||
    parent.expression.name.text !== 'parse'
  )
    throw new Error('Isolated binding must be the compiler-emitted JSON.parse argument');
  const normalized = `${bundle.slice(
    0,
    literal.getStart(source),
  )}"SAFEWORD_OWNED_GRADER_BINDING_V1"${bundle.slice(literal.end)}`;
  return createHash('sha256').update(normalized).digest('hex');
}
