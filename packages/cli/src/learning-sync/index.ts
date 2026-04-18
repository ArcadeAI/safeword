/**
 * Learning sync — generates `.claude/skills/project-learnings/SKILL.md` from
 * `.safeword-project/learnings/*.md` so the folder becomes self-discoverable
 * via Claude Code's native Agent Skills mechanism (description + body index).
 *
 * Ticket #130.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

export const LEARNINGS_RELATIVE_PATH = '.safeword-project/learnings';
export const SKILL_RELATIVE_DIR = '.claude/skills/project-learnings';
export const SKILL_FILENAME = 'SKILL.md';

// Anthropic's hard cap on skill description length.
// https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
const MAX_DESCRIPTION_CHARS = 1024;

const DESCRIPTION_PREFIX =
  "Project-specific engineering lessons recorded during this codebase's development.";
const DESCRIPTION_SUFFIX =
  'Read the matching file before related work to avoid re-making previously-solved mistakes.';

export interface LearningEntry {
  fileName: string;
  relativePath: string; // e.g. .safeword-project/learnings/foo.md
  title: string;
  covers: string; // topic list from the "Covers:" line
}

export interface SyncResult {
  wrote: boolean;
  entries: LearningEntry[];
  skipped: { fileName: string; reason: string }[];
  skillPath: string;
  descriptionTruncated: boolean;
}

/**
 * Parse a single learning file. Returns the entry if it has a Covers: line
 * on line 3, or a reason string explaining why it was skipped.
 */
export function parseLearning(
  filePath: string,
): { ok: true; entry: Omit<LearningEntry, 'relativePath'> } | { ok: false; reason: string } {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  if (lines.length < 3) {
    return { ok: false, reason: 'file has fewer than 3 lines' };
  }

  const titleLine = lines[0] ?? '';
  const coversLine = lines[2] ?? '';

  if (!coversLine.startsWith('Covers:')) {
    return { ok: false, reason: 'missing Covers: line on line 3' };
  }

  const covers = coversLine.slice('Covers:'.length).trim();
  if (covers.length === 0) {
    return { ok: false, reason: 'Covers: line is empty' };
  }

  const title = titleLine.startsWith('# ')
    ? titleLine.slice(2).trim()
    : nodePath.basename(filePath, '.md');

  const fileName = nodePath.basename(filePath);
  return { ok: true, entry: { fileName, title, covers } };
}

/**
 * Read all learning files. Files lacking Covers: on line 3 are skipped.
 */
export function readLearnings(learningsDirectory: string): {
  entries: LearningEntry[];
  skipped: { fileName: string; reason: string }[];
} {
  if (!existsSync(learningsDirectory)) {
    return { entries: [], skipped: [] };
  }

  const entries: LearningEntry[] = [];
  const skipped: { fileName: string; reason: string }[] = [];

  const fileNames = readdirSync(learningsDirectory)
    .filter(name => name.endsWith('.md'))
    .toSorted((a, b) => a.localeCompare(b));

  for (const fileName of fileNames) {
    const filePath = nodePath.join(learningsDirectory, fileName);
    const parsed = parseLearning(filePath);
    if (parsed.ok) {
      entries.push({
        ...parsed.entry,
        relativePath: `${LEARNINGS_RELATIVE_PATH}/${fileName}`,
      });
    } else {
      skipped.push({ fileName, reason: parsed.reason });
    }
  }

  return { entries, skipped };
}

/**
 * Build a topic list from the entries' Covers: lines.
 * Terse joining: "<topic1>, <topic2>, ..." trimmed so the full description
 * fits under MAX_DESCRIPTION_CHARS.
 */
interface TopicList {
  list: string;
  truncated: boolean;
}

function buildTopicList(entries: LearningEntry[], budget: number): TopicList {
  if (entries.length === 0) return { list: '', truncated: false };
  const topics = entries.map(entry => entry.covers.replace(/\.$/, ''));
  const joined = topics.join('; ');
  if (joined.length <= budget) return { list: joined, truncated: false };

  const parts: string[] = [];
  let used = 0;
  const ellipsis = '…';
  for (const topic of topics) {
    const addition = parts.length === 0 ? topic : `; ${topic}`;
    if (used + addition.length + ellipsis.length > budget) break;
    parts.push(topic);
    used += addition.length;
  }
  const list = parts.join('; ');
  const truncated = parts.length < topics.length;
  return { list: truncated ? `${list}${ellipsis}` : list, truncated };
}

export interface DescriptionResult {
  description: string;
  truncated: boolean;
}

export function buildDescription(entries: LearningEntry[]): DescriptionResult {
  const fixedLength =
    DESCRIPTION_PREFIX.length + 1 + ' Topics: '.length + 1 + DESCRIPTION_SUFFIX.length;
  const budget = Math.max(0, MAX_DESCRIPTION_CHARS - fixedLength - 1);
  const { list: topicList, truncated } = buildTopicList(entries, budget);
  const topicsSection = topicList.length > 0 ? ` Topics: ${topicList}.` : '';
  const description = `${DESCRIPTION_PREFIX}${topicsSection} ${DESCRIPTION_SUFFIX}`;
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return {
      description: `${description.slice(0, MAX_DESCRIPTION_CHARS - 1)}…`,
      truncated: true,
    };
  }
  return { description, truncated };
}

/**
 * Render the full SKILL.md contents for the project-learnings skill.
 * Deterministic: same entries → same bytes.
 */
export function buildSkillContent(entries: LearningEntry[]): string {
  const { description } = buildDescription(entries);
  const bodyLines = ['# Project Learnings', ''];

  if (entries.length === 0) {
    bodyLines.push(
      'No learnings recorded yet. Add project-specific lessons to',
      `\`${LEARNINGS_RELATIVE_PATH}/\` with a \`Covers:\` line on line 3 to make`,
      'them discoverable.',
    );
  } else {
    bodyLines.push(
      'Match your current task to a topic, then read the matching file for full context:',
      '',
    );
    for (const entry of entries) {
      bodyLines.push(`- **${entry.title}** — ${entry.covers}`, `  → ${entry.relativePath}`);
    }
  }

  const frontmatter = [
    '---',
    'name: project-learnings',
    `description: ${description}`,
    'user-invocable: false',
    '---',
    '',
  ].join('\n');

  return `${frontmatter}${bodyLines.join('\n')}\n`;
}

/**
 * Generate/update the project-learnings skill from the learnings folder.
 * Returns whether bytes changed and any skipped entries.
 */
export function syncLearnings(cwd: string): SyncResult {
  const learningsDirectory = nodePath.join(cwd, LEARNINGS_RELATIVE_PATH);
  const skillDirectory = nodePath.join(cwd, SKILL_RELATIVE_DIR);
  const skillPath = nodePath.join(skillDirectory, SKILL_FILENAME);

  const { entries, skipped } = readLearnings(learningsDirectory);
  const nextContent = buildSkillContent(entries);
  const { truncated: descriptionTruncated } = buildDescription(entries);

  const previousContent = existsSync(skillPath) ? readFileSync(skillPath, 'utf8') : undefined;
  if (previousContent === nextContent) {
    return { wrote: false, entries, skipped, skillPath, descriptionTruncated };
  }

  if (!existsSync(skillDirectory)) {
    mkdirSync(skillDirectory, { recursive: true });
  }
  writeFileSync(skillPath, nextContent);
  return { wrote: true, entries, skipped, skillPath, descriptionTruncated };
}
