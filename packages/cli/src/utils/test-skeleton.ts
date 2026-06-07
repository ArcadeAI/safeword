/**
 * `safeword codify` emitter (ticket CS86B0).
 *
 * Pure, no I/O: parse a `test-definitions.md` (the `## Rule:` / `### Scenario:
 * <lineage>` / Given-When-Then / R-G-R-checkbox format) into scenarios, then
 * render a native vitest `*.test.ts` skeleton — one `describe` per rule, one
 * pending or throwing test per scenario, Given/When/Then preserved as comments.
 * The command (`commands/codify.ts`) owns reading the file and writing output.
 *
 * Reuses `computeSkipMask` (markdown-sections.js) for the fence/comment skip.
 * `parseHeading` is kept local: scenario-coverage.ts is the only other ATX
 * heading parser, so per the repo's Rule-of-Three (see markdown-sections.ts) it
 * stays un-extracted until a third consumer appears.
 *
 * Every dynamic name (describe + test title) is embedded via JSON.stringify, so
 * any rule heading or scenario title — backticks, quotes, parens — yields a
 * valid string literal and the emitted module always parses.
 */

import { computeSkipMask } from './markdown-sections.js';

const RULE_PREFIX = 'Rule:';
const SCENARIO_PREFIX = 'Scenario:';

export interface EmitOptions {
  /** Emit throwing `it(...)` bodies (a true-RED board) instead of pending stubs. */
  red?: boolean;
  /** Ticket id woven into the header comment for provenance. */
  source?: string;
}

export interface ParsedScenario {
  /** The enclosing rule's heading text, `Rule:` prefix removed. */
  rule: string;
  /** The scenario title — full lineage, or free text. */
  title: string;
  /** Given/When/Then/And lines verbatim, rendered as `//` comments. */
  steps: string[];
}

type Heading =
  | { kind: 'rule'; name: string }
  | { kind: 'scenario'; title: string }
  | { kind: 'other' };

/**
 * Parse a test-definitions.md into its scenarios. A scenario counts only inside
 * a `## Rule:` section; any other heading (e.g. `## Invariants`, the trailing
 * cross-scenario-refactor block) closes the rule, so its content emits nothing.
 * Steps are the non-blank lines between a scenario title and its first `- [ ]`
 * checkbox.
 */
export function parseScenarios(testDefinitionsContent: string): ParsedScenario[] {
  const lines = testDefinitionsContent.split('\n');
  const skip = computeSkipMask(lines);
  const scenarios: ParsedScenario[] = [];
  let currentRule: string | undefined;
  let current: ParsedScenario | undefined;
  let collectingSteps = false;

  const flush = (): void => {
    if (current !== undefined) scenarios.push(current);
    current = undefined;
    collectingSteps = false;
  };

  for (const [index, line] of lines.entries()) {
    if (skip[index]) continue;
    const heading = classifyHeading(line);
    if (heading !== undefined) {
      flush();
      if (heading.kind === 'rule') currentRule = heading.name;
      else if (heading.kind === 'other') currentRule = undefined;
      else if (currentRule !== undefined) {
        current = { rule: currentRule, title: heading.title, steps: [] };
        collectingSteps = true;
      }
    } else if (collectingSteps && current !== undefined) {
      collectingSteps = appendStep(current, line);
    }
  }
  flush();
  return scenarios;
}

/** Classify a line as a rule / scenario / other heading, or undefined if it is not a heading. */
function classifyHeading(line: string): Heading | undefined {
  const heading = parseHeading(line);
  if (heading === undefined) return undefined;
  if (heading.level === 2 && heading.text.startsWith(RULE_PREFIX)) {
    return { kind: 'rule', name: heading.text.slice(RULE_PREFIX.length).trim() };
  }
  if (heading.level === 3 && heading.text.startsWith(SCENARIO_PREFIX)) {
    return { kind: 'scenario', title: heading.text.slice(SCENARIO_PREFIX.length).trim() };
  }
  return { kind: 'other' };
}

/** Append a step line; return whether to keep collecting (false once checkboxes begin). */
function appendStep(scenario: ParsedScenario, line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('- [')) return false;
  if (trimmed !== '') scenario.steps.push(trimmed);
  return true;
}

/**
 * Render a vitest skeleton from a test-definitions.md. Empty input (no scenarios
 * inside any rule) yields a header-only string — the command refuses that case
 * before writing, so an empty test file is never produced.
 */
export function emitVitestSkeleton(
  testDefinitionsContent: string,
  options: EmitOptions = {},
): string {
  const scenarios = parseScenarios(testDefinitionsContent);
  const blocks = [...groupByRule(scenarios)].map(([ruleName, ruleScenarios]) =>
    renderDescribe(ruleName, ruleScenarios, options.red ?? false),
  );
  const body = blocks.length === 0 ? '' : `${blocks.join('\n\n')}\n`;
  return `${buildHeader(options.source)}${body}`;
}

/** Group scenarios by their rule, preserving first-seen order. */
function groupByRule(scenarios: readonly ParsedScenario[]): Map<string, ParsedScenario[]> {
  const byRule = new Map<string, ParsedScenario[]>();
  for (const scenario of scenarios) {
    const group = byRule.get(scenario.rule) ?? [];
    group.push(scenario);
    byRule.set(scenario.rule, group);
  }
  return byRule;
}

/** The leading comment + vitest import. No `it(`/`describe(`, so it adds no tests. */
function buildHeader(source: string | undefined): string {
  const provenance = source === undefined ? '`safeword codify`' : `\`safeword codify ${source}\``;
  return [
    `// Generated by ${provenance}. One test per scenario in test-definitions.md.`,
    '// Stubs are pending by default; fill in each body as you implement.',
    "import { describe, it } from 'vitest';",
    '',
    '',
  ].join('\n');
}

/** One `describe` block for a rule and its scenarios. */
function renderDescribe(
  ruleName: string,
  scenarios: readonly ParsedScenario[],
  red: boolean,
): string {
  const tests = scenarios.map(scenario => indent(renderTest(scenario, red))).join('\n\n');
  return `describe(${JSON.stringify(ruleName)}, () => {\n${tests}\n});`;
}

/** One scenario → its G/W/T comments + a pending stub (default) or throwing `it` (--red). */
function renderTest(scenario: ParsedScenario, red: boolean): string {
  const comments = scenario.steps.map(step => `// ${step}`);
  const body = red
    ? `it(${JSON.stringify(scenario.title)}, () => {\n  throw new Error('not implemented');\n});`
    : `it.todo(${JSON.stringify(scenario.title)});`;
  return [...comments, body].join('\n');
}

/** Indent every non-empty line by `spaces`. */
function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(line => (line === '' ? line : `${pad}${line}`))
    .join('\n');
}

/**
 * An ATX heading → `{ level, text }`, or undefined for a non-heading line.
 * Counts leading `#` without a quantifier-over-quantifier regex and requires a
 * whitespace separator before the text (mirrors scenario-coverage.ts).
 */
function parseHeading(line: string): { level: number; text: string } | undefined {
  const trimmed = line.trim();
  let level = 0;
  while (level < trimmed.length && trimmed.charAt(level) === '#') level += 1;
  if (level === 0 || level > 6) return undefined;
  const rest = trimmed.slice(level);
  if (rest.length === 0 || !rest.startsWith(' ')) return undefined;
  return { level, text: rest.trim() };
}
