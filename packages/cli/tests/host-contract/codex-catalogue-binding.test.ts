import { describe, expect, it } from 'vitest';

import { catalogueHelperRuntime } from '../helpers/codex-native-catalogue.js';

const skillFile = '/fixture/candidate/skills/explain/SKILL.md';
const runtime = '/fixture/candidate/runtime/cli.js';
function skill(command: string, link = '../../runtime/cli.js'): string {
  return `[the bundled Safeword runtime](${link})\n\n\`\`\`bash\nPROJECT_DIR="$PWD"\n${command}\n\`\`\`\n`;
}
const invocation =
  'bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime audit-principle-trace --cwd "$PROJECT_DIR" --';

describe('installed catalogue helper binding', () => {
  it('resolves the exact relative runtime and canonical helper invocation', () => {
    expect(catalogueHelperRuntime(skill(invocation), skillFile, runtime)).toBe(runtime);
  });
  it.each([
    skill(invocation, '../../wrong/cli.js'),
    skill('bun /another/cache/runtime/cli.js project runtime audit-principle-trace'),
    skill('bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime missing-helper'),
    skill(`${invocation}; echo fake`),
  ])('rejects a broken declared binding even if an agent could improvise: %s', source => {
    expect(() => catalogueHelperRuntime(source, skillFile, runtime)).toThrow(
      'NATIVE_HELPER_ORIGIN_MISMATCH',
    );
  });
});
