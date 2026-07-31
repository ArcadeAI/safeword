import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { spawnHookScript } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');
const PROMPT_QUESTIONS = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-questions.ts');
const PROJECT_NAMESPACE_ROOT = '.project';

export interface StopHookTicketOptions {
  id: string;
  slug: string;
  phase: string;
  status: string;
  type?: string;
}

export function stateFilePath(directory: string, sessionId: string): string {
  return nodePath.join(directory, PROJECT_NAMESPACE_ROOT, `quality-state-${sessionId}.json`);
}

/** Write the minimal edited-work transcript shared by Stop-hook integration tests. */
export function createEditTranscript(directory: string): string {
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  writeFileSync(
    transcriptPath,
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Edit', id: 'toolu_1' }],
      },
    }),
  );
  return transcriptPath;
}

export function createStopHookTicket(
  directory: string,
  { id, slug, phase, status, type = 'task' }: StopHookTicketOptions,
): void {
  const ticketFolder = nodePath.join(directory, PROJECT_NAMESPACE_ROOT, 'tickets', `${id}-${slug}`);
  mkdirSync(ticketFolder, { recursive: true });
  writeFileSync(
    nodePath.join(ticketFolder, 'ticket.md'),
    [
      '---',
      `id: ${id}`,
      `status: ${status}`,
      `type: ${type}`,
      `phase: ${phase}`,
      `last_modified: ${new Date().toISOString()}`,
      '---',
    ].join('\n'),
  );
}

export function writeSessionState(
  directory: string,
  sessionId: string,
  state: Record<string, unknown>,
): void {
  const statePath = stateFilePath(directory, sessionId);
  mkdirSync(nodePath.dirname(statePath), { recursive: true });
  // eslint-disable-next-line unicorn/no-null -- JSON.stringify replacer parameter
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function runStopHook(
  directory: string,
  transcriptPath: string,
  sessionId?: string,
  lastAssistantMessage = 'Here is what I changed.',
) {
  return spawnHookScript(STOP_QUALITY, directory, {
    session_id: sessionId,
    transcript_path: transcriptPath,
    last_assistant_message: lastAssistantMessage,
  });
}

export function runPromptQuestionsHook(directory: string, sessionId: string) {
  return spawnHookScript(PROMPT_QUESTIONS, directory, {
    session_id: sessionId,
    prompt: 'Continue with the next change.',
  });
}
