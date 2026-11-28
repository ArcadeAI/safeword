import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  type CodexHookInput,
  translateCodexInputToClaudeInputs,
} from '../../templates/hooks/codex/pre-tool-quality-helpers.js';
import { getTicketInfo } from '../../templates/hooks/lib/active-ticket.js';
import {
  canonicalPathForGate,
  hasSafewordProjectMarker,
  resolveNamespaceRoot,
} from '../../templates/hooks/lib/namespace-root.js';
import {
  canonicalEditTarget,
  resolveToolProjectDirectory,
} from '../../templates/hooks/lib/project-directory.js';
import {
  awaitsIntakeApproval,
  featureSwitchHint,
  stateStorageKey,
  updateSessionState,
} from '../../templates/hooks/lib/quality-state.js';

function savedTicket(
  root: string,
  target: string,
): { id: string; info: ReturnType<typeof getTicketInfo> } | undefined {
  const tickets = canonicalPathForGate(path.join(resolveNamespaceRoot(root), 'tickets'));
  const [folder, ...parts] = path.relative(tickets, target).split(path.sep);
  if (!folder || folder === '..' || parts.length === 0 || !existsSync(target)) return;
  const ticket = path.join(tickets, folder, 'ticket.md');
  if (!existsSync(ticket) || canonicalPathForGate(ticket) !== ticket) return;
  const id = /^id:[ \t]*(\S+)[ \t]*$/mu.exec(readFileSync(ticket, 'utf8'))?.[1];
  if (!id) return;
  const info = getTicketInfo(root, id);
  return info.folder === folder ? { id, info } : undefined;
}

/** Observe only the saved artifact. An unsuccessful edit cannot create a ticket binding from its proposed bytes. */
export function observeOpenCodeTicket(input: CodexHookInput, launch: string): string {
  if (!input.session_id) return '';
  let hint = '';
  for (const edit of translateCodexInputToClaudeInputs(input)) {
    const file = edit.tool_input.file_path;
    if (!file?.endsWith('.md')) continue;
    const root = resolveToolProjectDirectory(launch, {
      tool: edit.tool_name,
      editedFile: file,
      cwd: input.cwd,
    });
    if (!hasSafewordProjectMarker(root)) continue;
    const saved = savedTicket(root, canonicalEditTarget(launch, file, input.cwd));
    if (!saved) continue;
    updateSessionState(root, input.session_id, state => {
      if (saved.info.status === 'in_progress' && saved.info.type !== 'epic') {
        if (state.activeTicket !== saved.id && awaitsIntakeApproval(root, saved.info))
          hint = featureSwitchHint(saved.id, stateStorageKey(input.session_id));
        state.activeTicket = saved.id;
      } else if (state.activeTicket === saved.id) {
        delete state.activeTicket;
      }
    });
  }
  return hint;
}
