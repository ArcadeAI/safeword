import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import {
  type DataTable,
  type DocString as GherkinDocumentString,
  type Examples,
  type Feature,
  type FeatureChild,
  IdGenerator,
  type RuleChild,
  type Scenario,
  type Step,
  type TableRow,
  type Tag,
} from '@cucumber/messages';

import type { ParsedScenario } from './test-skeleton.js';

export interface ParsedFeatureScenario extends ParsedScenario {
  /** Effective tags after applying Feature/Rule/Scenario inheritance. */
  tags: string[];
}

export class FeatureParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureParseError';
  }
}

export interface GherkinLintIssue {
  line?: number;
  message: string;
  rule: string;
}

export function parseFeatureScenarios(featureContent: string): ParsedFeatureScenario[] {
  const document = parseFeature(featureContent);
  const feature = document.feature;
  if (feature === undefined) return [];

  const featureTags = feature.tags.map(tag => tag.name);
  const featureName = feature.name || 'Feature';
  return collectFeatureChildren(feature.children, featureName, featureTags);
}

export function parseFeatureAcReferences(featureContent: string): string[] {
  const references = new Set<string>();
  for (const scenario of parseFeatureScenarios(featureContent)) {
    for (const tag of scenario.tags) {
      const ref = parseAcReferenceFromTag(tag);
      if (ref !== undefined) references.add(ref);
    }
  }
  return [...references];
}

export function findGherkinLintIssues(
  featureContent: string,
  options: { filePath?: string } = {},
): GherkinLintIssue[] {
  const issues = findTextLintIssues(featureContent, options.filePath);
  if (featureContent.trim() === '') {
    return [...issues, issue('no-empty-file', 'Feature file is empty.')];
  }

  try {
    const document = parseFeature(featureContent);
    const feature = document.feature;
    if (feature === undefined) {
      return [...issues, issue('no-feature', 'Feature file has no Feature.')];
    }
    return [...issues, ...findDocumentLintIssues(feature)];
  } catch (error: unknown) {
    if (error instanceof FeatureParseError) {
      return [
        ...issues,
        issue('parse', `Invalid Gherkin syntax: ${error.message}`, parseErrorLine(error.message)),
      ];
    }
    throw error;
  }
}

export function findFeatureLineageIssues(featureContent: string): string[] {
  return parseFeatureScenarios(featureContent).flatMap(scenario => {
    const references = uniqueAcReferences(scenario.tags);
    if (references.length === 0) {
      return [`Scenario "${scenario.title}" is missing lineage; add exactly one @<jtbd>.AC# tag.`];
    }
    if (references.length > 1) {
      const tagList = references.map(reference => `@${reference}`).join(', ');
      return [
        `Scenario "${scenario.title}" has multiple lineage tags after inheritance (${tagList}); keep exactly one @<jtbd>.AC# tag.`,
      ];
    }
    return [];
  });
}

function parseFeature(featureContent: string) {
  const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
  try {
    return parser.parse(featureContent);
  } catch (error: unknown) {
    throw new FeatureParseError(formatParseError(error));
  }
}

function collectFeatureChildren(
  children: readonly FeatureChild[],
  featureName: string,
  inheritedTags: readonly string[],
): ParsedFeatureScenario[] {
  const scenarios: ParsedFeatureScenario[] = [];
  let featureBackgroundSteps: readonly Step[] = [];
  for (const child of children) {
    if (child.background) {
      featureBackgroundSteps = child.background.steps;
    }
    if (child.scenario) {
      scenarios.push(
        ...toParsedScenarios(child.scenario, featureName, inheritedTags, featureBackgroundSteps),
      );
    }
    if (child.rule) {
      const ruleTags = [...inheritedTags, ...child.rule.tags.map(tag => tag.name)];
      scenarios.push(
        ...collectRuleChildren(
          child.rule.children,
          child.rule.name,
          ruleTags,
          featureBackgroundSteps,
        ),
      );
    }
  }
  return scenarios;
}

