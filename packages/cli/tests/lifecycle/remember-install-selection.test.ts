import { expect, it } from 'vitest';

import { createTemporaryDirectory, runCliWithLiteralArguments } from '../helpers.js';

it('reuses the last explicit project selection on an offline repeat install', async () => {
  const cwd = createTemporaryDirectory();
  const install = (selection: string[]) =>
    runCliWithLiteralArguments(['install', ...selection, '--offline', '--no-input', '--json'], {
      cwd,
      env: { SAFEWORD_SKIP_INSTALL: '1' },
    });

  for (const agent of ['cursor', 'none']) {
    const selected = await install([`--agents=${agent}`]);
    expect(selected.exitCode).toBe(0);
    const repeated = await install([]);
    expect(repeated.exitCode).toBe(0);
    const report = JSON.parse(repeated.stdout);
    expect(report.data.selected_agents).toEqual(agent === 'none' ? [] : [agent]);
    expect(report.changed).toBe(false);
    expect(
      report.next_actions.some((action: { requires_human: boolean }) => action.requires_human),
    ).toBe(false);
  }
});
