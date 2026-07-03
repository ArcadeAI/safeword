const GENERATED_SAFEWORD_PATH = '.safeword/';

function shellQuote(filePath) {
  return JSON.stringify(filePath);
}

function withoutGeneratedSafewordFiles(files) {
  return files.filter(
    filePath => !filePath.startsWith(GENERATED_SAFEWORD_PATH) && !filePath.includes('/.safeword/'),
  );
}

function eslintAndPrettier(files) {
  const commands = [];
  const lintableFiles = withoutGeneratedSafewordFiles(files);
  if (lintableFiles.length > 0) {
    commands.push(`eslint --fix ${lintableFiles.map(filePath => shellQuote(filePath)).join(' ')}`);
  }
  commands.push(`prettier --write ${files.map(filePath => shellQuote(filePath)).join(' ')}`);
  return commands;
}

export default {
  '*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}': eslintAndPrettier,
  '*.{vue,svelte,astro}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,scss,html,yaml,yml,graphql}': ['prettier --write'],
  '*.md': ['markdownlint-cli2 --fix', 'prettier --write'],
  // prettier only — markdownlint false-positives on MDX's JSX/imports. Mirrors
  // CI's `prettier --check .`, which does cover .mdx (the gap that let an
  // unformatted .mdx commit pass the hook and fail CI on PR #692).
  '*.mdx': ['prettier --write'],
  '*.sh': ['shellcheck'],
  '*.feature': ['bun packages/cli/src/cli.ts lint-gherkin'],
};