function collectRuleChildren(
  children: readonly RuleChild[],
  ruleName: string,
  inheritedTags: readonly string[],
  featureBackgroundSteps: readonly Step[],
): ParsedFeatureScenario[] {
  const scenarios: ParsedFeatureScenario[] = [];
  let ruleBackgroundSteps: readonly Step[] = [];
  for (const child of children) {
    if (child.background) {
      ruleBackgroundSteps = child.background.steps;
    }
    if (child.scenario) {
      scenarios.push(
        ...toParsedScenarios(child.scenario, ruleName, inheritedTags, [
          ...featureBackgroundSteps,
          ...ruleBackgroundSteps,
        ]),
      );
    }
  }
  return scenarios;
}

function toParsedScenarios(
  scenario: Scenario,
  rule: string,
  inheritedTags: readonly string[],
  inheritedSteps: readonly Step[],
): ParsedFeatureScenario[] {
  if (scenario.examples.length === 0)
    return [toParsedScenario(scenario, rule, inheritedTags, inheritedSteps)];
  return scenario.examples.flatMap(example =>
    toParsedExampleScenarios(scenario, rule, inheritedTags, inheritedSteps, example),
  );
}

function toParsedScenario(
  scenario: Scenario,
  rule: string,
  inheritedTags: readonly string[],
  inheritedSteps: readonly Step[],
  row?: ExampleRow,
): ParsedFeatureScenario {
  const title = row === undefined ? scenario.name : exampleTitle(scenario.name, row);
  return {
    rule,
    title,
    steps: [...inheritedSteps, ...scenario.steps].flatMap(step => renderStep(step, row)),
    tags: [...inheritedTags, ...scenario.tags.map(tag => tag.name), ...(row?.tags ?? [])],
  };
}

interface ExampleRow {
  cells: Map<string, string>;
  summary: string;
  tags: string[];
}

function toParsedExampleScenarios(
  scenario: Scenario,
  rule: string,
  inheritedTags: readonly string[],
  inheritedSteps: readonly Step[],
  example: Examples,
): ParsedFeatureScenario[] {
  const headers = example.tableHeader?.cells.map(cell => cell.value) ?? [];
  return example.tableBody.map(row =>
    toParsedScenario(scenario, rule, inheritedTags, inheritedSteps, {
      cells: rowCells(headers, row),
      summary: rowSummary(headers, row),
      tags: example.tags.map(tag => tag.name),
    }),
  );
}

function renderStep(step: Step, row: ExampleRow | undefined): string[] {
  return [
    interpolate(`${step.keyword.trim()} ${step.text}`.trim(), row),
    ...renderStepArgument(step, row),
  ];
}

function renderStepArgument(step: Step, row: ExampleRow | undefined): string[] {
  if (step.dataTable) return renderDataTable(step.dataTable, row);
  if (step.docString) return renderDocumentString(step.docString, row);
  return [];
}

function renderDataTable(dataTable: DataTable, row: ExampleRow | undefined): string[] {
  return dataTable.rows.map(
    tableRow => `| ${tableRow.cells.map(cell => interpolate(cell.value, row)).join(' | ')} |`,
  );
}

function renderDocumentString(
  documentString: GherkinDocumentString,
  row: ExampleRow | undefined,
): string[] {
  const opener =
    documentString.mediaType === undefined
      ? documentString.delimiter
      : `${documentString.delimiter}${documentString.mediaType}`;
  return [
    opener,
    ...interpolate(documentString.content, row).split('\n'),
    documentString.delimiter,
  ];
}

function rowCells(headers: readonly string[], row: TableRow): Map<string, string> {
  return new Map(headers.map((header, index) => [header, row.cells[index]?.value ?? '']));
}

function rowSummary(headers: readonly string[], row: TableRow): string {
  return headers.map((header, index) => `${header}=${row.cells[index]?.value ?? ''}`).join(', ');
}

function exampleTitle(title: string, row: ExampleRow): string {
  const interpolated = interpolate(title, row);
  return row.summary === '' ? interpolated : `${interpolated} (${row.summary})`;
}

function interpolate(text: string, row: ExampleRow | undefined): string {
  if (row === undefined) return text;
  let interpolated = text;
  for (const [key, value] of row.cells) {
    interpolated = interpolated.split(`<${key}>`).join(value);
  }
  return interpolated;
}

