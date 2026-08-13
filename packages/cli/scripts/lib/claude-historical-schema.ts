import ts from 'typescript';

/** Spreads whose source modules are host/language surfaces and cannot own `.claude/**`. */
const NON_CLAUDE_OWNED_FILE_SPREADS = [
  'typescriptOwnedFiles',
  'pythonOwnedFiles',
  'golangOwnedFiles',
  'rustOwnedFiles',
  'sqlOwnedFiles',
  'CURSOR_SHARED_SKILL_OWNED_FILES',
  'CURSOR_RULE_WRAPPER_OWNED_FILES',
  'CURSOR_COMMAND_WRAPPER_OWNED_FILES',
] as const;

function staticPropertyName(name: ts.PropertyName, label: string): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`${label} contains a computed schema property.`);
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  expected: string,
  label: string,
): ts.PropertyAssignment | undefined {
  return object.properties.find(property => {
    if (ts.isSpreadAssignment(property)) return false;
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`${label} contains an unsupported schema member.`);
    }
    return staticPropertyName(property.name, label) === expected;
  }) as ts.PropertyAssignment | undefined;
}

function schemaObject(source: string, label: string): ts.ObjectLiteralExpression {
  const sourceFile = ts.createSourceFile(label, source, ts.ScriptTarget.Latest, true);
  let schema: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node): void => {
    const isSchema =
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'SAFEWORD_SCHEMA';
    if (
      isSchema &&
      node.initializer !== undefined &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      schema = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (schema === undefined) throw new Error(`${label} has no literal SAFEWORD_SCHEMA.`);
  return schema;
}

function assertSupportedSpread(
  property: ts.SpreadAssignment,
  label: string,
  allowedSpreads: ReadonlySet<string>,
): void {
  if (ts.isIdentifier(property.expression) && allowedSpreads.has(property.expression.text)) return;
  throw new Error(`${label} contains an unproven ownedFiles spread.`);
}

function claudeTemplateEntry(
  property: ts.ObjectLiteralElementLike,
  label: string,
  allowedSpreads: ReadonlySet<string>,
): readonly [string, string] | undefined {
  if (ts.isSpreadAssignment(property)) {
    assertSupportedSpread(property, label, allowedSpreads);
    return undefined;
  }
  if (!ts.isPropertyAssignment(property)) {
    throw new Error(`${label} contains an unsupported ownedFiles member.`);
  }
  const installedPath = staticPropertyName(property.name, label);
  if (!installedPath.startsWith('.claude/')) return undefined;
  if (!ts.isObjectLiteralExpression(property.initializer)) {
    throw new Error(`${label} has a non-literal definition for ${installedPath}.`);
  }
  const template = objectProperty(property.initializer, 'template', label)?.initializer;
  if (
    template === undefined ||
    (!ts.isStringLiteral(template) && !ts.isNoSubstitutionTemplateLiteral(template))
  ) {
    throw new Error(`${label} has no literal template for ${installedPath}.`);
  }
  return [installedPath, template.text];
}

/** Structurally extract every explicit project-scoped Claude template from SAFEWORD_SCHEMA. */
export function claudeTemplatePathsFromSchema(
  source: string,
  label: string,
  allowedNonClaudeSpreads: readonly string[] = NON_CLAUDE_OWNED_FILE_SPREADS,
): Record<string, string> {
  const schema = schemaObject(source, label);
  const ownedFiles = objectProperty(schema, 'ownedFiles', label)?.initializer;
  if (ownedFiles === undefined || !ts.isObjectLiteralExpression(ownedFiles)) {
    throw new Error(`${label} has no literal SAFEWORD_SCHEMA.ownedFiles object.`);
  }

  const allowedSpreads = new Set(allowedNonClaudeSpreads);
  return Object.fromEntries(
    ownedFiles.properties.flatMap(property => {
      const entry = claudeTemplateEntry(property, label, allowedSpreads);
      return entry === undefined ? [] : [entry];
    }),
  );
}
