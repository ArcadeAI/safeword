import { describe, expect, it } from 'vitest';

import { readRepoFile } from './helpers';

const OVERRIDE_SUITE = 'packages/cli/tests/integration/override-survival.test.ts';

describe('override-survival install boundary (5KHSQB)', () => {
  it('reuses repository tooling, disables upgrade installs, and rejects launcher failures', () => {
    const source = readRepoFile(OVERRIDE_SUITE);

    expect(source.match(/linkRepoToolchain\(projectDirectory\);/g)).toHaveLength(4);
    expect(source).toContain(
      "await runCli(['upgrade'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });",
    );
    expect(source).toContain('expect(hookResult.error).toBeUndefined()');
    expect(source).toContain('expect(hookResult.status).toBe(0)');
    expect(source).toContain("expect(hookOutput).not.toContain('bunx failed')");
  });
});