function findTextLintIssues(content: string, filePath: string | undefined): GherkinLintIssue[] {
  const issues: GherkinLintIssue[] = [];
  if (filePath !== undefined) {
    const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
    if (!isKebabCaseFeatureFileName(fileName)) {
      issues.push(
        issue(
          'file-name',
          `Feature file name should be kebab-case, e.g. "${kebabFileName(fileName)}".`,
        ),
      );
    }
  }
  if (content !== '' && !content.endsWith('\n')) {
    issues.push(issue('new-line-at-eof', 'Feature file should end with a newline.'));
  }

  let previousBlank = false;
  for (const [index, line] of content.split('\n').entries()) {
    const lineNumber = index + 1;
    if (/[ \t]$/.test(line)) {
      issues.push(issue('no-trailing-spaces', 'Line has trailing whitespace.', lineNumber));
    }
    const blank = line.trim() === '';
    if (blank && previousBlank) {
      issues.push(
        issue('no-multiple-empty-lines', 'Avoid multiple consecutive blank lines.', lineNumber),
      );
    }
    previousBlank = blank;
  }
  return issues;
}

function findDocumentLintIssues(feature: Feature): GherkinLintIssue[] {
  const issues: GherkinLintIssue[] = [];
  if (feature.name.trim() === '') {
    issues.push(issue('no-unnamed-features', 'Feature must have a name.', feature.location.line));
  }
  issues.push(...findDuplicateTagIssues(feature.tags, 'Feature'));

  const scenarios: Scenario[] = [];
  for (const child of feature.children) {
    if (child.scenario) scenarios.push(child.scenario);
    if (child.rule) {
      issues.push(...findDuplicateTagIssues(child.rule.tags, `Rule "${child.rule.name}"`));
      for (const ruleChild of child.rule.children) {
        if (ruleChild.scenario) scenarios.push(ruleChild.scenario);
      }
    }
  }

  if (scenarios.length === 0) {
    issues.push(
      issue('no-files-without-scenarios', 'Feature file must contain at least one scenario.'),
    );
  }
  issues.push(...findScenarioLintIssues(scenarios));
  return issues;
}

function findScenarioLintIssues(scenarios: readonly Scenario[]): GherkinLintIssue[] {
  const issues: GherkinLintIssue[] = [];
  const firstLineByName = new Map<string, number>();
  for (const scenario of scenarios) {
    const name = scenario.name.trim();
    if (name === '') {
      issues.push(
        issue('no-unnamed-scenarios', 'Scenario must have a name.', scenario.location.line),
      );
    } else if (firstLineByName.has(name)) {
      issues.push(
        issue(
          'no-dupe-scenario-names',
          `Scenario name "${name}" is duplicated in this feature.`,
          scenario.location.line,
        ),
      );
    } else {
      firstLineByName.set(name, scenario.location.line);
    }

    if (scenario.keyword.toLowerCase().includes('outline') && scenario.examples.length === 0) {
      issues.push(
        issue(
          'no-scenario-outlines-without-examples',
          'Scenario Outline must include Examples.',
          scenario.location.line,
        ),
      );
    }
    issues.push(
      ...findScenarioOutlineVariableIssues(scenario),
      ...findDuplicateTagIssues(scenario.tags, `Scenario "${scenario.name}"`),
      ...scenario.examples.flatMap(example =>
        findDuplicateTagIssues(example.tags, `Examples "${example.name}"`),
      ),
    );
  }
  return issues;
}

function findScenarioOutlineVariableIssues(scenario: Scenario): GherkinLintIssue[] {
  if (!scenario.keyword.toLowerCase().includes('outline') || scenario.examples.length === 0) {
    return [];
  }

  const usedVariables = collectScenarioOutlineVariables(scenario);
  return scenario.examples.flatMap(example =>
    findExamplesVariableIssues(scenario, example, usedVariables),
  );
}

