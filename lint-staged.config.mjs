const GENERATED_SAFEWORD_PATH = '.safeword/';
const GENERATED_CLAUDE_PLUGIN_PATH = 'plugin/';
const GENERATED_CODEX_RUNTIME_PATH = 'packages/cli/codex-plugin/runtime/';

function shellQuote(filePath) {
  return JSON.stringify(filePath);
}

function withoutGeneratedDeliveryFiles(files) {
  return files.filter(
    filePath =>
      !filePath.startsWith(GENERATED_SAFEWORD_PATH) &&
      !filePath.includes('/.safeword/') &&
      !filePath.startsWith(GENERATED_CLAUDE_PLUGIN_PATH) &&
      !filePath.includes('/plugin/') &&
      !filePath.startsWith(GENERATED_CODEX_RUNTIME_PATH) &&
      !filePath.includes(`/${GENERATED_CODEX_RUNTIME_PATH}`),
  );
}

function eslintAndPrettier(files) {
  const commands = [];
  const lintableFiles = withoutGeneratedDeliveryFiles(files);
  if (lintableFiles.length > 0) {
    commands.push(
      `eslint --fix ${lintableFiles.map(filePath => shellQuote(filePath)).join(' ')}`,
      `prettier --write ${lintableFiles.map(filePath => shellQuote(filePath)).join(' ')}`,
    );
  }
  return commands;
}

function commandsForFiles(command, files) {
  const sourceFiles = withoutGeneratedDeliveryFiles(files);
  return sourceFiles.length === 0
    ? []
    : [`${command} ${sourceFiles.map(filePath => shellQuote(filePath)).join(' ')}`];
}

export default {
  '*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}': eslintAndPrettier,
  '*.{vue,svelte,astro}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,scss,html,yaml,yml,graphql}': files => commandsForFiles('prettier --write', files),
  // prettier runs BEFORE markdownlint on purpose: markdownlint must judge the
  // bytes that actually get committed. Linting first let prettier invalidate a
  // just-passed verdict — `<!-- markdownlint-disable-next-line RULE -->` covers
  // the next *physical* line, and prettier puts a blank line after an HTML
  // comment block, so the directive ends up suppressing nothing. markdownlint
  // saw the adjacent (working) form and passed; the commit shipped the inert
  // one. Nothing re-checked it, because an unchanged file is never staged again
  // — so the violation stayed invisible to the hook forever (#3740).
  // Safe to swap: over the whole markdown corpus this order is a fixed point —
  // prettier changes nothing markdownlint then wants to fix, and vice versa.
  '*.md': files => [
    ...commandsForFiles('prettier --write', files),
    ...commandsForFiles('markdownlint-cli2 --fix', files),
  ],
  // prettier only — markdownlint false-positives on MDX's JSX/imports. Mirrors
  // CI's `prettier --check .`, which does cover .mdx (the gap that let an
  // unformatted .mdx commit pass the hook and fail CI on PR #692).
  '*.mdx': ['prettier --write'],
  // Guarded: shellcheck is a system binary, not a devDependency — a clean
  // machine without it must not fail pre-commit. The deterministic, strict
  // gate is CI's lint job, where the runner preinstalls shellcheck (#966).
  '*.sh': files =>
    commandsForFiles(
      `sh -c 'if command -v shellcheck >/dev/null 2>&1; then shellcheck "$@"; else echo "shellcheck not installed; skipping (CI runs it strictly)"; fi' --`,
      files,
    ),
  '*.feature': ['bun packages/cli/src/cli.ts lint-gherkin'],
};
