import nodePath from 'node:path';

import packageJson from '../package.json' with { type: 'json' };

const packageRoot = nodePath.resolve(import.meta.dirname, '..');

async function bundle(entrypoint: string): Promise<string> {
  // @ts-expect-error -- this build script executes under Bun; the CLI's
  // Node-targeted tsconfig intentionally does not expose Bun globals elsewhere.
  const result = await Bun.build({
    entrypoints: [nodePath.join(packageRoot, entrypoint)],
    format: 'esm',
    packages: 'bundle',
    splitting: false,
    target: 'node',
    write: false,
  });
  if (!result.success || result.outputs.length !== 1 || result.outputs[0] === undefined) {
    throw new Error(`Failed to bundle ${entrypoint}: ${result.logs.join('\n')}`);
  }
  return await result.outputs[0].text();
}

function adaptCodexHookForNode(source: string): string {
  return source
    .replace(
      'return JSON.parse(await Bun.stdin.text());',
      'const raw = (await import("node:fs")).readFileSync(0, "utf8");\n    return JSON.parse(raw);',
    )
    .replace(
      'return spawnSync("bun", [claudeHookPath], {',
      'return spawnSync(process.execPath, [claudeHookPath], {',
    )
    .replace('SAFEWORD_AGENT_RUNTIME: "codex"', 'SAFEWORD_AGENT_RUNTIME: "opencode"');
}

function adaptClaudeHookForNode(source: string): string {
  return source.replace(
    'input = await Bun.stdin.json();',
    'const raw = (await import("node:fs")).readFileSync(0, "utf8");\n  input = JSON.parse(raw);',
  );
}

const [codexPreToolSource, preToolSource] = await Promise.all([
  bundle('templates/hooks/codex/pre-tool-quality.ts'),
  bundle('templates/hooks/pre-tool-quality.ts'),
]);

// @ts-expect-error -- this production build script executes under Bun.
const dispatcherBuild = await Bun.build({
  entrypoints: [nodePath.join(packageRoot, 'src', 'opencode', 'dispatcher.ts')],
  define: {
    __SAFEWORD_OPENCODE_CODEX_PRE_TOOL_SOURCE__: JSON.stringify(
      adaptCodexHookForNode(codexPreToolSource),
    ),
    __SAFEWORD_OPENCODE_PRE_TOOL_SOURCE__: JSON.stringify(adaptClaudeHookForNode(preToolSource)),
    __SAFEWORD_VERSION__: JSON.stringify(packageJson.version),
  },
  format: 'esm',
  packages: 'bundle',
  splitting: false,
  target: 'node',
  outdir: nodePath.join(packageRoot, 'dist', 'opencode'),
});

if (!dispatcherBuild.success) {
  throw new Error(`Failed to bundle the OpenCode dispatcher: ${dispatcherBuild.logs.join('\n')}`);
}
