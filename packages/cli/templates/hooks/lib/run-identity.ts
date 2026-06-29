export type AgentRuntime = 'claude' | 'codex' | 'cursor' | 'unknown';

export interface RunIdentity {
  runtime: AgentRuntime;
  sessionKey: string | null;
  turnKey: string | null;
  source: string;
}

export interface ResolveRunIdentityOptions {
  runtime?: AgentRuntime;
  env?: Record<string, string | undefined>;
}

interface RunIdentityInput {
  session_id?: unknown;
  turn_id?: unknown;
  conversation_id?: unknown;
  generation_id?: unknown;
}

const RUNTIMES = new Set<AgentRuntime>(['claude', 'codex', 'cursor', 'unknown']);
const RUNTIME_ENV = 'SAFEWORD_AGENT_RUNTIME';

function asInput(value: unknown): RunIdentityInput {
  return value !== null && typeof value === 'object' ? (value as RunIdentityInput) : {};
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRuntime(value: unknown): AgentRuntime | undefined {
  const runtime = nonEmptyString(value);
  if (runtime === null) return undefined;
  return RUNTIMES.has(runtime as AgentRuntime) ? (runtime as AgentRuntime) : undefined;
}

function firstString(...values: unknown[]): { value: string; source: string } | null {
  for (let index = 0; index < values.length; index += 2) {
    const source = values[index] as string;
    const value = nonEmptyString(values[index + 1]);
    if (value !== null) return { value, source };
  }
  return null;
}

function detectRuntime(
  input: RunIdentityInput,
  env: Record<string, string | undefined>,
  explicitRuntime?: AgentRuntime,
): AgentRuntime {
  const fromOption = normalizeRuntime(explicitRuntime);
  if (fromOption && fromOption !== 'unknown') return fromOption;

  const fromEnv = normalizeRuntime(env[RUNTIME_ENV]);
  if (fromEnv && fromEnv !== 'unknown') return fromEnv;

  if (
    nonEmptyString(input.conversation_id) !== null ||
    nonEmptyString(input.generation_id) !== null
  ) {
    return 'cursor';
  }
  if (nonEmptyString(input.turn_id) !== null) {
    return 'codex';
  }
  if (
    nonEmptyString(input.session_id) !== null ||
    nonEmptyString(env.CLAUDE_SESSION_ID) !== null ||
    nonEmptyString(env.CLAUDE_CODE_SESSION_ID) !== null
  ) {
    return 'claude';
  }
  return 'unknown';
}

export function resolveRunIdentity(
  rawInput: unknown = {},
  options: ResolveRunIdentityOptions = {},
): RunIdentity {
  const input = asInput(rawInput);
  const env = options.env ?? process.env;
  const runtime = detectRuntime(input, env, options.runtime);

  if (runtime === 'cursor') {
    const session = firstString('input.conversation_id', input.conversation_id);
    return {
      runtime,
      sessionKey: session?.value ?? null,
      turnKey: nonEmptyString(input.generation_id),
      source: session?.source ?? 'missing',
    };
  }

  if (runtime === 'codex') {
    const session = firstString('input.session_id', input.session_id);
    return {
      runtime,
      sessionKey: session?.value ?? null,
      turnKey: nonEmptyString(input.turn_id),
      source: session?.source ?? 'missing',
    };
  }

  if (runtime === 'claude') {
    const session = firstString(
      'input.session_id',
      input.session_id,
      'CLAUDE_SESSION_ID',
      env.CLAUDE_SESSION_ID,
      'CLAUDE_CODE_SESSION_ID',
      env.CLAUDE_CODE_SESSION_ID,
    );
    return {
      runtime,
      sessionKey: session?.value ?? null,
      turnKey: null,
      source: session?.source ?? 'missing',
    };
  }

  return {
    runtime: 'unknown',
    sessionKey: null,
    turnKey: null,
    source: 'missing',
  };
}

export function getRunStorageKey(identity: RunIdentity | null | undefined): string | null {
  if (!identity?.sessionKey || identity.runtime === 'unknown') return null;
  return `${identity.runtime}-${sanitizeStorageSegment(identity.sessionKey)}`;
}

export function sanitizeStorageSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'id'
  );
}
