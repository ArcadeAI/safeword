import type { ConfirmedReviewerModel } from './runtime.js';

interface CodexTurnProof {
  readonly text: string;
  readonly confirmedModel?: ConfirmedReviewerModel;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unique(
  messages: readonly unknown[],
  predicate: (message: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
  const matches = messages.filter(
    (message): message is Record<string, unknown> => record(message) && predicate(message),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function startedTurn(
  messages: readonly unknown[],
):
  | { readonly threadId: string; readonly turnId: string; readonly start: Record<string, unknown> }
  | undefined {
  const start = unique(messages, message => message.id === 2);
  const turnStart = unique(messages, message => message.id === 3);
  if (!record(start?.result) || !record(start.result.thread) || !record(turnStart?.result))
    return undefined;
  const threadId = start.result.thread.id;
  const turn = turnStart.result.turn;
  if (typeof threadId !== 'string' || !record(turn) || typeof turn.id !== 'string')
    return undefined;
  return { threadId, turnId: turn.id, start: start.result };
}

function completedTurn(
  messages: readonly unknown[],
  threadId: string,
  turnId: string,
): Record<string, unknown> | undefined {
  const completed = unique(
    messages,
    message =>
      message.method === 'turn/completed' &&
      record(message.params) &&
      message.params.threadId === threadId &&
      record(message.params.turn) &&
      message.params.turn.id === turnId,
  );
  if (!record(completed?.params) || !record(completed.params.turn)) return undefined;
  const finishedTurn = completed.params.turn;
  if (finishedTurn.status !== 'completed' || !Array.isArray(finishedTurn.items)) return undefined;
  return finishedTurn;
}

function finalAnswer(turn: Record<string, unknown>): string | undefined {
  if (!Array.isArray(turn.items)) return undefined;
  const answers = turn.items.filter(
    (item): item is Record<string, unknown> =>
      record(item) &&
      item.type === 'agentMessage' &&
      item.phase === 'final_answer' &&
      typeof item.text === 'string',
  );
  if (answers.length !== 1 || typeof answers[0]?.text !== 'string') return undefined;
  return answers[0].text;
}

function wasRerouted(messages: readonly unknown[], threadId: string, turnId: string): boolean {
  return messages.some(
    message =>
      record(message) &&
      message.method === 'model/rerouted' &&
      record(message.params) &&
      message.params.threadId === threadId &&
      message.params.turnId === turnId,
  );
}

function confirmedModel(
  start: Record<string, unknown>,
  selectedModel: string | undefined,
): ConfirmedReviewerModel | undefined {
  const model = start.model;
  const provider = start.modelProvider;
  if (
    typeof model !== 'string' ||
    model === '' ||
    typeof provider !== 'string' ||
    provider === '' ||
    (selectedModel !== undefined && selectedModel !== model)
  )
    return undefined;
  return { provider, model };
}

/** A model acknowledgement has authority only for its matching completed turn. */
export function codexAppServerProof(
  messages: readonly unknown[],
  selectedModel: string | undefined,
): CodexTurnProof | undefined {
  const started = startedTurn(messages);
  if (started === undefined) return undefined;
  const completed = completedTurn(messages, started.threadId, started.turnId);
  if (completed === undefined) return undefined;
  const text = finalAnswer(completed);
  if (text === undefined) return undefined;
  const model = wasRerouted(messages, started.threadId, started.turnId)
    ? undefined
    : confirmedModel(started.start, selectedModel);
  return {
    text,
    ...(model && { confirmedModel: model }),
  };
}
