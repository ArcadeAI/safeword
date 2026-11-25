import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

// Fresh process per fault: the unfixed runner mutates its imported JSON heap.
// These are pure grader doubles, never native/vendor/guard evidence.
it.each(['architecture-option', 'handoff-option', 'handoff-current-tool'])(
  'keeps expected cases independent of an in-place request mutation: %s',
  mode => {
    const runner = nodePath.resolve(
      import.meta.dirname,
      '../../scripts/lib/propagation-settings.ts',
    );
    const fixture = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/documented-option-composition.json',
    );
    const result = spawnSync(
      'bun',
      [
        '--eval',
        String.raw`
      import { readFileSync } from 'node:fs';
      const fixture = ${JSON.stringify(fixture)};
      const before = readFileSync(fixture, 'utf8');
      const independent = JSON.parse(before);
      const { runArchitectureSettings, runHandoffSettings } = await import(${JSON.stringify(runner)});
      const mode = ${JSON.stringify(mode)};
      const actor = {
        async observeVerification(_evidence, _setup, setting) {
          setting.options.terminalHandoffCorrection = false;
          return { protocol: 'stop-json', observation: {
            installation: 'retained', raw: 'pure grader double only',
            configuration: { path: '/owned/config.json', bytes: JSON.stringify(setting.options) },
            decisions: setting.options.architectureReviewGate ? [{ decision: 'block', reason: 'missing cited evidence' }] : [{}],
            ticket: 'type: feature\nphase: verify\nstatus: in_progress',
          }};
        },
        async observeHandoff(setting) {
          if (mode === 'handoff-option') setting.options.terminalHandoffCorrection = false;
          else setting.currentTool = false;
          return {
            installation: 'retained', raw: 'pure grader double only',
            configuration: { path: '/owned/config.json', bytes: JSON.stringify(setting.options) },
            decisions: [{}],
            ...(setting.currentTool && { helper: { marker: 'synthetic', origin: '/owned/helper' } }),
          };
        },
      };
      const graded = mode === 'architecture-option'
        ? await runArchitectureSettings(actor, 'ordinary evidence')
        : await runHandoffSettings(actor);
      console.log(JSON.stringify({ exit: graded.exit, failures: graded.failures,
        fixtureUnchanged: before === readFileSync(fixture, 'utf8'),
        independentlyEnabled: independent.flatMap((row, i) => row.terminalHandoffCorrection ? [i] : []),
      }));
    `,
      ],
      { encoding: 'utf8', timeout: 30_000 },
    );
    expect(result.status, result.stderr).toBe(0);
    const observed = JSON.parse(result.stdout);
    expect(observed.fixtureUnchanged).toBe(true);
    expect(observed.independentlyEnabled).toEqual([1, 3]);
    if (mode === 'architecture-option') {
      expect(observed.exit, 'ARCHITECTURE_ORACLE_MUTATED').toBe(2);
      expect(observed.failures).toEqual(
        [1, 3].map(i => `PROPAGATION_ARCHITECTURE_SETTING:${i}:CONFIGURATION_MISMATCH`),
      );
    } else if (mode === 'handoff-option') {
      expect(observed.exit, 'HANDOFF_OPTION_ORACLE_MUTATED').toBe(2);
      expect(observed.failures).toEqual(
        [1, 3, 6].map(i => `PROPAGATION_HANDOFF_SETTING:${i}:MISMATCH`),
      );
    } else {
      expect(observed.exit, 'HANDOFF_TOOL_ORACLE_MUTATED').toBe(3);
      expect(observed.failures).toEqual(
        [0, 1, 2, 3, 4, 5].map(i => `PROPAGATION_HANDOFF_SETTING:${i}:UNOBSERVED`),
      );
    }
  },
);