function findExamplesVariableIssues(
  scenario: Scenario,
  example: Examples,
  usedVariables: ReadonlySet<string>,
): GherkinLintIssue[] {
  const headers = example.tableHeader?.cells.map(cell => cell.value.trim()).filter(Boolean) ?? [];
  const headerSet = new Set(headers);
  const exampleName = example.name || 'Examples';

  const missing = [...usedVariables]
    .filter(variable => !headerSet.has(variable))
    .map(variable =>
      issue(
        'no-unused-variables',
        `Scenario Outline "${scenario.name}" uses <${variable}> but Examples "${exampleName}" has no "${variable}" column.`,
        example.location.line,
      ),
    );

  const unused = headers
    .filter(header => !usedVariables.has(header))
    .map(header =>
      issue(
        'no-unused-variables',
        `Examples "${exampleName}" defines <${header}> but Scenario Outline "${scenario.name}" never uses it.`,
        example.tableHeader?.location.line ?? example.location.line,
      ),
    );

  return [...missing, ...unused];
}

function collectScenarioOutlineVariables(scenario: Scenario): Set<string> {
  const variables = new Set<string>();
  collectPlaceholders(scenario.name, variables);
  collectPlaceholders(scenario.description, variables);
  for (const step of scenario.steps) {
    collectPlaceholders(step.text, variables);
    if (step.docString) collectPlaceholders(step.docString.content, variables);
    if (step.dataTable) {
      for (const row of step.dataTable.rows) {
        for (const cell of row.cells) {
          collectPlaceholders(cell.value, variables);
        }
      }
    }
  }
  return variables;
}

function collectPlaceholders(text: string, variables: Set<string>): void {
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '<') {
      start = index + 1;
    } else if (character === '>' && start !== -1) {
      const variable = text.slice(start, index).trim();
      if (variable) variables.add(variable);
      start = -1;
    }
  }
}

function findDuplicateTagIssues(tags: readonly Tag[], owner: string): GherkinLintIssue[] {
  const seen = new Set<string>();
  const issues: GherkinLintIssue[] = [];
  for (const tag of tags) {
    if (seen.has(tag.name)) {
      issues.push(
        issue('no-duplicate-tags', `${owner} has duplicate tag ${tag.name}.`, tag.location.line),
      );
    }
    seen.add(tag.name);
  }
  return issues;
}

function issue(rule: string, message: string, line?: number): GherkinLintIssue {
  return line === undefined ? { rule, message } : { rule, message, line };
}

function kebabFileName(fileName: string): string {
  const stem = fileName.endsWith('.feature') ? fileName.slice(0, -'.feature'.length) : fileName;
  return [
    stem
      .replaceAll('_', '-')
      .replaceAll(/[^a-zA-Z0-9]+/gu, '-')
      .replaceAll(/^-|-$/gu, '')
      .toLowerCase(),
    '.feature',
  ].join('');
}

function isKebabCaseFeatureFileName(fileName: string): boolean {
  if (!fileName.endsWith('.feature')) return false;
  const stem = fileName.slice(0, -'.feature'.length);
  if (stem === '') return false;
  return stem.split('-').every(segment => isLowercaseAlphaNumeric(segment));
}

function isLowercaseAlphaNumeric(segment: string): boolean {
  if (segment === '') return false;
  for (const character of segment) {
    const code = character.codePointAt(0);
    if (code === undefined) return false;
    const isDigit = code >= 48 && code <= 57;
    const isLowercaseLetter = code >= 97 && code <= 122;
    if (!isDigit && !isLowercaseLetter) return false;
  }
  return true;
}

function parseErrorLine(message: string): number | undefined {
  const match = /\((\d+):\d+\)/.exec(message);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function parseAcReferenceFromTag(tag: string): string | undefined {
  const match = /^@?(\S+?)\.AC(\d+)(?:\.|$)/.exec(tag.trim());
  if (!match) return undefined;
  return `${match[1] ?? ''}.AC${match[2] ?? ''}`;
}

function uniqueAcReferences(tags: readonly string[]): string[] {
  const references = new Set<string>();
  for (const tag of tags) {
    const ref = parseAcReferenceFromTag(tag);
    if (ref !== undefined) references.add(ref);
  }
  return [...references];
}

function formatParseError(error: unknown): string {
  if (error instanceof Error) return error.message.replaceAll('\n', ' ');
  return String(error);
}
