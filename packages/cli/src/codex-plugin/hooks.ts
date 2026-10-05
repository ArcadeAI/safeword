export interface CodexPluginHookEntry {
  hooks?: { command?: string }[];
  matcher?: string;
}

export function codexPluginHookCommand(event: string): string {
  return `bun --no-env-file --cwd "\${PLUGIN_ROOT}" "\${PLUGIN_ROOT}/runtime/cli.js" hook codex ${event} --plugin-hook`;
}

/** Return every command configured by a Codex plugin hook manifest. */
export function codexPluginHookCommands(hooks: Record<string, CodexPluginHookEntry[]>): string[] {
  return Object.values(hooks).flatMap(entries =>
    entries.flatMap(entry =>
      (entry.hooks ?? []).flatMap(hook => (hook.command === undefined ? [] : [hook.command])),
    ),
  );
}

/** Reject a hook command that could evade the reviewed bundled plugin runtime. */
export function assertBundledHookCommand(command: string): void {
  if (command.includes('--dangerously-bypass-hook-trust')) {
    throw new Error('Safeword plugin hooks must not bypass Codex hook trust');
  }
  if (/\b(?:bunx|npx)\b/u.test(command)) {
    throw new Error('Safeword plugin hooks must not install packages at runtime');
  }
  if (
    !/^bun --no-env-file --cwd "\$\{PLUGIN_ROOT\}" "\$\{PLUGIN_ROOT\}\/runtime\/cli\.js" hook codex [a-z-]+ --plugin-hook$/u.test(
      command,
    )
  ) {
    throw new Error('Safeword plugin hooks must use the bundled Safeword Codex hook command form');
  }
}
