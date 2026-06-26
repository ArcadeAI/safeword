import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

import { reviewCandidateSkill, type CandidateSkillReview } from './transfer';

export interface RustCandidateSkill {
  id: string;
  path: string;
  metadata: {
    name: string;
    description: string;
  };
  body: string;
  text: string;
}

export interface RustCandidateSkillSummary {
  id: string;
  path: string;
  description: string;
}

export interface RustCandidateSkillReviewResult {
  skill: RustCandidateSkill;
  review: CandidateSkillReview;
}

export function loadRustCandidateSkill(path: string): RustCandidateSkill {
  const text = readFileSync(path, 'utf8');
  const { metadata, body } = parseSkillMarkdown(text, path);
  const parentName = basename(dirname(path));
  if (parentName !== metadata.name) {
    throw new Error(
      `candidate skill name must match folder name: ${metadata.name} != ${parentName}`,
    );
  }

  return {
    id: metadata.name,
    path,
    metadata,
    body,
    text,
  };
}

export function reviewRustCandidateSkill(path: string): RustCandidateSkillReviewResult {
  const skill = loadRustCandidateSkill(path);
  return {
    skill,
    review: reviewCandidateSkill(skill.text),
  };
}

export function summarizeRustCandidateSkill(skill: RustCandidateSkill): RustCandidateSkillSummary {
  return {
    id: skill.id,
    path: skill.path,
    description: skill.metadata.description,
  };
}

function parseSkillMarkdown(
  text: string,
  path: string,
): {
  metadata: RustCandidateSkill['metadata'];
  body: string;
} {
  if (!text.startsWith('---\n')) {
    throw new Error(`${path} must start with YAML frontmatter`);
  }

  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error(`${path} must close YAML frontmatter`);
  }

  const frontmatter = text.slice(4, end);
  const body = text.slice(end + '\n---\n'.length).trim();
  const metadata = parseFrontmatter(frontmatter, path);
  if (!body) {
    throw new Error(`${path} must include skill instructions`);
  }

  return { metadata, body };
}

function parseFrontmatter(frontmatter: string, path: string): RustCandidateSkill['metadata'] {
  const values = new Map<string, string>();
  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const delimiter = line.indexOf(':');
    if (delimiter === -1) {
      throw new Error(`${path} frontmatter line is not key/value: ${line}`);
    }

    const key = line.slice(0, delimiter).trim();
    const value = line.slice(delimiter + 1).trim();
    values.set(key, unquote(value));
  }

  const name = values.get('name');
  const description = values.get('description');
  if (!name || !/^[a-z0-9-]{1,64}$/.test(name)) {
    throw new Error(`${path} frontmatter name must be lowercase letters, digits, or hyphens`);
  }
  if (!description) {
    throw new Error(`${path} frontmatter description is required`);
  }

  return { name, description };
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
