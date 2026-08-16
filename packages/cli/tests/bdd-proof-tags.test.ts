import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { type GherkinDocument, IdGenerator } from '@cucumber/messages';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { configDefaults } from 'vitest/config';

import {
  DEFAULT_VITEST_PROJECTS,
  defaultVitestExclude,
  defaultVitestInclude,
} from '../../../vitest.default-projects.js';
import relayVitestConfig from '../../retro-relay/vitest.config.js';
import { collectExecutableFeatureFiles } from '../src/utils/feature-source.js';
import cliVitestConfig from '../vitest.config.js';

// This is a static provenance gate: it proves that every scenario names a
// normally collected executable test declaration. The normal Vitest lane is
// still responsible for executing those tests and proving their assertions pass.
// Environment-dependent runIf/skipIf declarations are intentionally ineligible:
// only literal always-enabled conditions can serve as portable proof.
// Scenario-outline registrations must cover at least the number of Examples rows;
// the manifest remains responsible for keeping those registrations in row order.
const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const configuredFeatureFiles = collectExecutableFeatureFiles(REPO_ROOT).map(absolutePath =>
  nodePath.relative(REPO_ROOT, absolutePath).split(nodePath.sep).join('/'),
);
function excludedPathSegments(patterns: readonly string[]): Set<string> {
  return new Set(
    patterns.flatMap(pattern => {
      const segment = /^\*\*\/([^*{}]+)\/\*\*$/u.exec(pattern)?.[1];
      if (segment !== undefined) return [segment];
      const group = /^\*\*\/\.\{([^}]+)\}\/\*\*$/u.exec(pattern)?.[1];
      if (group !== undefined) return group.split(',').map(value => `.${value}`);
      throw new TypeError(
        `Vitest configDefaults.exclude contains an unsupported pattern after a dependency change: ${pattern}`,
      );
    }),
  );
}

const defaultExcludedPathSegments = excludedPathSegments(configDefaults.exclude);

type ScenarioProof = [string, string, string?];
type ScenarioProofRegistration = ScenarioProof | ScenarioProof[];

interface ScenarioProofManifest {
  feature: string;
  scenarios: Record<string, ScenarioProofRegistration>;
}

function isProofRegistration(value: unknown): value is ScenarioProof {
  return (
    Array.isArray(value) &&
    [2, 3].includes(value.length) &&
    value.every(entry => typeof entry === 'string')
  );
}

function hasManifestShape(value: unknown): value is ScenarioProofManifest {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as { feature?: unknown; scenarios?: unknown };
  return (
    typeof candidate.feature === 'string' &&
    candidate.scenarios !== null &&
    typeof candidate.scenarios === 'object'
  );
}

function proofRegistrations(value: unknown): ScenarioProof[] | undefined {
  const registrations = Array.isArray(value) && typeof value[0] === 'string' ? [value] : value;
  return Array.isArray(registrations) &&
    registrations.length > 0 &&
    registrations.every(isProofRegistration)
    ? registrations
    : undefined;
}

function proofManifestPaths(): string[] {
  return configuredFeatureFiles
    .map(featurePath => featurePath.replace(/\.feature$/u, '.bdd-proof.json'))
    .filter(relativePath => existsSync(nodePath.join(REPO_ROOT, relativePath)))
    .toSorted((left, right) => left.localeCompare(right));
}

function onDiskProofManifestPaths(): string[] {
  return ['features', 'packages/cli/features']
    .flatMap(directory =>
      readdirSync(nodePath.join(REPO_ROOT, directory))
        .filter(entry => entry.endsWith('.bdd-proof.json'))
        .map(entry => `${directory}/${entry}`),
    )
    .toSorted((left, right) => left.localeCompare(right));
}

