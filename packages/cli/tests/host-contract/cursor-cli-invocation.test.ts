import { describe, expect, it } from 'vitest';

import {
  observedHelperProgram,
  requireNativeHelperExecution,
} from '../helpers/cursor-cli-observations.js';

const runtime = '/tmp/plugin/runtime/cli.js';
const helper = '/tmp/plugin/templates/hooks/audit-principle-trace.ts';
const command = `bun "${runtime}" project runtime audit-principle-trace`;

function transcript(result: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'tool_call',
    subtype: 'completed',
    tool_call: {
      shellToolCall: {
        args: {
          command,
          parsingResult: { executableCommands: [{ name: 'bun', fullText: command }] },
        },
        result,
      },
    },
  });
}

describe('native CLI helper execution evidence', () => {
  it('resolves the actual executable argument', () => {
    expect(observedHelperProgram(command)).toBe(runtime);
    expect(observedHelperProgram(`bun "${helper}" project runtime audit-principle-trace`)).toBe(
      helper,
    );
  });

  it('supports the canonical same-invocation runtime variable', () => {
    const invocation = `cd /tmp/project && export SAFEWORD_PLUGIN_RUNTIME="${runtime}" && PROJECT_DIR="$PWD" && bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime audit-principle-trace --cwd "$PROJECT_DIR" --`;
    expect(observedHelperProgram(invocation)).toBe(runtime);
  });

  it('rejects unrelated mentions of the runtime path', () => {
    expect(
      observedHelperProgram(
        `ls "${runtime}"; bun "${helper}" project runtime audit-principle-trace`,
      ),
    ).toBeUndefined();
  });

  it('rejects forged reentry environment and opaque substitutions', () => {
    expect(
      observedHelperProgram(
        `export SAFEWORD_PLUGIN_CLI="${runtime}"; bun "${helper}" project runtime audit-principle-trace`,
      ),
    ).toBeUndefined();
    expect(
      observedHelperProgram('bun "$(resolve-runtime)" project runtime audit-principle-trace'),
    ).toBeUndefined();
    expect(
      observedHelperProgram('bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime audit-principle-trace'),
    ).toBeUndefined();
  });

  it('does not treat model-only output as an executed helper', () => {
    expect(() =>
      requireNativeHelperExecution(
        JSON.stringify({ type: 'result', result: 'workflow and guide loaded' }),
      ),
    ).toThrow('CURSOR_CLI_UNAVAILABLE');
  });

  it.each(['', 'Permission denied by allowlist'])(
    'keeps permission refusals out of product RED evidence %#',
    reason => {
      expect(() => requireNativeHelperExecution(transcript({ rejected: { reason } }))).toThrow(
        'CURSOR_CLI_UNAVAILABLE',
      );
    },
  );

  it('retains actual failed executions for the contract assertion to assess', () => {
    const executions = requireNativeHelperExecution(
      transcript({ success: { exitCode: 1, stdout: 'Missing packaged resource' } }),
    );
    expect(executions).toHaveLength(1);
    expect(executions[0]?.result?.success?.exitCode).toBe(1);
  });
});
