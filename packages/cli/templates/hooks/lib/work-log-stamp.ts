// Phase work-log stamp helpers (ticket E32M4P, issue #772).
//
// The bdd phase files used to end with "add a work-log entry" templates whose
// `{timestamp}` an LLM cannot know — transition timestamps were fabricated.
// These helpers let a PostToolUse observer reconstruct the transition from the
// edit payload and append a line stamped with the real system clock. The hook
// owns that/when (the transition line); agent narrative entries remain the
// agent's own.
//
// ## Detection limits (deliberate)
//
// The transition is reconstructed from Edit/MultiEdit payload strings — the
// only channel that still carries prior content at PostToolUse time. A
// full-file Write rewrite carries no old text, so its from-phase is
// unknowable post-hoc: Write payloads detect nothing by design. A phase
// introduced where the old payload had none is a birth, not a transition,
// and is likewise not stamped.

export interface PhaseTransition {
  from: string;
  to: string;
}

/** The Edit/MultiEdit/Write payload shapes the PostToolUse hook receives. */
export interface EditToolInput {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  edits?: Array<{ old_string?: string; new_string?: string }>;
  content?: string;
}

/** First `phase: <value>` line in a payload string, if any. */
function phaseIn(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return /^\s*phase:[ \t]*(\S+)[ \t]*$/m.exec(text)?.[1];
}

function transitionFromPair(
  oldText: string | undefined,
  newText: string | undefined,
): PhaseTransition | undefined {
  const from = phaseIn(oldText);
  const to = phaseIn(newText);
  if (from === undefined || to === undefined || from === to) return undefined;
  return { from, to };
}

/**
 * Reconstruct a landed `phase:` change from an Edit (old/new strings) or
 * MultiEdit (edits array — the last phase-bearing edit wins, since later
 * edits apply later) payload. Returns undefined for everything else.
 */
export function detectPhaseTransition(
  toolInput: EditToolInput | undefined,
): PhaseTransition | undefined {
  if (toolInput === undefined) return undefined;
  if (toolInput.edits !== undefined) {
    let last: PhaseTransition | undefined;
    for (const edit of toolInput.edits) {
      last = transitionFromPair(edit.old_string, edit.new_string) ?? last;
    }
    return last;
  }
  return transitionFromPair(toolInput.old_string, toolInput.new_string);
}

/**
 * Append a work-log entry as the file's last line. The Work Log is the last
 * section of a ticket by convention, so appending at end lands inside it;
 * when the heading is missing entirely, the section is created first. Every
 * prior byte survives — the result always starts with the (newline-
 * normalized) input.
 */
export function appendWorkLogEntry(content: string, entry: string): string {
  const body = content.endsWith('\n') ? content : `${content}\n`;
  const hasWorkLog = /^## Work Log[ \t]*$/m.test(body);
  return hasWorkLog ? `${body}${entry}\n` : `${body}\n## Work Log\n\n${entry}\n`;
}
