export type ResultState = 'healthy' | 'changed' | 'action_required' | 'failed';

interface ResultInput {
  state: ResultState;
  findings?: readonly unknown[];
  errors?: readonly unknown[];
  nextActions?: readonly unknown[];
}

export function createResult(_input: ResultInput): never {
  throw new Error('Not implemented');
}

export function exitStatusFor(_result: unknown): never {
  throw new Error('Not implemented');
}

export function renderJsonResult(_result: unknown): never {
  throw new Error('Not implemented');
}

export function renderHumanResult(
  _result: unknown,
  _options?: { quiet?: boolean; verbose?: boolean },
): never {
  throw new Error('Not implemented');
}
