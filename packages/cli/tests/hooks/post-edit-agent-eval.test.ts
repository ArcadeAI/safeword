import { describe, expect, it } from 'vitest';

import {
  grade,
  INITIAL,
  type Observation,
  UNRELATED,
} from '../../../../experiments/post-edit-smoke/grade.ts';

const pending = `import { formatName } from './name.mjs';\n${INITIAL}`;
const finalSource = pending.replace('"Hello, " + name', '"Hello, " + formatName(name)');
const diagnostic = JSON.stringify({
  hookSpecificOutput: { additionalContext: 'formatName: no-unused-vars; object-curly-spacing' },
});

function good(): Observation {
  return {
    agentSucceeded: true,
    hooks: [
      { before: pending, after: pending, output: diagnostic, status: 0 },
      { before: finalSource, after: finalSource, output: '{}', status: 0 },
    ],
    finalSource,
    helperUnchanged: true,
    taskWorks: true,
  };
}

describe('post-edit live-agent smoke grading', () => {
  it('accepts a completed task with observed intermediate feedback and preserved unrelated bytes', () => {
    expect(grade(good())).toEqual([]);
  });

  it.each([
    ['an agent that did nothing', { ...good(), hooks: [], finalSource: INITIAL, taskWorks: false }],
    ['no intermediate feedback', { ...good(), hooks: good().hooks.slice(1) }],
    [
      'unstructured text posing as feedback',
      {
        ...good(),
        hooks: [
          { before: pending, after: pending, output: 'formatName no-unused-vars', status: 0 },
        ],
      },
    ],
    [
      'an import removed and later restored',
      {
        ...good(),
        hooks: [
          good().hooks[0],
          { before: INITIAL, after: INITIAL, output: '{}', status: 0 },
          good().hooks[1],
        ].filter((record): record is NonNullable<typeof record> => record !== undefined),
      },
    ],
    [
      'an unavailable checker',
      {
        ...good(),
        hooks: [
          {
            before: pending,
            after: pending,
            status: 0,
            output: 'missing eslint',
          },
        ],
      },
    ],
    ['an agent error', { ...good(), agentSucceeded: false }],
    ['broken task output', { ...good(), taskWorks: false }],
    ['a changed helper', { ...good(), helperUnchanged: false }],
    ['a removed import', { ...good(), finalSource: INITIAL }],
    [
      'an unrelated final rewrite',
      {
        ...good(),
        finalSource: finalSource.replace(UNRELATED, 'export const untouched = { z: 1, a: 2 };\n'),
      },
    ],
    [
      'an unrelated rewrite later restored',
      {
        ...good(),
        hooks: [
          {
            output: diagnostic,
            status: 0,
            before: pending.replace(UNRELATED, ''),
            after: pending.replace(UNRELATED, ''),
          },
          ...good().hooks,
        ],
      },
    ],
    [
      'a hook that mutated the source',
      {
        ...good(),
        hooks: [
          { before: pending, after: INITIAL, output: diagnostic, status: 0 },
          ...good().hooks,
        ],
      },
    ],
    [
      'a failed hook process',
      {
        ...good(),
        hooks: [
          { before: pending, after: pending, output: diagnostic, status: 1 },
          ...good().hooks,
        ],
      },
    ],
  ] satisfies [string, Observation][])('rejects %s', (_name, observation) => {
    expect(grade(observation).length).toBeGreaterThan(0);
  });
});
