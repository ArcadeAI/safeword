import { createHash } from 'node:crypto';

import { TESTING_CORE_LAYOUT } from '../schema-layouts.js';

/** Existing testing rules, authored here once; generated copies are not edited. */
export const TESTING_CORE_TEXT =
  "## Essential testing rules\n\nState the test-scope choice and why in one line, unless it's obvious from context.\n\nA suite that fakes _internal_ seams can be fully green while the real wiring is\nbroken. Name the **process boundary** you mock — the network, filesystem, clock,\nor subprocess at the edge of your code — and mock _only_ that. Every entry point\nor command that wires modules together gets **≥1 test built from real\ncollaborators**, faking nothing but that boundary.\n\nIf the only way to exercise a code path is through an injected internal value\n(`provider: 'none'`, a hand-passed `repoVisibility`) and never through the real\ncommand, that path has **no wiring test** — add one.\n\nBefore writing or reviewing tests, identify the distinct behavior partitions and choose a representative for each, including validation failures for individual inputs or input combinations. For bounded inputs, include a value strictly inside the valid range when one exists, boundary values, and out-of-range values, whether accepted or rejected. Check that the resulting tests cover those choices before reporting completion.";

const start = '<!-- SAFEWORD:TESTING_CORE_START -->';
const end = '<!-- SAFEWORD:TESTING_CORE_END -->';

export function testingCoreBlock(): string {
  if (!TESTING_CORE_TEXT.trim()) throw new Error('Essential testing core owner is empty');
  if (/\$safeword:|\.safeword\/|\/SKILL\.md|CLAUDE_|CODEX_HOME/u.test(TESTING_CORE_TEXT))
    throw new Error('Essential testing core must remain host-neutral');
  const sha = createHash('sha256').update(TESTING_CORE_TEXT).digest('hex');
  const block = `${start}\n<!-- source: ${TESTING_CORE_LAYOUT.owner}; sha256: ${sha} -->\n\n${TESTING_CORE_TEXT}\n\n${end}`;
  if (Buffer.byteLength(block) > TESTING_CORE_LAYOUT.maxBytes)
    throw new Error('Essential testing core exceeds its byte budget');
  return block;
}

function existingBlock(content: string): { offset: number; length: number } | undefined {
  const starts = content.split(start).length - 1;
  const ends = content.split(end).length - 1;
  if (starts === 0 && ends === 0) return undefined;
  const offset = content.indexOf(start);
  const finish = content.indexOf(end);
  if (starts !== 1 || ends !== 1 || finish <= offset)
    throw new Error('Essential testing core markers must be one ordered pair');
  return { offset, length: finish + end.length - offset };
}

/** Fixed generated block, not a general Markdown include language. */
export function withTestingCore(content: string): string {
  const block = testingCoreBlock();
  const old = existingBlock(content);
  if (old) return content.slice(0, old.offset) + block + content.slice(old.offset + old.length);
  const heading = /^# [^\r\n]+$/mu.exec(content);
  if (!heading) throw new Error('Essential testing core consumer has no main heading');
  const offset = heading.index + heading[0].length;
  return `${content.slice(0, offset)}\n\n${block}${content.slice(offset)}`;
}

export function assertTestingCore(content: string, template: string): void {
  const canonical = template.replaceAll('\\', '/');
  const consumers: readonly string[] = TESTING_CORE_LAYOUT.templates;
  const expected = consumers.includes(canonical);
  const old = existingBlock(content);
  if (!expected) {
    if (old) throw new Error(`Unexpected essential testing core consumer: ${template}`);
    return;
  }
  if (!old || content.slice(old.offset, old.offset + old.length) !== testingCoreBlock())
    throw new Error(
      `Missing or stale essential testing core in ${template}; reinstall the matching complete package`,
    );
}
