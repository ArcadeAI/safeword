import type { SharedBehaviorBinding } from '../../templates/hooks/lib/behavior-contract.js';
import type { Finding } from '../cli-protocol/result.js';
import type { HostHandlerRegistration } from '../lifecycle/integrations.js';

interface NativeHook {
  readonly command?: string;
  readonly hooks?: readonly NativeHook[];
  readonly async?: boolean;
  readonly asyncRewake?: boolean;
}

/** Walk the actual configuration, including events outside the common lifecycle projection. */
export function configuredCommandHandlers(
  host: string,
  config: Readonly<Record<string, readonly NativeHook[]>>,
): HostHandlerRegistration[] {
  return Object.entries(config).flatMap(([event, groups]) =>
    groups.flatMap(group =>
      (group.hooks ?? [group]).map(hook => {
        if (hook.command === undefined) throw new Error(`Missing ${host} ${event} hook command`);
        const mode = hook.async ? 'background' : 'synchronous';
        const execution = hook.asyncRewake ? 'async-rewake' : mode;
        return {
          host,
          event,
          command: hook.command,
          handler_path:
            /\.safeword\/(?<path>hooks\/[\w./-]+)/u.exec(hook.command)?.groups?.path ?? '<inline>',
          interpreter: hook.command.split(/\s+/u, 1)[0] ?? '',
          execution,
          configuration: { group, hook },
        };
      }),
    ),
  );
}

export function unclassifiedHandlerFindings(
  handlers: readonly HostHandlerRegistration[],
  bindings: readonly SharedBehaviorBinding[],
): Finding[] {
  const owners = new Set(bindings.map(binding => binding.owner));
  return handlers
    .filter(handler => !owners.has(handler.handler_path))
    .map(handler => ({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      severity: 'error',
      message: `${handler.host} ${handler.event} handler has no shared classification: ${handler.handler_path}`,
      metadata: { host: handler.host, event: handler.event, handler_path: handler.handler_path },
    }));
}
