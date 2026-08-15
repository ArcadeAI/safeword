import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { collectExecutableFeatureFiles } from '../src/utils/feature-source.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
function configuredFeatureFiles(): string[] {
  return collectExecutableFeatureFiles(REPO_ROOT).map(absolutePath =>
    nodePath.relative(REPO_ROOT, absolutePath).split(nodePath.sep).join('/'),
  );
}

type ScenarioProof = [string, string, string?];
type ScenarioProofRegistration = ScenarioProof | ScenarioProof[];

interface ScenarioProofManifest {
  feature: string;
  scenarios: Record<string, ScenarioProofRegistration>;
}

function proofManifestPaths(): string[] {
  const ticketsRoot = nodePath.join(REPO_ROOT, '.project', 'tickets');
  if (!existsSync(ticketsRoot)) return [];
  return readdirSync(ticketsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => nodePath.join('.project', 'tickets', entry.name, 'bdd-proof.json'))
    .filter(relativePath => existsSync(nodePath.join(REPO_ROOT, relativePath)))
    .toSorted((left, right) => left.localeCompare(right));
}

function readProofManifest(relativePath: string): ScenarioProofManifest {
  const manifest = JSON.parse(readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8')) as {
    feature?: unknown;
    scenarios?: unknown;
  };
  if (
    typeof manifest.feature !== 'string' ||
    manifest.scenarios === null ||
    typeof manifest.scenarios !== 'object'
  ) {
    throw new TypeError(`${relativePath} must declare a feature string and scenarios object`);
  }
  for (const [scenario, registration] of Object.entries(manifest.scenarios)) {
    const registrations =
      Array.isArray(registration) && typeof registration[0] === 'string'
        ? [registration]
        : registration;
    if (
      !Array.isArray(registrations) ||
      registrations.length === 0 ||
      registrations.some(
        proof =>
          !Array.isArray(proof) ||
          ![2, 3].includes(proof.length) ||
          proof.some(value => typeof value !== 'string'),
      )
    ) {
      throw new TypeError(`${relativePath}: ${scenario} has an invalid proof registration`);
    }
  }
  return manifest as ScenarioProofManifest;
}

function isCollectedVitestProofPath(proofPath: string): boolean {
  const normalized = nodePath.posix.normalize(proofPath);
  return (
    normalized === proofPath &&
    !normalized.startsWith('../') &&
    /^packages\/(?:cli|retro-relay)\/(?:src|tests)\/.+\.test\.ts$/u.test(proofPath) &&
    !/\.(?:live|release|slow)\.test\.ts$/u.test(proofPath)
  );
}

function registeredProofs(registration: ScenarioProofRegistration): ScenarioProof[] {
  return typeof registration[0] === 'string'
    ? [registration as ScenarioProof]
    : (registration as ScenarioProof[]);
}

function expressionTokens(expression: ts.Expression): string[] {
  const tokens: string[] = [];
  let current = expression;
  while (true) {
    if (ts.isIdentifier(current)) {
      tokens.unshift(current.text);
      return tokens;
    }
    if (ts.isPropertyAccessExpression(current)) {
      tokens.unshift(current.name.text);
      current = current.expression;
      continue;
    }
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    return tokens;
  }
}

