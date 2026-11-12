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

/**
 * First `phase: <value>` line in a payload string, if any. Column-0 anchored:
 * real frontmatter keys are never indented, so an indented `phase:` line
 * (e.g. a fenced code example inside the ticket body) must not read as a
 * transition.
 */
function phaseIn(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return /^phase:[ \t]*(\S+)[ \t]*$/m.exec(text)?.[1];
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
 * Append a work-log entry as the Work Log section's last line. The entry goes
 * before the next level-1 or level-2 heading, so a section after the Work Log
 * keeps its bytes and review identity (#5766); with no later section it lands
 * at end of file. A missing Work Log is created at end of file. Every byte
 * outside the inserted line survives.
 */
export function appendWorkLogEntry(content: string, entry: string): string {
  const body = content.endsWith('\n') ? content : `${content}\n`;
  const heading = /^## Work Log[ \t]*$/m.exec(body);
  if (heading === null) return `${body}\n## Work Log\n\n${entry}\n`;
  const sectionEnd = nextSectionStart(body, heading.index + heading[0].length);
  if (sectionEnd === undefined) return `${body}${entry}\n`;
  const section = body.slice(0, sectionEnd).replace(/\n+$/u, '\n');
  return `${section}${entry}\n\n${body.slice(sectionEnd)}`;
}

/**
 * Offset of the next level-1 or level-2 heading — ATX (`## X`) or setext (a
 * paragraph underlined with `=` or `-`) — skipping fenced code. A `---` after a
 * list item or quote is a thematic break, not a heading, as Markdown reads it.
 * Detecting a boundary too early is harmless (the entry still lands in the Work
 * Log); missing one would put the entry in a section the review identity binds.
 */
function nextSectionStart(body: string, from: number): number | undefined {
  let offset = from;
  let fence: string | undefined;
  let paragraphStart: number | undefined;
  let inList = false;
  let previousBlank = true;
  for (const line of body.slice(from).split('\n')) {
    const blank = line.trim() === '';
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (fence !== undefined) {
      // Code content is never structure; only a matching fence closes it.
      if (marker?.startsWith(fence[0] ?? '') && marker.length >= fence.length) {
        if (line.trim() === marker) fence = undefined;
      }
    } else if (marker !== undefined) {
      fence = marker;
      paragraphStart = undefined;
    } else if (/^ {0,3}#{1,2}([ \t]|$)/u.test(line)) {
      return offset;
    } else if (paragraphStart !== undefined && /^ {0,3}(=+|-+)[ \t]*$/u.test(line)) {
      return paragraphStart;
    } else if (blank) {
      paragraphStart = undefined;
    } else if (/^ {0,3}([-*+]|\d{1,9}[.)])([ \t]|$)/u.test(line)) {
      inList = true;
      paragraphStart = undefined;
    } else if (/^ {0,3}>/u.test(line)) {
      inList = false;
      paragraphStart = undefined;
    } else if (inList && (!previousBlank || /^\s/u.test(line))) {
      // A list item's continuation line, not a top-level paragraph.
    } else if (paragraphStart === undefined) {
      inList = false;
      paragraphStart = offset;
    }
    previousBlank = blank;
    offset += line.length + 1;
  }
  return undefined;
}
