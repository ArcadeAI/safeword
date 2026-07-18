export interface CodexPluginHookEntry {
  hooks?: { command?: string }[];
  matcher?: string;
}

/** Return every command configured by a Codex plugin hook manifest. */
export function codexPluginHookCommands(hooks: Record<string, CodexPluginHookEntry[]>): string[] {
  return Object.values(hooks).flatMap(entries =>
    entries.flatMap(entry =>
      (entry.hooks ?? []).flatMap(hook => (hook.command === undefined ? [] : [hook.command])),
    ),
  );
}

/** Reject a hook command that could evade the reviewed, versioned Bunx path. */
export function assertPinnedBunxHookCommand(command: string, version: string): void {
  if (command.includes('--dangerously-bypass-hook-trust')) {
    throw new Error('Safe Word plugin hooks must not bypass Codex hook trust');
  }
  if (/\bnpx\b/u.test(command)) {
    throw new Error('Safe Word plugin hooks must use Bunx, never npx');
  }
  if (!command.startsWith('bunx --bun safeword')) {
    throw new Error('Safe Word plugin hooks must use pinned Bunx Safe Word commands');
  }
  if (!command.startsWith(`bunx --bun safeword@${version} `)) {
    throw new Error(`Safe Word plugin hooks must pin safeword@${version}`);
  }
  if (!/^bunx --bun safeword@\S+ hook codex [a-z-]+$/u.test(command)) {
    throw new Error('Safe Word plugin hooks must use the Safe Word Codex hook command form');
  }
}
