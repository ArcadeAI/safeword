// Close detection for ticket.md edits (#5546): did this tool call move the
// ticket's status to done? PostToolUse uses it to record that the Stop done
// gate is owed. It fails closed — only positive evidence that the ticket was
// already done rules a close out.

/** The tool_input fields a ticket.md Edit, MultiEdit, or Write reports. */
export interface TicketEditInput {
  old_string?: string;
  new_string?: string;
  edits?: Array<{ old_string?: string; new_string?: string }>;
}

const AMBIGUOUS_EDIT = 'ambiguous' as const;

function frontmatterStatus(content: string): string | undefined {
  return /^status:\s*(\S+)/m.exec(content)?.[1];
}

/**
 * The file as it read before an Edit or MultiEdit, rebuilt by undoing its
 * replacements in reverse order. Write and NotebookEdit carry no prior text
 * (undefined). A replacement whose new text is empty or appears more than once
 * cannot be undone with certainty (AMBIGUOUS_EDIT).
 */
function contentBeforeEdit(
  content: string,
  toolInput: TicketEditInput | undefined,
): string | typeof AMBIGUOUS_EDIT | undefined {
  const edits =
    toolInput?.edits ??
    (toolInput?.old_string === undefined
      ? []
      : [{ old_string: toolInput.old_string, new_string: toolInput.new_string }]);
  if (edits.length === 0) return undefined;
  let before = content;
  for (const edit of edits.toReversed()) {
    if (edit.old_string === undefined || edit.new_string === undefined) return AMBIGUOUS_EDIT;
    if (edit.new_string === '' || before.split(edit.new_string).length !== 2) {
      return AMBIGUOUS_EDIT;
    }
    before = before.replace(edit.new_string, () => edit.old_string ?? '');
  }
  return before;
}

/**
 * Whether any replacement's text lands on the frontmatter status line. A
 * replacement no longer found intact (a later one rewrote it) counts as
 * touching it, so the check fails closed.
 */
function editTouchesStatusLine(content: string, newTexts: string[]): boolean {
  const statusLine = /^status:.*$/m.exec(content);
  if (!statusLine) return true;
  const lineStart = statusLine.index;
  const lineEnd = lineStart + statusLine[0].length;
  return newTexts.some(text => {
    if (text === '' || !content.includes(text)) return true;
    for (let at = content.indexOf(text); at !== -1; at = content.indexOf(text, at + 1)) {
      if (at < lineEnd && at + text.length > lineStart) return true;
    }
    return false;
  });
}

/**
 * Whether the tool call that produced `content` (a ticket.md now at status
 * done) moved the ticket to done. An Edit or MultiEdit is judged by undoing
 * it; when that is ambiguous, it is a close if any replacement touches the
 * status line. A Write or NotebookEdit carries no prior text, so it always
 * counts as a close: nothing it reports can prove the ticket was already done.
 */
export function isTicketCloseEdit(
  content: string,
  toolInput: TicketEditInput | undefined,
): boolean {
  const newTexts = [
    toolInput?.new_string,
    ...(toolInput?.edits?.map(edit => edit.new_string) ?? []),
  ].filter((text): text is string => text !== undefined);
  if (newTexts.length === 0) return true;
  const before = contentBeforeEdit(content, toolInput);
  if (before === AMBIGUOUS_EDIT || before === undefined) {
    return editTouchesStatusLine(content, newTexts);
  }
  return frontmatterStatus(before) !== 'done';
}
