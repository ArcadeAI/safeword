import type { CommandHandler } from './handler.js';
import { createResult } from './result.js';

function pendingTypedAdapter(name: string): CommandHandler {
  return invocation =>
    Promise.resolve(
      createResult({
        state: 'action_required',
        findings: [
          {
            code: 'CLI_ADAPTER_REQUIRED',
            message: `\`${name}\` cannot run through the typed CLI boundary yet.`,
            severity: 'error',
          },
        ],
        data: { command: name, cwd: invocation.cwd },
      }),
    );
}

export function publicHandler(name: string): CommandHandler {
  if (name === 'project lint-gherkin') {
    return async invocation => {
      const { observeGherkinLint } = await import('../commands/lint-gherkin.js');
      return observeGherkinLint(invocation.cwd, invocation.operands[0] as readonly string[]);
    };
  }

  if (name === 'ticket new') {
    return async invocation => {
      const { createTicketResult } = await import('../commands/ticket-new.js');
      return createTicketResult(String(invocation.operands[0]), invocation.options, invocation.cwd);
    };
  }

  return pendingTypedAdapter(name);
}