function readProofManifest(relativePath: string): ScenarioProofManifest {
  const manifest: unknown = JSON.parse(
    readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8'),
  );
  if (!hasManifestShape(manifest)) {
    throw new TypeError(`${relativePath} must declare a feature string and scenarios object`);
  }
  if (!isRepoFeaturePath(manifest.feature)) {
    throw new TypeError(`${relativePath}: ${manifest.feature} must be a collected feature`);
  }
  for (const [scenario, registration] of Object.entries(manifest.scenarios)) {
    const registrations = proofRegistrations(registration);
    if (registrations === undefined) {
      throw new TypeError(`${relativePath}: ${scenario} has an invalid proof registration`);
    }
    const proofKeys = registrations.map(proof => JSON.stringify(proof));
    if (new Set(proofKeys).size !== proofKeys.length) {
      throw new TypeError(`${relativePath}: ${scenario} repeats a proof registration`);
    }
  }
  return manifest;
}

function isCollectedVitestProofPath(proofPath: string): boolean {
  const normalized = nodePath.posix.normalize(proofPath);
  if (normalized !== proofPath || normalized.startsWith('../')) return false;
  const pathSegments = new Set(proofPath.split('/'));
  if ([...defaultExcludedPathSegments].some(segment => pathSegments.has(segment))) return false;
  return DEFAULT_VITEST_PROJECTS.some(project => {
    const prefix = `${project.root}/`;
    if (!proofPath.startsWith(prefix)) return false;
    const relativePath = proofPath.slice(prefix.length);
    return (
      project.sourceDirectories.some(directory => relativePath.startsWith(`${directory}/`)) &&
      relativePath.endsWith('.test.ts') &&
      project.excludedSuffixes.every(suffix => !relativePath.endsWith(`.${suffix}.test.ts`))
    );
  });
}

function isRepoFeaturePath(featurePath: string): boolean {
  const normalized = nodePath.posix.normalize(featurePath);
  return (
    normalized === featurePath &&
    !normalized.startsWith('../') &&
    normalized.endsWith('.feature') &&
    configuredFeatureFiles.includes(normalized)
  );
}

function registeredProofs(registration: ScenarioProofRegistration): ScenarioProof[] {
  const registrations = proofRegistrations(registration);
  if (registrations === undefined) throw new TypeError('invalid proof registration');
  return registrations;
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
    if (
      ts.isElementAccessExpression(current) &&
      current.argumentExpression !== undefined &&
      ts.isStringLiteral(current.argumentExpression)
    ) {
      tokens.unshift(current.argumentExpression.text);
      current = current.expression;
      continue;
    }
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isTaggedTemplateExpression(current)) {
      current = current.tag;
      continue;
    }
    return tokens;
  }
}

function staticCallName(node: ts.CallExpression): string | undefined {
  const nameArgument = node.arguments[0];
  return nameArgument !== undefined &&
    (ts.isStringLiteral(nameArgument) || ts.isNoSubstitutionTemplateLiteral(nameArgument))
    ? nameArgument.text
    : undefined;
}

function isParameterizedTestTokens(tokens: string[]): boolean {
  return ['it', 'test'].includes(tokens[0] ?? '') && ['each', 'for'].includes(tokens.at(-1) ?? '');
}

