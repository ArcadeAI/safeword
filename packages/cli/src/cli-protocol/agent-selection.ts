export type AgentIntegration = 'claude' | 'codex' | 'cursor' | 'opencode';

/** Project configuration is always in scope; `agents` names the integrations. */
interface AgentSelection {
  readonly agents: readonly AgentIntegration[];
}

export interface AgentSelectionError {
  readonly code: 'AGENT_SELECTION_INVALID';
  readonly message: string;
}

export type AgentSelectionResult =
  | { readonly ok: true; readonly selection: AgentSelection }
  | { readonly ok: false; readonly error: AgentSelectionError };

const SUPPORTED_AGENT_INTEGRATIONS = ['claude', 'codex', 'opencode', 'cursor'] as const;
export const DEFAULT_AGENT_INTEGRATIONS: readonly AgentIntegration[] = Object.freeze([
  'claude',
  'codex',
]);
export const AGENT_SELECTION_DESCRIPTION = `${SUPPORTED_AGENT_INTEGRATIONS.join(', ')}, or none`;

export function parseAgentSelection(value: unknown): AgentSelectionResult {
  if (value === undefined) {
    return { ok: true, selection: { agents: DEFAULT_AGENT_INTEGRATIONS } };
  }
  if (typeof value !== 'string') return invalidSelection();

  const values = value
    .split(',')
    .map(agent => agent.trim().toLowerCase())
    .filter(agent => agent !== '');
  if (values.length === 0) return invalidSelection();
  if (values.includes('none')) {
    return values.length === 1
      ? { ok: true, selection: { agents: [] } }
      : {
          ok: false,
          error: {
            code: 'AGENT_SELECTION_INVALID',
            message: `\`none\` must be used alone; supported values are ${AGENT_SELECTION_DESCRIPTION}.`,
          },
        };
  }
  if (values.some(agent => !SUPPORTED_AGENT_INTEGRATIONS.includes(agent as AgentIntegration))) {
    return invalidSelection();
  }
  return {
    ok: true,
    selection: { agents: [...new Set(values as AgentIntegration[])] },
  };
}

function invalidSelection(): AgentSelectionResult {
  return {
    ok: false,
    error: {
      code: 'AGENT_SELECTION_INVALID',
      message: `Supported agent values are ${AGENT_SELECTION_DESCRIPTION}.`,
    },
  };
}
