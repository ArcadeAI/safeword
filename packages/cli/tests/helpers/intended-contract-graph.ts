import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

interface Selection {
  target: string;
  matcher?: string;
  condition?: string;
  interpreter?: string;
  execution?: string;
}
interface Registration {
  host: string;
  event: string;
  source_family?: string;
  command?: string;
  matcher?: string;
  condition?: string;
  execution: string;
  configuration?: { callback_scope?: string; callback_ordinal?: number };
}

/** Independent canonical-policy/outer-owner expectation, separate from formatter selection. */
export function intendedRegistrationOwner(row: Registration): string {
  const templates = 'packages/cli/templates/hooks/';
  if (row.host === 'codex')
    return row.event === 'PreToolUse'
      ? `${templates}pre-tool-quality.ts`
      : 'packages/cli/src/commands/codex-hook.ts';
  if (row.host === 'opencode') return intendedSdkOwner(row);
  if (
    row.host === 'claude' &&
    row.source_family === 'claude-native' &&
    ['SessionStart', 'UserPromptSubmit', 'Setup'].includes(row.event)
  )
    return 'packages/cli/src/claude-plugin/runtime/dispatch.ts';
  return intendedHookOwner(row);
}

function intendedSdkOwner(row: Registration): string {
  if (row.event === 'plugin.setup') return 'packages/cli/src/opencode/v2-enrollment.ts';
  if (row.event === 'tool.execute.before')
    return 'packages/cli/templates/hooks/pre-tool-quality.ts';
  return row.configuration?.callback_scope === 'registerWorkerRestrictions'
    ? 'packages/cli/src/host-contract/workers.ts'
    : 'packages/cli/src/host-contract/catalogue.ts';
}

function intendedHookTarget(row: Registration): string | undefined {
  const cursorIndex = Number(row.command?.match(/:(\d+)$/u)?.[1]);
  return row.host === 'cursor' && row.source_family === 'cursor-native'
    ? fixture.cursor[row.event]?.[cursorIndex]?.target
    : row.command?.match(/(?:\.safeword|runtime)\/hooks\/(\S+)/u)?.[1];
}

function intendedHookOwner(row: Registration): string {
  const target = intendedHookTarget(row);
  if (!target)
    throw new Error(
      `Independent registration target missing: ${intendedRegistrationIdentity(row)}`,
    );
  const file = target.split(' ', 1)[0] ?? '';
  const owners: Record<string, string> = {
    'session-auto-upgrade.ts': 'lib/auto-upgrade.ts',
    'session-cursor-auto-upgrade.ts': 'lib/auto-upgrade.ts',
    'post-tool-lint.ts': 'lib/lint.ts',
    'cursor/after-file-edit.ts': 'lib/lint.ts',
    'cursor/pre-tool-quality.ts': 'pre-tool-quality.ts',
    'cursor/before-shell-execution.ts': 'pre-tool-quality.ts',
    'cursor/post-tool-quality.ts': 'post-tool-quality.ts',
    'cursor/post-tool-skill-nudge.ts': 'post-tool-skill-nudge.ts',
  };
  return `packages/cli/templates/hooks/${owners[file] ?? file}`;
}
const fixture = JSON.parse(
  readFileSync(
    nodePath.join(
      import.meta.dirname,
      '../fixtures/host-contract/intended-current-registrations.json',
    ),
    'utf8',
  ),
) as {
  claude: Record<string, Selection[]>;
  cursor: Record<string, Selection[]>;
  codex: Record<string, Selection>;
  opencode: [string, string, number][];
};

/** Public identity contract, including native namespace and all actual selectors. */
export function intendedRegistrationIdentity(row: Registration): string {
  return JSON.stringify([
    row.host,
    row.source_family ?? 'project',
    row.event,
    row.command ?? '',
    row.matcher ?? undefined,
    row.condition ?? undefined,
    row.execution,
    row.configuration?.callback_scope,
    row.configuration?.callback_ordinal,
  ]);
}

