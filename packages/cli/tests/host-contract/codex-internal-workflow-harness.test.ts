import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  invocationResult,
  type InvocationScenarioResult,
} from '../../scripts/check-codex-internal-workflows.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import {
  preservationControl,
  preservationEmbedding,
} from '../fixtures/host-contract/preservation-control.js';
import {
  assertInternalPicker,
  assertPickerCanonicalSettings,
  type PickerObservation,
} from '../helpers/codex-internal-workflows.js';

const menu = 'Internal selector entries are hidden while public controls remain offered';
function observed(testing: boolean): PickerObservation {
  return {
    method: 'automated-native-tui',
    queries: ['bdd', 'explain', 'testing'].map(name => ({
      query: `$safeword:${name}`,
      offered: name !== 'testing' || testing,
      output:
        name === 'testing' && !testing
          ? '$safeword:testing no matches'
          : `$safeword:${name} ${name} (safeword) [Skill]`,
    })),
  };
}
function result(): InvocationScenarioResult {
  return {
    name: menu,
    line: 1,
    steps: [
      { result: { status: 'passed' } },
      { result: { status: 'passed' } },
      { result: { status: 'failed', error_message: 'AssertionError: INTERNAL_WORKFLOW_VISIBLE' } },
      {
        hidden: true,
        keyword: 'After',
        result: { status: 'passed' },
        embeddings: preservationEmbedding(menu),
      },
    ],
  };
}