function executableVitestNames(source: string): string[] {
  const sourceFile = ts.createSourceFile('proof.test.ts', source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  function hasSkippedSuiteAncestor(node: ts.Node): boolean {
    for (let ancestor = node.parent; ancestor !== undefined; ancestor = ancestor.parent) {
      if (!ts.isCallExpression(ancestor)) continue;
      const tokens = expressionTokens(ancestor.expression);
      const isSuite = ['describe', 'suite'].includes(tokens[0] ?? '');
      if (isSuite && tokens.some(token => ['skip', 'skipIf', 'todo'].includes(token))) return true;
    }
    return false;
  }

  function vitestCallName(call: ts.CallExpression): string | undefined {
    const tokens = expressionTokens(call.expression);
    const root = tokens[0];
    if (root !== 'it' && root !== 'test') return undefined;
    if (tokens.some(token => ['skip', 'skipIf', 'todo', 'only'].includes(token))) return undefined;
    return root;
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && node.arguments[0] !== undefined) {
      const testName = vitestCallName(node);
      const nameArgument = node.arguments[0];
      if (
        (testName === 'it' || testName === 'test') &&
        !hasSkippedSuiteAncestor(node) &&
        (ts.isStringLiteral(nameArgument) || ts.isNoSubstitutionTemplateLiteral(nameArgument))
      ) {
        names.push(nameArgument.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return names;
}

function focusedVitestDeclarations(source: string): string[] {
  const sourceFile = ts.createSourceFile('proof.test.ts', source, ts.ScriptTarget.Latest, true);
  const focused: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const tokens = expressionTokens(node.expression);
      if (
        ['it', 'test', 'describe', 'suite'].includes(tokens[0] ?? '') &&
        tokens.includes('only')
      ) {
        focused.push(tokens.join('.'));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return focused;
}

function parameterizedVitestCases(source: string): Map<string, string[]> {
  const sourceFile = ts.createSourceFile('proof.test.ts', source, ts.ScriptTarget.Latest, true);
  const casesByName = new Map<string, string[]>();

  function unwrap(node: ts.Expression): ts.Expression {
    let current = node;
    while (
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  }

  function literalValue(node: ts.Expression): string | undefined {
    const value = unwrap(node);
    if (
      ts.isStringLiteral(value) ||
      ts.isNoSubstitutionTemplateLiteral(value) ||
      ts.isNumericLiteral(value)
    ) {
      return value.text;
    }
    if (value.kind === ts.SyntaxKind.TrueKeyword) return 'true';
    if (value.kind === ts.SyntaxKind.FalseKeyword) return 'false';
    return undefined;
  }

  function tableCaseValues(node: ts.Expression, testName: string): string[] {
    const table = unwrap(node);
    if (!ts.isArrayLiteralExpression(table)) return [];
    const namedPlaceholder = /\$([A-Za-z_$][\w$]*)/u.exec(testName)?.[1];
    const positionalPlaceholderCount = testName.matchAll(/%[sdifjo]/gu).toArray().length;
    return table.elements.flatMap(rowNode => {
      const row = unwrap(rowNode);
      if (ts.isArrayLiteralExpression(row)) {
        const values = row.elements
          .slice(0, Math.max(1, positionalPlaceholderCount))
          .map(element => literalValue(element));
        return values.includes(undefined) ? [] : [values.join(' | ')];
      }
      if (ts.isObjectLiteralExpression(row) && namedPlaceholder !== undefined) {
        const property = row.properties.find(
          candidate =>
            ts.isPropertyAssignment(candidate) &&
            ((ts.isIdentifier(candidate.name) && candidate.name.text === namedPlaceholder) ||
              (ts.isStringLiteral(candidate.name) && candidate.name.text === namedPlaceholder)),
        );
        if (property !== undefined && ts.isPropertyAssignment(property)) {
          return [literalValue(property.initializer)].filter(Boolean);
        }
        return [];
      }
      return [literalValue(row)].filter(Boolean);
    }) as string[];
  }

  function parameterizedDeclaration(
    node: ts.Node,
  ): { name: string; table: ts.Expression } | undefined {
    if (!ts.isCallExpression(node) || !ts.isCallExpression(node.expression)) return undefined;
    const nameArgument = node.arguments[0];
    if (
      nameArgument === undefined ||
      (!ts.isStringLiteral(nameArgument) && !ts.isNoSubstitutionTemplateLiteral(nameArgument))
    ) {
      return undefined;
    }
    const eachCall = node.expression;
    const tokens = expressionTokens(eachCall.expression);
    const table = eachCall.arguments[0];
    return (tokens[0] === 'it' || tokens[0] === 'test') &&
      tokens.at(-1) === 'each' &&
      table !== undefined
      ? { name: nameArgument.text, table }
      : undefined;
  }

  function visit(node: ts.Node): void {
    const declaration = parameterizedDeclaration(node);
    if (declaration !== undefined) {
      const cases = tableCaseValues(declaration.table, declaration.name);
      if (cases.length > 0) casesByName.set(declaration.name, cases);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return casesByName;
}

function expectScenarioProofs(manifest: ScenarioProofManifest): void {
  expect(
    Object.keys(manifest.scenarios).toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(scenarioNames(manifest.feature).toSorted((left, right) => left.localeCompare(right)));

  const proofContracts = new Map<
    string,
    { executableNames: string[]; parameterCases: Map<string, string[]> }
  >();
  const registrationCounts = new Map<string, number>();
  function proofContract(proofPath: string) {
    const cached = proofContracts.get(proofPath);
    if (cached !== undefined) return cached;
    const proof = readFileSync(nodePath.join(REPO_ROOT, proofPath), 'utf8');
    expect(
      focusedVitestDeclarations(proof),
      `${proofPath} must not focus Vitest declarations`,
    ).toEqual([]);
    const contract = {
      executableNames: executableVitestNames(proof),
      parameterCases: parameterizedVitestCases(proof),
    };
    proofContracts.set(proofPath, contract);
    return contract;
  }
  for (const registration of Object.values(manifest.scenarios)) {
    for (const [proofPath, testName] of registeredProofs(registration)) {
      const key = `${proofPath}\0${testName}`;
      registrationCounts.set(key, (registrationCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [scenario, registration] of Object.entries(manifest.scenarios)) {
    const proofs = registeredProofs(registration);
    expect(proofs.length, `${scenario} must register at least one proof`).toBeGreaterThan(0);
    for (const proofRegistration of proofs) {
      expect(
        [2, 3],
        `${scenario} proof registrations must contain path, test name, and optional table case`,
      ).toContain(proofRegistration.length);
      const [proofPath, testName, selectedCase] = proofRegistration;
      expect(
        isCollectedVitestProofPath(proofPath),
        `${scenario} -> ${proofPath} must be a repo-contained collected Vitest test file`,
      ).toBe(true);
      expect(
        existsSync(nodePath.join(REPO_ROOT, proofPath)),
        `${scenario} -> ${proofPath} must exist`,
      ).toBe(true);
      const { executableNames, parameterCases } = proofContract(proofPath);
      const matches = executableNames.filter(executableName => executableName === testName);
      expect(matches, `${scenario} -> ${proofPath} must uniquely declare ${testName}`).toHaveLength(
        1,
      );
      const selectedParameterCases = parameterCases.get(testName);
      const registrationCount = registrationCounts.get(`${proofPath}\0${testName}`) ?? 0;
      if (selectedParameterCases !== undefined && registrationCount > 1) {
        expect(selectedCase, `${scenario} -> ${testName} must select one table case`).toBeDefined();
        expect(
          selectedParameterCases.filter(value => value === selectedCase),
          `${scenario} -> ${testName} must select one unique table row`,
        ).toHaveLength(1);
      }
    }
  }
}

function scenarioNames(featurePath: string): string[] {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  const feature = parser.parse(readFileSync(nodePath.join(REPO_ROOT, featurePath), 'utf8')).feature;
  if (feature === undefined) return [];
  return feature.children.flatMap(child => {
    if (child.scenario !== undefined) return [child.scenario.name];
    return (
      child.rule?.children.flatMap(ruleChild =>
        ruleChild.scenario === undefined ? [] : [ruleChild.scenario.name],
      ) ?? []
    );
  });
}

function featureHasTag(featurePath: string, tag: string): boolean {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  const feature = parser.parse(readFileSync(nodePath.join(REPO_ROOT, featurePath), 'utf8')).feature;
  if (feature === undefined) return false;
  const tags = [
    ...feature.tags,
    ...feature.children.flatMap(child => [
      ...(child.scenario?.tags ?? []),
      ...(child.rule?.tags ?? []),
      ...(child.rule?.children.flatMap(ruleChild => ruleChild.scenario?.tags ?? []) ?? []),
    ]),
  ];
  return tags.some(candidate => candidate.name === tag);
}

describe('BDD proof provenance', () => {
  it('keeps the proof manifest complete', () => {
    const taggedFeatures = configuredFeatureFiles()
      .filter(featurePath => featureHasTag(featurePath, '@proof.vitest'))
      .toSorted((left, right) => left.localeCompare(right));

    const manifestFeatures = proofManifestPaths()
      .map(manifestPath => readProofManifest(manifestPath).feature)
      .toSorted((left, right) => left.localeCompare(right));
    expect(manifestFeatures.length).toBeGreaterThan(0);
    expect(new Set(manifestFeatures).size).toBe(manifestFeatures.length);
    expect(taggedFeatures).toEqual(manifestFeatures);
  });

  it.each(proofManifestPaths())(
    '%s maps every scenario to a named executable proof',
    manifestPath => {
      const manifest = readProofManifest(manifestPath);
      expect(featureHasTag(manifest.feature, '@proof.vitest')).toBe(true);
      expect(featureHasTag(manifest.feature, '@wip')).toBe(false);
      expectScenarioProofs(manifest);
    },
  );

  it('accepts executable Vitest declarations but rejects comments and skipped lookalikes', () => {
    expect(executableVitestNames("it('real behavior', () => {});")).toContain('real behavior');
    expect(executableVitestNames("it.each([1, 2])('row %s', () => {});")).toContain('row %s');
    expect(executableVitestNames("// it('comment only', () => {});")).not.toContain('comment only');
    expect(executableVitestNames("it.skip('disabled behavior', () => {});")).not.toContain(
      'disabled behavior',
    );
    expect(executableVitestNames("it.skip.each([1])('disabled row %s', () => {});")).not.toContain(
      'disabled row %s',
    );
    expect(executableVitestNames("test.todo('unfinished behavior');")).not.toContain(
      'unfinished behavior',
    );
    expect(
      focusedVitestDeclarations("describe.only('focused', () => it('row', () => {}));"),
    ).toEqual(['describe.only']);
    expect(executableVitestNames("it.concurrent('parallel behavior', () => {});")).toContain(
      'parallel behavior',
    );
    expect(
      executableVitestNames(
        "describe.skip('disabled suite', () => it('nested behavior', () => {}));",
      ),
    ).not.toContain('nested behavior');
    expect(
      executableVitestNames(
        "describe.skip.each([1])('disabled suite %s', () => it('nested table behavior', () => {}));",
      ),
    ).not.toContain('nested table behavior');
    expect(
      executableVitestNames(
        "describe.skipIf(true)('disabled conditional suite', () => it('nested conditional behavior', () => {}));",
      ),
    ).not.toContain('nested conditional behavior');
  });

  it('extracts exact static cases from parameterized Vitest declarations', () => {
    const cases = parameterizedVitestCases(`
      it.each([['alpha', 'incidental'], ['beta', 'also incidental']])('primitive %s', () => {});
      test.each([{ state: 'ready' }, { state: 'blocked' }])('object $state', () => {});
    `);

    expect(cases.get('primitive %s')).toEqual(['alpha', 'beta']);
    expect(cases.get('object $state')).toEqual(['ready', 'blocked']);
  });

  it('accepts only repository-contained tests collected by the normal Vitest projects', () => {
    expect(isCollectedVitestProofPath('packages/cli/tests/example.test.ts')).toBe(true);
    expect(isCollectedVitestProofPath('../outside.test.ts')).toBe(false);
    expect(isCollectedVitestProofPath('packages/cli/tests/example.slow.test.ts')).toBe(false);
    expect(isCollectedVitestProofPath('packages/cli/tests/example.ts')).toBe(false);
  });
});