/** Literal independent settings/SDK fixture; no production registry or formatter imports. */
function intendedClaudeRegistrations(): Registration[] {
  const rows: Registration[] = [];
  const claudeDispatch =
    'bun --no-env-file --cwd "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PLUGIN_ROOT}"/runtime/dispatch.js';
  for (const [event, entries] of Object.entries(fixture.claude)) {
    for (const entry of entries) {
      const base = {
        host: 'claude',
        event,
        matcher: entry.matcher,
        condition: entry.condition,
        execution: entry.execution ?? 'synchronous',
      };
      const command = `${entry.interpreter ?? 'bun'} "$CLAUDE_PROJECT_DIR"/.safeword/hooks/${entry.target}`;
      rows.push({ ...base, command });
      const native = `${entry.interpreter ?? 'bun'} "\${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/${entry.target}`;
      if (['SessionStart', 'UserPromptSubmit'].includes(event)) {
        if (entry.target !== 'session-auto-upgrade.ts')
          rows.push({ ...base, command: native, source_family: 'claude-native-event-groups' });
      } else
        rows.push({
          ...base,
          command: `${claudeDispatch} ${event} -- ${native}`,
          source_family: 'claude-native',
        });
    }
  }
  for (const event of ['SessionStart', 'UserPromptSubmit'])
    rows.push({
      host: 'claude',
      event,
      source_family: 'claude-native',
      execution: 'synchronous',
      command: `${claudeDispatch} ${event} --event-group`,
    });
  rows.push({
    host: 'claude',
    event: 'Setup',
    matcher: 'init',
    source_family: 'claude-native',
    execution: 'synchronous',
    command: `${claudeDispatch} Setup -- true`,
  });
  return rows;
}

export function intendedRegistrations(): Registration[] {
  const rows = intendedClaudeRegistrations();
  for (const [event, entries] of Object.entries(fixture.cursor)) {
    for (const [index, entry] of entries.entries()) {
      const base = { host: 'cursor', event, matcher: entry.matcher, execution: 'synchronous' };
      rows.push(
        { ...base, command: `bun ./.safeword/hooks/${entry.target}` },
        {
          ...base,
          source_family: 'cursor-native',
          command: `bun "\${CURSOR_PLUGIN_ROOT}"/runtime/dispatch.js ${event}:${index}`,
        },
      );
    }
  }
  for (const [event, entry] of Object.entries(fixture.codex))
    rows.push({
      host: 'codex',
      event,
      matcher: entry.matcher,
      execution: 'synchronous',
      source_family: 'codex-native',
      command: `bun --no-env-file --cwd "\${PLUGIN_ROOT}" "\${PLUGIN_ROOT}/runtime/cli.js" hook codex ${entry.target} --plugin-hook`,
    });
  for (const [event, scope, ordinal] of fixture.opencode)
    rows.push({
      host: 'opencode',
      event,
      execution: 'native-callback',
      source_family: 'opencode-v2',
      configuration: { callback_scope: scope, callback_ordinal: ordinal },
    });
  return rows;
}

/** Source facets are authoritative files; generated invocation wrappers have canonical content owners. */
export function intendedFacetOwner(path: string): string {
  const prefix = 'packages/cli/templates/';
  if (path.startsWith(`${prefix}commands/`))
    return `${prefix}skills/${nodePath.basename(path, '.md')}/SKILL.md`;
  if (path.startsWith(`${prefix}cursor/rules/`)) {
    // This retained baseline source is independent of the current wrapper registry.
    const baseline = readFileSync(
      nodePath.join(
        import.meta.dirname,
        '../fixtures/host-contract/owners/cursor-rule-purposes-baseline.txt',
      ),
      'utf8',
    );
    const name = nodePath.basename(path, '.mdc');
    const rules = baseline.slice(baseline.indexOf('export const CURSOR_RULE_WRAPPERS:'));
    const entries = rules.matchAll(/name: '([^']+)'[\s\S]*?referencePath: '([^']+)'/gu).toArray();
    const reference = entries.find(entry => entry[1] === name)?.[2];
    if (!reference?.startsWith('.safeword/'))
      throw new Error(`Independent baseline owner missing: ${path}`);
    return `${prefix}${reference.slice('.safeword/'.length)}`;
  }
  return path;
}
