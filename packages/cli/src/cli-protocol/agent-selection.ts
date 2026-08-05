export type AgentIntegration = 'claude' | 'codex' | 'cursor';

export interface AgentSelection {
  readonly project: true;
  readonly agents: readonly AgentIntegration[];
}

export interface AgentSelectionError {
  readonly code: 'AGENT_SELECTION_INVALID';
  readonly message: string;
}

export type AgentSelectionResult =
  | { readonly ok: true; readonly selection: AgentSelection }
  | { readonly ok: false; readonly error: AgentSelectionError };

const SUPPORTED_AGENTS = ['claude', 'codex', 'cursor'] as const;
const DEFAULT_AGENTS: readonly AgentIntegration[] = ['claude', 'codex'];

export function parseAgentSelection(value: unknown): AgentSelectionResult {
  if (value === undefined) {
    return { ok: true, selection: { project: true, agents: DEFAULT_AGENTS } };
  }
  if (typeof value !== 'string') return invalidSelection();

  const values = value
    .split(',')
    .map(agent => agent.trim().toLowerCase())
    .filter(agent => agent !== '');
  if (values.length === 0) return invalidSelection();
  if (values.includes('none')) {
    return values.length === 1
      ? { ok: true, selection: { project: true, agents: [] } }
      : {
          ok: false,
          error: {
            code: 'AGENT_SELECTION_INVALID',
            message:
              '`none` must be used alone; supported values are claude, codex, cursor, or none.',
          },
        };
  }
  if (values.some(agent => !SUPPORTED_AGENTS.includes(agent as AgentIntegration))) {
    return invalidSelection();
  }
  return {
    ok: true,
    selection: {
      project: true,
      agents: [...new Set(values as AgentIntegration[])],
    },
  };
}

function invalidSelection(): AgentSelectionResult {
  return {
    ok: false,
    error: {
      code: 'AGENT_SELECTION_INVALID',
      message: 'Supported agent values are claude, codex, cursor, or none.',
    },
  };
}