describe('native invocation harness controls', () => {
  it.each(['omitted', 'duplicate', 'foreign-arm', 'false-second'])(
    'rejects %s second-arm preservation',
    fault => {
      const row = codexInternalCases().find(item => item.preservationArms.length === 2);
      assert.ok(row);
      const embeddings = preservationEmbedding(row.scenario);
      const scenario: InvocationScenarioResult = {
        name: row.scenario,
        line: row.line,
        steps: [
          ...Array.from({ length: row.stepCount }, () => ({ result: { status: 'passed' } })),
          { hidden: true, keyword: 'After', result: { status: 'passed' }, embeddings },
        ],
      };
      expect(invocationResult([scenario], 0)).toBe(0);
      const second = JSON.parse(Buffer.from(embeddings[1]?.data ?? '', 'base64').toString());
      if (fault === 'omitted') embeddings.pop();
      else if (fault === 'duplicate') {
        const first = embeddings[0];
        assert.ok(first);
        embeddings[1] = { ...first };
      } else {
        if (fault === 'foreign-arm') second.arm = 'foreign';
        else second.observation.originalRuntimeUnchanged = false;
        embeddings[1] = {
          mime_type: 'application/json',
          data: Buffer.from(JSON.stringify(second)).toString('base64'),
        };
      }
      expect(invocationResult([scenario], 0)).toBe(3);
    },
  );
  it('requires native public controls before reporting visible internal testing', () => {
    expect(() => {
      assertInternalPicker(observed(true));
    }).toThrow('INTERNAL_WORKFLOW_VISIBLE');
    const missing = observed(true);
    missing.queries = missing.queries.filter(query => query.query !== '$safeword:explain');
    expect(() => {
      assertInternalPicker(missing);
    }).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  });

  it('accepts actual absence with both public controls and rejects unobserved absence', () => {
    expect(() => {
      assertInternalPicker(observed(false));
    }).not.toThrow();
    const incomplete = observed(false);
    const first = incomplete.queries[2];
    assert.ok(first);
    first.output = 'picker still loading';
    expect(() => {
      assertInternalPicker(incomplete);
    }).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  });

  it('does not treat hide-everything as a product RED or success', () => {
    const hidden = observed(false);
    for (const query of hidden.queries) query.offered = false;
    expect(() => {
      assertInternalPicker(hidden);
    }).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  });

  it('rejects absence observed before catalogue-readiness controls', () => {
    const early = observed(false);
    early.queries.reverse();
    expect(() => {
      assertInternalPicker(early);
    }).toThrow('public controls must precede');
  });

  it('does not diagnose visibility RED when canonical testing is public', () => {
    const root = nodePath.resolve(import.meta.dirname, '../../../..');
    const canonical = mkdtempSync(nodePath.join(tmpdir(), 'safeword-picker-settings-'));
    try {
      for (const name of ['testing', 'bdd', 'explain'])
        cpSync(
          nodePath.join(root, 'packages/cli/templates/skills', name),
          nodePath.join(canonical, name),
          { recursive: true },
        );
      expect(() => {
        assertPickerCanonicalSettings(canonical);
      }).not.toThrow();
      const file = nodePath.join(canonical, 'testing/SKILL.md');
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace('user-invocable: false', 'user-invocable: true'),
      );
      expect(() => {
        assertPickerCanonicalSettings(canonical);
      }).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE: testing is not internal');
    } finally {
      rmSync(canonical, { recursive: true, force: true });
    }
  });

  it('requires a single native redraw containing both query and picker result', () => {
    const root = nodePath.resolve(import.meta.dirname, '../../../..');
    const script = nodePath.join(root, 'packages/cli/tests/helpers/codex-workflow-picker.py');
    const frame = (body: string): string => `\u{1B}[?2026h${body}\u{1B}[?2026l`;
    const run = (value: string): unknown => {
      const child = spawnSync(
        'python3',
        [
          '-c',
          "import json,runpy,sys; m=runpy.run_path(sys.argv[1],run_name='unit_test'); print(json.dumps(m['picker_frame'](sys.argv[2].encode(),'testing')))",
          script,
          value,
        ],
        { encoding: 'utf8' },
      );
      expect(child.status).toBe(0);
      return JSON.parse(child.stdout) as unknown;
    };
    expect(run(frame('no matches enter insert esc close'))).toBeNull();
    expect(run(frame('$safeword:testing enter insert esc close'))).toBeNull();
    expect(run(frame('no matches enter insert esc close') + frame('$safeword:testing'))).toBeNull();
    expect(
      run(frame('no matches enter insert esc close $safeword:bdd$safeword:testing')),
    ).toBeNull();
    expect(run(frame('no matches enter insert esc close $safeword:testing'))).toMatchObject({
      offered: false,
    });
  });

  it('waits for a cleared native composer before typing the next picker query', () => {
    const root = nodePath.resolve(import.meta.dirname, '../../../..');
    const script = nodePath.join(root, 'packages/cli/tests/helpers/codex-workflow-picker.py');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-picker-clear-'));
    try {
      const child = spawnSync(
        'python3',
        [
          '-c',
          `import json,runpy,sys
m=runpy.run_path(sys.argv[1],run_name='unit_test')
# Simulate only PTY/process I/O; run the actual frame parser and driver loop.
frames=[
 '  › Ask Codex to do anything   GPT-6.1-Sol default',
 '› bdd (safeword) [Skill] enter insert · esc close › $safeword:bdd',
 'no matches enter insert · esc close › $safeword:bdd$safeword:explain',
 '  › Ask Codex to do anything   GPT-6.1-Sol default',
 '› explain (safeword) [Skill] enter insert · esc close › $safeword:explain',
 '  › Ask Codex to do anything   GPT-6.1-Sol default',
 '› testing (safeword) [Skill] enter insert · esc close › $safeword:testing',
]
cursor=[-1]; writes=[]
def read(fd,size):
 cursor[0]+=1
 if cursor[0]>=len(frames): return b''
 return m['FRAME_START']+frames[cursor[0]].encode()+m['FRAME_END']
m['pty'].fork=lambda:(123,456)
m['fcntl'].ioctl=lambda *args:None
m['select'].select=lambda *args:([456],[],[])
m['os'].read=read
m['os'].write=lambda fd,value:writes.append([cursor[0],value.decode()])
m['os'].waitpid=lambda *args:(123,0)
m['os'].close=lambda *args:None
m['observe']('unused-native-binary',sys.argv[2])
print(json.dumps(writes))`,
          script,
          fixture,
        ],
        { encoding: 'utf8', timeout: 10_000 },
      );
      expect(child.error, child.stderr).toBeUndefined();
      expect(child.status, child.stderr).toBe(0);
      expect(JSON.parse(child.stdout)).toEqual([
        [0, '$safeword:bdd'],
        [1, '\u{15}'],
        [3, '$safeword:explain'],
        [4, '\u{15}'],
        [5, '$safeword:testing'],
      ]);
      const observations = JSON.parse(
        readFileSync(nodePath.join(fixture, 'picker-observations.json'), 'utf8'),
      ) as { queries: { query: string; offered: boolean }[] };
      expect(observations.queries.map(({ query, offered }) => ({ query, offered }))).toEqual([
        { query: '$safeword:bdd', offered: true },
        { query: '$safeword:explain', offered: true },
        { query: '$safeword:testing', offered: true },
      ]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('requires the actor assertion after successful setup/action/preservation', () => {
    expect(invocationResult([result()], 1)).toBe(2);
    const failedSetup = result();
    const setup = failedSetup.steps[0];
    assert.ok(setup);
    setup.result.status = 'failed';
    expect(invocationResult([failedSetup], 1)).toBe(3);
    const failedPreservation = result();
    failedPreservation.steps[3] = {
      hidden: true,
      keyword: 'After',
      result: { status: 'failed', error_message: 'fixture changed' },
    };
    expect(invocationResult([failedPreservation], 1)).toBe(3);
    expect(invocationResult([{ ...result(), steps: result().steps.slice(0, 3) }], 1)).toBe(3);
    // eslint-disable-next-line unicorn/no-null -- spawnSync reports a signalled process with null status.
    expect(invocationResult([result()], null)).toBe(3);
  });

  it('rejects undefined, skipped, empty and partial Cucumber outcomes', () => {
    expect(invocationResult([], 0)).toBe(3);
    for (const status of ['undefined', 'skipped', 'pending']) {
      const incomplete = result();
      const last = incomplete.steps[2];
      assert.ok(last);
      last.result.status = status;
      expect(invocationResult([incomplete], 1)).toBe(3);
    }
    expect(invocationResult([{ ...result(), steps: [] }], 0)).toBe(3);
    expect(invocationResult([{ ...result(), name: 'unrelated scenario' }], 1)).toBe(3);
  });

  it('discovers additions from the actual tagged Rule without a second case list', () => {
    const cases = codexInternalCases();
    expect(cases).toHaveLength(10);
    expect(cases.find(row => row.scenario === menu)?.stepCount).toBe(3);
    const source = `Feature: discovery
  @codex-internal-workflows
  Rule: canonical invocation
    Scenario: newly shipped workflow
      Given its canonical resource exists
      When the workflow is requested
      Then its body is loaded
`;
    expect(codexInternalCases(source).map(row => row.id)).toEqual(['newly-shipped-workflow']);
  });

  it.each(['red', 'green', 'failed-after'])(
    'parses actual Cucumber hidden hooks for %s formatter control',
    mode => {
      const root = nodePath.resolve(import.meta.dirname, '../../../..');
      const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-cucumber-formatter-'));
      const feature = nodePath.join(fixture, 'control.feature');
      const steps = nodePath.join(fixture, 'steps.cjs');
      const config = nodePath.join(fixture, 'config.mjs');
      const report = nodePath.join(fixture, 'report.json');
      try {
        writeFileSync(
          feature,
          `Feature: Formatter protocol control\n  Scenario: ${menu}\n    Given a formatter control\n    When the formatter control runs\n    Then the formatter control finishes\n`,
        );
        writeFileSync(
          steps,
          `const {Given,When,Then,After}=require(${JSON.stringify(nodePath.join(root, 'node_modules/@cucumber/cucumber'))});
Given('a formatter control',()=>{}); When('the formatter control runs',()=>{});
Then('the formatter control finishes',()=>{if(process.env.SAFEWORD_FORMATTER_CONTROL==='red') throw new Error('INTERNAL_WORKFLOW_VISIBLE');});
After(function(){if(process.env.SAFEWORD_FORMATTER_CONTROL==='failed-after') throw new Error('preservation failed'); this.attach(JSON.stringify(${JSON.stringify(preservationControl(menu))}),'application/json');});`,
        );
        writeFileSync(
          config,
          `export default ${JSON.stringify({ paths: [feature], require: [steps] })};`,
        );
        const child = spawnSync(
          nodePath.join(root, 'scripts/dev'),
          [
            'node',
            'node_modules/@cucumber/cucumber/bin/cucumber.js',
            '--config',
            nodePath.relative(root, config),
            '--format',
            `json:${report}`,
          ],
          {
            cwd: root,
            env: { ...process.env, SAFEWORD_FORMATTER_CONTROL: mode },
            encoding: 'utf8',
            timeout: 30_000,
          },
        );
        const launchOutput = `${child.stderr}\n${child.stdout}`;
        expect(child.error, launchOutput).toBeUndefined();
        expect(child.status, launchOutput).toBe(mode === 'green' ? 0 : 1);
        const features = JSON.parse(readFileSync(report, 'utf8')) as {
          elements: InvocationScenarioResult[];
        }[];
        const scenarios = features.flatMap(value => value.elements);
        expect(scenarios[0]?.steps).toHaveLength(4);
        expect(invocationResult(scenarios, child.status)).toBe(
          ({ red: 2, green: 0, 'failed-after': 3 } as Record<string, number>)[mode],
        );
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    },
  );

  it('runs real Cucumber wiring and reports absent fixture as unavailable', () => {
    const root = nodePath.resolve(import.meta.dirname, '../../../..');
    const env = { ...process.env };
    delete env.SAFEWORD_CODEX_GUARD_FIXTURE;
    delete env.SAFEWORD_CODEX_PROVISIONING_IDENTITY;
    const child = spawnSync(
      nodePath.join(root, 'scripts/dev'),
      [
        'bun',
        'packages/cli/scripts/check-codex-internal-workflows.ts',
        '--case',
        'menu',
        '--require-targets',
      ],
      {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout: 30_000,
      },
    );
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(3);
    expect(child.stdout).toContain('owned guard fixture required');
    expect(child.stderr).toContain('HOST_CONTRACT_PROOF_UNAVAILABLE');
    expect(child.stderr).not.toContain('INTERNAL_WORKFLOW_VISIBLE');
  });
});
