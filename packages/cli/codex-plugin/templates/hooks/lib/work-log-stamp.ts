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
  const headings = sectionHeadings(body);
  const workLog = headings.findIndex(heading => heading.level === 2 && heading.text === 'Work Log');
  if (workLog === -1) return `${body}\n## Work Log\n\n${entry}\n`;
  const next = headings[workLog + 1];
  if (next === undefined) return `${body}${entry}\n`;
  const section = body.slice(0, next.offset).replace(/\n+$/u, '\n');
  return `${section}${entry}\n\n${body.slice(next.offset)}`;
}

interface SectionHeading {
  readonly offset: number;
  readonly level: 1 | 2;
  readonly text: string;
}

/**
 * Every level-1 or level-2 heading — ATX (`## X`) or setext (a paragraph
 * underlined with `=` or `-`) — outside fenced code, read the way Markdown
 * does: a fence closes only on the same character at least as long, and a
 * `---` after a list item or quote is a thematic break. Misplacement here only
 * affects tidiness: the review identity ignores phase stamps wherever they land.
 */
function sectionHeadings(body: string): SectionHeading[] {
  const headings: SectionHeading[] = [];
  let offset = 0;
  let fence: string | undefined;
  let paragraph: { offset: number; lines: string[] } | undefined;
  let inList = false;
  let previousBlank = true;
  for (const line of body.split('\n')) {
    const blank = line.trim() === '';
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    const atx = /^ {0,3}(#{1,2})(?:[ \t]+(.*?))?[ \t#]*$/u.exec(line);
    if (fence !== undefined) {
      if (marker?.startsWith(fence[0] ?? '') && marker.length >= fence.length) {
        if (line.trim() === marker) fence = undefined;
      }
    } else if (marker !== undefined) {
      fence = marker;
      paragraph = undefined;
    } else if (atx !== null) {
      headings.push({ offset, level: atx[1] === '#' ? 1 : 2, text: (atx[2] ?? '').trim() });
      paragraph = undefined;
    } else if (paragraph !== undefined && /^ {0,3}(=+|-+)[ \t]*$/u.test(line)) {
      const level = line.trim().startsWith('=') ? 1 : 2;
      headings.push({ offset: paragraph.offset, level, text: paragraph.lines.join(' ').trim() });
      paragraph = undefined;
    } else if (blank) {
      paragraph = undefined;
    } else if (/^ {0,3}([-*+]|\d{1,9}[.)])([ \t]|$)/u.test(line)) {
      inList = true;
      paragraph = undefined;
    } else if (/^ {0,3}>/u.test(line)) {
      inList = false;
      paragraph = undefined;
    } else if (inList && (!previousBlank || /^\s/u.test(line))) {
      // A list item's continuation line, not a top-level paragraph.
    } else if (paragraph === undefined) {
      inList = false;
      paragraph = { offset, lines: [line] };
    } else {
      paragraph.lines.push(line);
    }
    previousBlank = blank;
    offset += line.length + 1;
  }
  return headings;
}