function conditionAllows(call: ts.CallExpression, token: 'runIf' | 'skipIf'): boolean {
  let current: ts.Expression = call.expression;
  while (true) {
    if (ts.isCallExpression(current)) {
      // eslint-disable-next-line security/detect-possible-timing-attacks -- AST modifier names are public source text, not secrets.
      if (expressionTokens(current.expression).at(-1) === token) {
        const condition = current.arguments[0]?.kind;
        return (
          condition === (token === 'runIf' ? ts.SyntaxKind.TrueKeyword : ts.SyntaxKind.FalseKeyword)
        );
      }
      current = current.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    return false;
  }
}

function executableVitestNames(source: string): string[] {
  const sourceFile = ts.createSourceFile('proof.test.ts', source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  function hasExecutableTestBody(call: ts.CallExpression): boolean {
    const body = call.arguments
      .slice(1)
      .findLast(
        (argument): argument is ts.ArrowFunction | ts.FunctionExpression =>
          ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
      );
    if (body === undefined) return false;
    return !ts.isBlock(body.body) || body.body.statements.length > 0;
  }

  function hasSkippedSuiteAncestor(node: ts.Node): boolean {
    for (let ancestor = node.parent; ancestor !== undefined; ancestor = ancestor.parent) {
      if (!ts.isCallExpression(ancestor)) continue;
      const tokens = expressionTokens(ancestor.expression);
      const isSuite = ['describe', 'suite'].includes(tokens[0] ?? '');
      if (
        isSuite &&
        (tokens.some(token => ['skip', 'todo'].includes(token)) ||
          (tokens.includes('runIf') && !conditionAllows(ancestor, 'runIf')) ||
          (tokens.includes('skipIf') && !conditionAllows(ancestor, 'skipIf')))
      ) {
        return true;
      }
    }
    return false;
  }

  function vitestCallName(call: ts.CallExpression): string | undefined {
    const tokens = expressionTokens(call.expression);
    const root = tokens[0];
    if (root !== 'it' && root !== 'test') return undefined;
    if (tokens.some(token => ['skip', 'todo', 'only'].includes(token))) {
      return undefined;
    }
    if (tokens.includes('runIf') && !conditionAllows(call, 'runIf')) return undefined;
    if (tokens.includes('skipIf') && !conditionAllows(call, 'skipIf')) return undefined;
    return root;
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const testName = staticCallName(node);
      if (
        vitestCallName(node) !== undefined &&
        !hasSkippedSuiteAncestor(node) &&
        testName !== undefined &&
        hasExecutableTestBody(node)
      ) {
        names.push(testName);
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

type ParameterizedCases = { cases: string[]; staticallyEnumerable: boolean };

function parameterizedVitestCases(source: string): Map<string, ParameterizedCases> {
  const sourceFile = ts.createSourceFile('proof.test.ts', source, ts.ScriptTarget.Latest, true);
  const casesByName = new Map<string, ParameterizedCases>();

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

  // eslint-disable-next-line complexity -- every branch is one supported TypeScript literal form.
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
    if (value.kind === ts.SyntaxKind.NullKeyword) return 'null';
    if (ts.isIdentifier(value) && value.text === 'undefined') return 'undefined';
    if (
      ts.isPrefixUnaryExpression(value) &&
      value.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(value.operand)
    ) {
      return `-${value.operand.text}`;
    }
    return undefined;
  }

  // Manifest selectors use literal placeholder values: one value is bare and
  // multiple values are a JSON array. Positional rows follow placeholder order;
  // named rows follow the `$name` order in the Vitest title. A positional table
  // with no placeholder intentionally uses its first column as the case key.
  function tableCaseValues(
    node: ts.Expression,
    testName: string,
  ): { cases: string[]; complete: boolean } {
    const table = unwrap(node);
    if (!ts.isArrayLiteralExpression(table)) return { cases: [], complete: false };
    const namedPlaceholders = testName
      .matchAll(/\$([A-Za-z_$][\w$]*)/gu)
      .map(match => match[1])
      .toArray();
    const positionalPlaceholderCount = testName
      .replaceAll('%%', '')
      .matchAll(/%[sdifjop#$]/gu)
      .toArray().length;
    const cases = table.elements.flatMap(rowNode => {
      const row = unwrap(rowNode);
      if (ts.isArrayLiteralExpression(row)) {
        const values = row.elements
          .slice(0, Math.max(1, positionalPlaceholderCount))
          .map(element => literalValue(element));
        const stringValues = values.filter((value): value is string => value !== undefined);
        if (stringValues.length !== values.length) return [];
        return [stringValues.length === 1 ? stringValues.join('') : JSON.stringify(stringValues)];
      }
      if (ts.isObjectLiteralExpression(row) && namedPlaceholders.length > 0) {
        const values = namedPlaceholders.map(placeholder => {
          const property = row.properties.find(
            candidate =>
              ts.isPropertyAssignment(candidate) &&
              ((ts.isIdentifier(candidate.name) && candidate.name.text === placeholder) ||
                (ts.isStringLiteral(candidate.name) && candidate.name.text === placeholder)),
          );
          return property !== undefined && ts.isPropertyAssignment(property)
            ? literalValue(property.initializer)
            : undefined;
        });
        if (!values.every((value): value is string => value !== undefined)) return [];
        return [values.length === 1 ? values.join('') : JSON.stringify(values)];
      }
      const primitive = literalValue(row);
      return primitive === undefined ? [] : [primitive];
    });
    return { cases, complete: cases.length === table.elements.length };
  }

  function hasDisabledDeclaration(node: ts.Node): boolean {
    for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
      if (!ts.isCallExpression(current)) continue;
      const tokens = expressionTokens(current.expression);
      const declaration = ['it', 'test', 'describe', 'suite'].includes(tokens[0] ?? '');
      const conditionDisables =
        (tokens.includes('runIf') && !conditionAllows(current, 'runIf')) ||
        (tokens.includes('skipIf') && !conditionAllows(current, 'skipIf'));
      if (
        declaration &&
        (tokens.some(token => ['skip', 'todo', 'only'].includes(token)) || conditionDisables)
      ) {
        return true;
      }
    }
    return false;
  }

  function parameterizedDeclaration(
    node: ts.Node,
  ): { name: string; table?: ts.Expression } | undefined {
    if (!ts.isCallExpression(node)) return undefined;
    const staticName = staticCallName(node);
    if (staticName === undefined) return undefined;
    if (ts.isCallExpression(node.expression)) {
      const tableCall = node.expression;
      const tokens = expressionTokens(tableCall.expression);
      const table = tableCall.arguments[0];
      return isParameterizedTestTokens(tokens) ? { name: staticName, table } : undefined;
    }
    if (ts.isTaggedTemplateExpression(node.expression)) {
      const tokens = expressionTokens(node.expression.tag);
      return isParameterizedTestTokens(tokens) && tokens.at(-1) === 'each'
        ? { name: staticName }
        : undefined;
    }
    return undefined;
  }

  function visit(node: ts.Node): void {
    const declaration = parameterizedDeclaration(node);
    if (declaration !== undefined && !hasDisabledDeclaration(node)) {
      const tableCases =
        declaration.table === undefined
          ? { cases: [], complete: false }
          : tableCaseValues(declaration.table, declaration.name);
      const next = {
        cases: tableCases.cases,
        staticallyEnumerable: tableCases.complete && tableCases.cases.length > 0,
      };
      casesByName.set(
        declaration.name,
        casesByName.has(declaration.name) ? { cases: [], staticallyEnumerable: false } : next,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return casesByName;
}

function expectScenarioProofs(manifest: ScenarioProofManifest): void {
  expect(
    isRepoFeaturePath(manifest.feature),
    `${manifest.feature} must be a collected feature`,
  ).toBe(true);
  expect(
    Object.keys(manifest.scenarios).toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(scenarioNames(manifest.feature).toSorted((left, right) => left.localeCompare(right)));

  const proofContracts = new Map<
    string,
    { executableNames: string[]; parameterCases: Map<string, ParameterizedCases> }
  >();
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
  function proofCoverageUnits(scenario: string, proofRegistration: ScenarioProof): number {
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
    expect(
      matches,
      `${scenario} -> ${proofPath} must declare exactly one executable test named ${testName}; duplicate names must be made unique in the source`,
    ).toHaveLength(1);
    const parameterized = parameterCases.get(testName);
    if (parameterized === undefined) {
      expect(
        selectedCase,
        `${scenario} -> ${testName} selects a case but is not a recognized static table`,
      ).toBeUndefined();
      return 1;
    }

    expect(
      parameterized.staticallyEnumerable,
      `${scenario} -> ${testName} must use a statically enumerable table`,
    ).toBe(true);
    if (selectedCase === undefined) return parameterized.cases.length;

    expect(selectedCase, `${scenario} -> ${testName} must select one table case`).toBeDefined();
    expect(
      parameterized.cases.filter(value => value === selectedCase),
      `${scenario} -> ${testName} must select one unique table row`,
    ).toHaveLength(1);
    return 1;
  }
  const examplesByScenario = scenarioExampleCounts(manifest.feature);
  for (const [scenario, registration] of Object.entries(manifest.scenarios)) {
    const proofs = registeredProofs(registration);
    const outlineCoverageUnits = proofs.reduce(
      (total, proofRegistration) => total + proofCoverageUnits(scenario, proofRegistration),
      0,
    );
    const exampleCount = examplesByScenario.get(scenario) ?? 0;
    expect(
      exampleCount === 0 || outlineCoverageUnits >= exampleCount,
      `${scenario} must register at least ${exampleCount} executable proof units for its ${exampleCount} outline examples`,
    ).toBe(true);
  }
}

const parsedFeatures = new Map<string, GherkinDocument>();

function parseFeature(featurePath: string): GherkinDocument {
  const cached = parsedFeatures.get(featurePath);
  if (cached !== undefined) return cached;
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  const document = parser.parse(readFileSync(nodePath.join(REPO_ROOT, featurePath), 'utf8'));
  parsedFeatures.set(featurePath, document);
  return document;
}

function scenarioNames(featurePath: string): string[] {
  return scenarioExampleCounts(featurePath).keys().toArray();
}

function scenarioExampleCounts(featurePath: string): Map<string, number> {
  const feature = parseFeature(featurePath).feature;
  const counts = new Map<string, number>();
  if (feature === undefined) return counts;
  const scenarios = feature.children.flatMap(child =>
    child.scenario === undefined
      ? (child.rule?.children.flatMap(ruleChild =>
          ruleChild.scenario === undefined ? [] : [ruleChild.scenario],
        ) ?? [])
      : [child.scenario],
  );
  for (const scenario of scenarios) {
    if (counts.has(scenario.name)) {
      throw new TypeError(`${featurePath} repeats scenario name: ${scenario.name}`);
    }
    counts.set(
      scenario.name,
      scenario.examples.reduce((total, examples) => total + examples.tableBody.length, 0),
    );
  }
  return counts;
}

function featureHasTag(featurePath: string, tag: string): boolean {
  const feature = parseFeature(featurePath).feature;
  if (feature === undefined) return false;
  return feature.tags.some(candidate => candidate.name === tag);
}

function nestedFeatureTags(featurePath: string, tag: string): string[] {
  const feature = parseFeature(featurePath).feature;
  if (feature === undefined) return [];
  return feature.children.flatMap(child => {
    const scenario = child.scenario;
    const rule = child.rule;
    return [
      ...(scenario?.tags.some(candidate => candidate.name === tag) === true ? [scenario.name] : []),
      ...(rule?.tags.some(candidate => candidate.name === tag) === true ? [rule.name] : []),
      ...(rule?.children.flatMap(ruleChild => {
        const ruleScenario = ruleChild.scenario;
        return ruleScenario?.tags.some(candidate => candidate.name === tag) === true
          ? [ruleScenario.name]
          : [];
      }) ?? []),
    ];
  });
}

function featureOrNestedHasTag(featurePath: string, tag: string): boolean {
  return featureHasTag(featurePath, tag) || nestedFeatureTags(featurePath, tag).length > 0;
}

describe('BDD proof provenance', () => {
  it('rejects null and incomplete proof manifest shapes', () => {
    // eslint-disable-next-line unicorn/no-null -- JSON manifests can contain null.
    expect(hasManifestShape(null)).toBe(false);
    expect(hasManifestShape({ feature: 'features/example.feature' })).toBe(false);
    expect(proofRegistrations([])).toBeUndefined();
  });

  it('keeps the proof manifest complete', () => {
    const nestedProofTags = configuredFeatureFiles.flatMap(featurePath =>
      nestedFeatureTags(featurePath, '@proof.vitest').map(name => ({ featurePath, name })),
    );
    expect(
      nestedProofTags,
      '@proof.vitest is a feature-level lane; scenario and Rule tags are ambiguous',
    ).toEqual([]);
    const taggedFeatures = configuredFeatureFiles
      .filter(featurePath => featureHasTag(featurePath, '@proof.vitest'))
      .toSorted((left, right) => left.localeCompare(right));

    const manifestFeatures = proofManifestPaths()
      .map(manifestPath => readProofManifest(manifestPath).feature)
      .toSorted((left, right) => left.localeCompare(right));
    expect(manifestFeatures.length).toBeGreaterThan(0);
    expect(new Set(manifestFeatures).size).toBe(manifestFeatures.length);
    expect(taggedFeatures).toEqual(manifestFeatures);
    expect(onDiskProofManifestPaths()).toEqual(proofManifestPaths());
  });

  it('keeps shared proof fan-in within the reviewed baseline', () => {
    // Baseline measured after migrating the four legacy @manual Vitest-backed
    // features: 39 reused tuples and a maximum fan-in of four. These are
    // ratchets—lower them as proofs become scenario-specific; do not raise them
    // to accommodate new sharing.
    let sharedProofs = 0;
    let maximumFanIn = 0;
    for (const manifestPath of proofManifestPaths()) {
      const registrations = new Map<string, number>();
      for (const registration of Object.values(readProofManifest(manifestPath).scenarios)) {
        for (const proof of registeredProofs(registration)) {
          const key = JSON.stringify(proof);
          registrations.set(key, (registrations.get(key) ?? 0) + 1);
        }
      }
      for (const fanIn of registrations.values()) {
        if (fanIn > 1) sharedProofs += 1;
        maximumFanIn = Math.max(maximumFanIn, fanIn);
      }
    }

    expect(sharedProofs).toBeLessThanOrEqual(39);
    expect(maximumFanIn).toBeLessThanOrEqual(4);
  });

  it.each(proofManifestPaths())(
    '%s maps every scenario to a named executable proof',
    manifestPath => {
      const manifest = readProofManifest(manifestPath);
      expect(featureHasTag(manifest.feature, '@proof.vitest')).toBe(true);
      expect(
        featureOrNestedHasTag(manifest.feature, '@wip'),
        `${manifest.feature} cannot combine @proof.vitest with @wip at feature, rule, or scenario scope`,
      ).toBe(false);
      expectScenarioProofs(manifest);
    },
  );

  it('accepts executable Vitest declarations but rejects comments and skipped lookalikes', () => {
    expect(executableVitestNames("it('real behavior', () => { verify(); });")).toContain(
      'real behavior',
    );
    expect(executableVitestNames("it.each([1, 2])('row %s', () => { verify(); });")).toContain(
      'row %s',
    );
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
    expect(
      executableVitestNames("it.concurrent('parallel behavior', () => { verify(); });"),
    ).toContain('parallel behavior');
    expect(focusedVitestDeclarations("it['only']('focused', () => {});")).toEqual(['it.only']);
    expect(executableVitestNames("it.runIf(false)('conditional', () => {});")).not.toContain(
      'conditional',
    );
    expect(
      executableVitestNames("it.runIf(true)('running conditional', () => { verify(); });"),
    ).toContain('running conditional');
    expect(
      executableVitestNames("it.skipIf(false)('running skip conditional', () => { verify(); });"),
    ).toContain('running skip conditional');
    expect(
      executableVitestNames("it.runIf(true).each([1])('running chained %s', () => { verify(); });"),
    ).toContain('running chained %s');
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
    expect(executableVitestNames("it('missing body');")).not.toContain('missing body');
    expect(executableVitestNames("it('empty body', () => {});")).not.toContain('empty body');
    expect(executableVitestNames("it('options overload', { timeout: 1 }, () => true);")).toContain(
      'options overload',
    );
  });

  it('extracts exact static cases from parameterized Vitest declarations', () => {
    const cases = parameterizedVitestCases(`
      it.each([['alpha', 'incidental'], ['beta', 'also incidental']])('primitive %s', () => {});
      test.each([{ state: 'ready' }, { state: 'blocked' }])('object $state', () => {});
      test.each([{ state: 'ready', result: 'go' }])('multi $state $result', () => {});
      it.each([[-1, null, undefined]])('extended %p %$ %s', () => {});
      it.runIf(true).each(['enabled'])('conditional %s', () => {});
    `);

    expect(cases.get('primitive %s')).toEqual({
      cases: ['alpha', 'beta'],
      staticallyEnumerable: true,
    });
    expect(cases.get('object $state')).toEqual({
      cases: ['ready', 'blocked'],
      staticallyEnumerable: true,
    });
    expect(cases.get('multi $state $result')).toEqual({
      cases: ['["ready","go"]'],
      staticallyEnumerable: true,
    });
    expect(cases.get('extended %p %$ %s')).toEqual({
      cases: ['["-1","null","undefined"]'],
      staticallyEnumerable: true,
    });
    expect(cases.get('conditional %s')).toEqual({
      cases: ['enabled'],
      staticallyEnumerable: true,
    });
    expect(
      parameterizedVitestCases("it.each(TABLE)('dynamic %s', () => {});").get('dynamic %s'),
    ).toEqual({ cases: [], staticallyEnumerable: false });
    expect(
      parameterizedVitestCases("it.for(['alpha'])('for %s', () => {});").get('for %s'),
    ).toEqual({ cases: ['alpha'], staticallyEnumerable: true });
    expect(
      parameterizedVitestCases("it.each`value\nalpha`('tagged $value', () => {});").get(
        'tagged $value',
      ),
    ).toEqual({ cases: [], staticallyEnumerable: false });
    expect(
      parameterizedVitestCases("it.each(['literal', dynamic])('mixed %s', () => {});").get(
        'mixed %s',
      ),
    ).toEqual({ cases: ['literal'], staticallyEnumerable: false });
    expect(
      parameterizedVitestCases("it.skip.each(['disabled'])('disabled %s', () => {});").get(
        'disabled %s',
      ),
    ).toBeUndefined();
    expect(
      parameterizedVitestCases(`
        it.each(['first'])('duplicate %s', () => {});
        it.each(['second'])('duplicate %s', () => {});
      `).get('duplicate %s'),
    ).toEqual({ cases: [], staticallyEnumerable: false });
  });

  it('accepts only repository-contained tests collected by the normal Vitest projects', () => {
    expect(isCollectedVitestProofPath('packages/cli/tests/example.test.ts')).toBe(true);
    expect(isCollectedVitestProofPath('../outside.test.ts')).toBe(false);
    expect(isCollectedVitestProofPath('packages/cli/tests/example.slow.test.ts')).toBe(false);
    expect(isCollectedVitestProofPath('packages/cli/tests/example.ts')).toBe(false);
    expect(isCollectedVitestProofPath('packages/cli/src/example.slow.test.ts')).toBe(false);
    expect(isCollectedVitestProofPath('packages/cli/node_modules/example.test.ts')).toBe(false);
    expect(isCollectedVitestProofPath('packages/cli/.git/example.test.ts')).toBe(false);
    expect(excludedPathSegments(['**/.{idea,git,cache,output,temp}/**'])).toEqual(
      new Set(['.idea', '.git', '.cache', '.output', '.temp']),
    );
  });

  it('uses the same include and exclude rules as the shipped Vitest configs', () => {
    expect(cliVitestConfig.test?.include).toEqual(defaultVitestInclude('packages/cli'));
    expect(cliVitestConfig.test?.exclude).toEqual([
      ...configDefaults.exclude,
      ...defaultVitestExclude('packages/cli'),
    ]);
    expect(relayVitestConfig.test?.include).toEqual(defaultVitestInclude('packages/retro-relay'));
    expect(relayVitestConfig.test?.exclude).toEqual([
      ...configDefaults.exclude,
      ...defaultVitestExclude('packages/retro-relay'),
    ]);
  });

  it('enumerates every workspace Vitest project in the shared collection contract', () => {
    const workspaceProjects = readdirSync(nodePath.join(REPO_ROOT, 'packages'), {
      withFileTypes: true,
    })
      .filter(entry => entry.isDirectory())
      .map(entry => `packages/${entry.name}`)
      .filter(root => existsSync(nodePath.join(REPO_ROOT, root, 'vitest.config.ts')))
      .toSorted((left, right) => left.localeCompare(right));
    expect(
      DEFAULT_VITEST_PROJECTS.map(project => project.root).toSorted((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual(workspaceProjects);
  });
});
