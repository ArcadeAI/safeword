import { describe, expect, it } from 'vitest';

import {
  codexAppServerFailedTurn,
  codexAppServerProof,
} from '../../src/review/codex-app-server-proof.js';

const threadStart = {
  id: 2,
  result: { thread: { id: 'thread-1' }, model: 'gpt-6-astra', modelProvider: 'openai' },
};
const turnStart = { id: 3, result: { turn: { id: 'turn-1' } } };
const completed = {
  method: 'turn/completed',
  params: {
    threadId: 'thread-1',
    turn: {
      id: 'turn-1',
      status: 'completed',
      items: [{ type: 'agentMessage', phase: 'final_answer', text: '{"verdict":"approve"}' }],
    },
  },
};

describe('Codex app-server reviewer proof', () => {
  it('binds the final answer and exact model to the acknowledged completed turn', () => {
    expect(codexAppServerProof([threadStart, turnStart, completed], 'gpt-6-astra')).toEqual({
      text: '{"verdict":"approve"}',
      confirmedModel: { provider: 'openai', model: 'gpt-6-astra' },
    });
  });

  it('keeps a completed review but does not confirm a mismatched or rerouted model', () => {
    const rerouted = {
      method: 'model/rerouted',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        fromModel: 'gpt-6-astra',
        toModel: 'gpt-6-sol',
      },
    };
    expect(codexAppServerProof([threadStart, turnStart, completed], 'gpt-6-sol')).toEqual({
      text: '{"verdict":"approve"}',
    });
    expect(
      codexAppServerProof([threadStart, turnStart, rerouted, completed], 'gpt-6-astra'),
    ).toEqual({ text: '{"verdict":"approve"}' });
    expect(
      codexAppServerProof(
        [
          { ...threadStart, result: { ...threadStart.result, modelProvider: 'anthropic' } },
          turnStart,
          completed,
        ],
        'gpt-6-astra',
      ),
    ).toEqual({ text: '{"verdict":"approve"}' });
  });

  it('refuses to bind an answer from another thread or unfinished turn', () => {
    expect(
      codexAppServerProof(
        [
          threadStart,
          turnStart,
          { ...completed, params: { ...completed.params, threadId: 'thread-2' } },
        ],
        'gpt-6-astra',
      ),
    ).toBeUndefined();
    expect(
      codexAppServerProof(
        [
          threadStart,
          turnStart,
          {
            ...completed,
            params: {
              ...completed.params,
              turn: { ...completed.params.turn, id: 'turn-2' },
            },
          },
        ],
        'gpt-6-astra',
      ),
    ).toBeUndefined();
    expect(
      codexAppServerProof(
        [
          threadStart,
          turnStart,
          {
            ...completed,
            params: {
              ...completed.params,
              turn: { ...completed.params.turn, status: 'failed' },
            },
          },
        ],
        'gpt-6-astra',
      ),
    ).toBeUndefined();
  });

  it('recognizes failure only for the acknowledged turn', () => {
    const failed = {
      ...completed,
      params: { ...completed.params, turn: { ...completed.params.turn, status: 'failed' } },
    };
    expect(codexAppServerFailedTurn([threadStart, turnStart, failed])).toBe(true);
    expect(
      codexAppServerFailedTurn([
        threadStart,
        turnStart,
        { ...failed, params: { ...failed.params, threadId: 'thread-2' } },
      ]),
    ).toBe(false);
    expect(
      codexAppServerFailedTurn([
        threadStart,
        turnStart,
        { ...failed, params: { ...failed.params, turn: { ...failed.params.turn, id: 'turn-2' } } },
      ]),
    ).toBe(false);
  });
});
