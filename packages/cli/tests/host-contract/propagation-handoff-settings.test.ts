import { expect, it } from 'vitest';

import { runHandoffSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  HandoffObservation,
  HandoffSetting,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';

// These doubles prove orchestration/grades ONLY, never native dispatch or guard behaviour.
const faults: {
  name: string;
  exit: number;
  change(observed: HandoffObservation, setting: HandoffSetting, index: number): void;
}[] = [
  { name: 'healthy', exit: 0, change() {} },
  {
    name: 'dropped correction',
    exit: 2,
    change(o) {
      o.decisions = [{}];
    },
  },
  {
    name: 'old tool history',
    exit: 2,
    change(o, s) {
      if (!s.currentTool)
        o.decisions = [{ decision: 'block', reason: 'terminal-handoff/v1 correction' }, {}];
    },
  },
  {
    name: 'missing raw',
    exit: 3,
    change(o) {
      o.raw = '';
    },
  },
  {
    name: 'missing identity',
    exit: 3,
    change(o) {
      o.installation = '';
    },
  },
  {
    name: 'missing helper',
    exit: 3,
    change(o) {
      o.helper = undefined;
    },
  },
  {
    name: 'dropped other option',
    exit: 2,
    change(o, s) {
      o.configuration.bytes = JSON.stringify({ ...s.options, architectureReviewGate: false });
    },
  },
  {
    name: 'extra Stop',
    exit: 2,
    change(o) {
      o.decisions = [...o.decisions, {}];
    },
  },
  {
    name: 'replacement',
    exit: 2,
    change(o, _s, i) {
      if (i > 0) o.installation = 'other';
    },
  },
];
it.each(faults)(
  'retains six handoff combinations and a no-current-tool control: $name',
  async fault => {
    const requests: HandoffSetting[] = [];
    const originals: HandoffObservation[] = [];
    const actor: RetainedPolicyActor = {
      observeHandoff(setting) {
        const observed: HandoffObservation = {
          installation: 'retained',
          raw: 'qualified process-edge record ONLY',
          configuration: { path: '/owned/config.json', bytes: JSON.stringify(setting.options) },
          decisions:
            setting.options.terminalHandoffCorrection && setting.currentTool
              ? [{ decision: 'block', reason: 'terminal-handoff/v1 correction' }, {}]
              : [{}],
          ...(setting.currentTool && {
            helper: { marker: 'real actor must observe this', origin: '/owned/helper' },
          }),
        };
        fault.change(observed, setting, requests.length);
        requests.push(setting);
        originals.push(observed);
        return Promise.resolve(observed);
      },
      observeVerification() {
        throw new Error('terminal correction must not become ticket completion');
      },
      observe() {
        throw new Error('not resource evidence');
      },
      refreshResources() {
        throw new Error('must retain installation');
      },
      fingerprint() {
        throw new Error('not a settings observation');
      },
    };
    const result = await runHandoffSettings(actor);
    expect(result.exit).toBe(fault.exit);
    expect(requests.slice(0, 6)).toEqual(
      combinations.map(options => ({ options, currentTool: true })),
    );
    expect(requests).toHaveLength(7);
    expect(requests[6]).toMatchObject({
      options: { terminalHandoffCorrection: true },
      currentTool: false,
    });
    for (const [index, row] of result.observations.entries()) expect(row).toBe(originals[index]);
    expect(result.admission_eligible).toBe(false);
  },
);
