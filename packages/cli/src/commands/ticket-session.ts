import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { getTicketInfo } from '../../templates/hooks/lib/active-ticket.js';
import { hasSafewordProjectMarker } from '../../templates/hooks/lib/namespace-root.js';
import { resolveProjectDirectory } from '../../templates/hooks/lib/project-directory.js';
import {
  featurePausePath,
  isFeatureSessionPaused,
  safeSessionOperand,
  sessionStatePathForKey,
} from '../../templates/hooks/lib/quality-state.js';
import type { CommandInvocation } from '../cli-protocol/handler.js';
import { type CliResult, createResult, invalidOperand } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';

function boundFeature(project: string, stateFile: string, ticket: string): boolean {
  if (!hasSafewordProjectMarker(project)) return false;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as { activeTicket?: unknown };
    return state.activeTicket === ticket && getTicketInfo(project, ticket).type === 'feature';
  } catch {
    return false;
  }
}

export function switchFeatureSession(
  action: 'pause' | 'resume',
  invocation: CommandInvocation,
): CliResult {
  const command = `ticket ${action}`;
  const [ticket, session] = invocation.operands;
  if (!safeSessionOperand(ticket) || !safeSessionOperand(session)) {
    return invalidOperand(
      command,
      'Supply the ticket ID and the conversation key from the feature gate.',
    );
  }
  const project = resolveProjectDirectory({ launchDirectory: invocation.cwd, cwd: invocation.cwd });
  const stateFile = sessionStatePathForKey(project, session);
  if (!boundFeature(project, stateFile, ticket)) {
    return invalidOperand(
      command,
      'This conversation is not bound to that feature in this checkout.',
    );
  }
  const marker = featurePausePath(stateFile);
  const paused = isFeatureSessionPaused(stateFile, ticket);
  const changed = paused !== (action === 'pause');
  const markerOperation = action === 'pause' ? 'write' : 'remove';
  if (changed) {
    if (action === 'pause') writeDurableFile(marker, JSON.stringify(ticket), { mode: 0o600 });
    else rmSync(marker, { force: true });
  }
  return createResult({
    state: changed ? 'changed' : 'healthy',
    changed,
    data: { command, ticket, session, paused: action === 'pause' },
    effects: {
      files: changed
        ? [
            {
              kind: 'file',
              target: path.relative(invocation.cwd, marker),
              operation: markerOperation,
            },
          ]
        : [],
    },
    nextActions:
      action === 'pause'
        ? [
            {
              command: `safeword ticket resume ${ticket} ${session}`,
              mutates: true,
              requiresHuman: false,
            },
          ]
        : [],
  });
}
