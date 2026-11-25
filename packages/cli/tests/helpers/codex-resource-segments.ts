import assert from 'node:assert/strict';

import {
  parseShellCommandList,
  parseShellWords,
} from '../../templates/hooks/lib/shell-segments.js';
import { correlatedToolCommands, nativeShellCommand } from './codex-review-receipt.js';
import type { NativeTurn } from './codex-workflow-observation.js';

/** Cooperative diagnostic grammar, not a shell interpreter or inner-exit proof.
 * Literal reads never expand; allowed neighboring commands can contain quoted
 * expansions. A successful outer command plus exact bytes cannot exclude an
 * earlier semicolon-masked failure or an echo of the same bytes. Comments fail closed.
 */
function segmentRanges(shell: string, target: string): number[][] {
  if (/\$\(|`/u.test(shell)) return [];
  const parts = parseShellCommandList(shell);
  if (parts.some(part => !ordinaryStatement(part.command))) return [];
  return parts.flatMap((part, index) =>
    executedRead(parts, index) ? literalRange(part.command, target) : [],
  );
}

function literalRange(command: string, target: string): number[][] {
  // Quotes delimit literals; escaped/expanded programs and paths remain unsupported.
  if (/[\\$`]/u.test(command)) return [];
  const words = parseShellWords(command);
  const range = /^(\d+),(\d+)p$/u.exec(words[2] ?? '');
  if (
    words.length !== 4 ||
    words.slice(0, 2).join(' ') !== 'sed -n' ||
    words[3] !== target ||
    !range
  )
    return [];
  const from = Number(range[1]);
  const to = Number(range[2]);
  return [from, to].every(Number.isSafeInteger) && from > 0 && to >= from ? [[from, to]] : [];
}

function ordinaryStatement(command: string): boolean {
  // Only the retained top-level command families. Reject shell nesting/control and writes.
  const unquoted = command.replaceAll(/'[^']*'|"(?:[^"\\]|\\.)*"/gu, '');
  if (/[#(){}'"\\$]/u.test(unquoted)) return false;
  const words = parseShellWords(command);
  if (/^[A-Z_]+=[/\w.-]+$/u.test(command)) return true;
  if (!['sed', 'rg', 'head', 'printf', 'git', 'bun'].includes(words[0] ?? '')) return false;
  if (/[<>]/u.test(command.replaceAll('2>/dev/null', ''))) return false;
  if (words[0] === 'bun')
    return command.startsWith('bun "$SAFEWORD_PLUGIN_RUNTIME" project record-skill-invocation ');
  return true;
}

function executedRead(parts: ReturnType<typeof parseShellCommandList>, index: number): boolean {
  const before = parts[index - 1]?.operatorAfter;
  const after = parts[index]?.operatorAfter;
  if ([before, after].some(operator => operator !== undefined && ![';', '&&'].includes(operator)))
    return false;
  // A successful final && chain proves its members ran. A later ; would mask its failure.
  if (before === '&&' || after === '&&')
    return parts
      .slice(index)
      .every(part => part.operatorAfter === undefined || part.operatorAfter === '&&');
  return true;
}

/** Pool only exact current line slices from successful, call/output-correlated native commands. */
export function completeResourceSegments(
  turn: Pick<NativeTurn, 'entries' | 'events'>,
  target: string,
  body: string,
  afterEntryIndex = -1,
) {
  const lines = body
    .split('\n')
    .map((line, index, all) => (index < all.length - 1 ? `${line}\n` : line));
  if (lines.at(-1) === '') lines.pop();
  const covered = new Set<number>();
  const callIds: string[] = [];
  let entryIndex = -1;
  const commands = turn.events
    .filter(event => {
      if (event.item?.exit_code !== 0) return false;
      const shell = nativeShellCommand(event.item.command ?? '');
      return shell !== undefined && segmentRanges(shell, target).length > 0;
    })
    .flatMap(event =>
      correlatedToolCommands(turn, event).map(command => ({
        ...command,
        position: resourceReadPosition(turn.entries, command.callId),
        output: event.item?.aggregated_output ?? '',
      })),
    )
    .filter(command => command.position.start > afterEntryIndex)
    .toSorted((left, right) => left.position.end - right.position.end);
  for (const command of commands) {
    const delivered = deliveredLines(command.shell, target, lines, command.output);
    if (delivered.length === 0) continue;
    for (const line of delivered) covered.add(line);
    if (!callIds.includes(command.callId)) callIds.push(command.callId);
    entryIndex = Math.max(entryIndex, outputIndex(turn, command.callId));
    if (covered.size === lines.length) break;
  }
  return lines.length > 0 && covered.size === lines.length
    ? { method: 'correlated-tool-read', completeBody: true, callIds, entryIndex }
    : undefined;
}

function deliveredLines(shell: string, target: string, lines: string[], output: string): number[] {
  return segmentRanges(shell, target).flatMap(([from = 0, to = 0]) => {
    const slice = lines.slice(from - 1, to).join('');
    return slice && output.includes(slice)
      ? Array.from({ length: Math.min(to, lines.length) - from + 1 }, (_, index) => from + index)
      : [];
  });
}

function outputIndex(turn: Pick<NativeTurn, 'entries'>, callId: string): number {
  return resourceReadPosition(turn.entries, callId).end;
}

export function resourceReadPosition(entries: NativeTurn['entries'], callId: string) {
  const start = entries.findIndex(
    entry =>
      entry.payload?.call_id === callId &&
      ['custom_tool_call', 'function_call'].includes(entry.payload.type ?? ''),
  );
  const end = entries.findIndex(
    entry =>
      entry.payload?.call_id === callId &&
      ['custom_tool_call_output', 'function_call_output'].includes(entry.payload.type ?? ''),
  );
  assert.ok(start !== -1 && end > start, 'HOST_CONTRACT_PROOF_UNAVAILABLE: tool read order');
  return { start, end };
}
