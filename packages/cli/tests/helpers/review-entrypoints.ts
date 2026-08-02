import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const TEMPLATES = nodePath.join(REPO_ROOT, 'packages/cli/templates');

export const REVIEW_KNOWLEDGE_RESOLVER = '.safeword/hooks/resolve-project-knowledge.ts';

const REVIEW_STAGE_TEMPLATES = {
  spec: 'skills/self-review/SKILL.md',
  scenario: 'skills/review-spec/SKILL.md',
  plan: 'skills/bdd/PLAN_IMPLEMENTATION.md',
  quality: 'skills/quality-review/SKILL.md',
} as const;

export type ReviewStage = keyof typeof REVIEW_STAGE_TEMPLATES;
export type ReviewHost = 'claude' | 'cursor' | 'codex';

export interface ReviewEntrypoint {
  host: ReviewHost;
  review: ReviewStage;
  stage: (typeof REVIEW_STAGE_TEMPLATES)[ReviewStage];
  path: string;
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function templateContent(template: string): string {
  return readFileSync(nodePath.join(TEMPLATES, template), 'utf8');
}

function reviewForTemplate(template: string): ReviewStage {
  const match = Object.entries(REVIEW_STAGE_TEMPLATES).find(([, path]) => path === template);
  return required(
    match?.[0] as ReviewStage | undefined,
    `unknown review stage template: ${template}`,
  );
}

const CLAUDE_REVIEW_ENTRYPOINTS: ReviewEntrypoint[] = Object.entries(SAFEWORD_SCHEMA.ownedFiles)
  .filter(([path, definition]) => {
    const template = definition.template;
    return (
      path.startsWith('.claude/skills/') &&
      template !== undefined &&
      templateContent(template).includes(REVIEW_KNOWLEDGE_RESOLVER)
    );
  })
  .map(([path, definition]) => {
    const stage = required(definition.template, `missing template for ${path}`);
    return { host: 'claude', review: reviewForTemplate(stage), stage, path };
  });

const CURSOR_REVIEW_ENTRYPOINTS: ReviewEntrypoint[] = CLAUDE_REVIEW_ENTRYPOINTS.map(claude => {
  const skill = required(claude.path.split('/', 3)[2], `missing skill name in ${claude.path}`);
  const commandPath = `.cursor/commands/${skill}.md`;
  if (
    claude.stage.endsWith('/SKILL.md') &&
    Object.hasOwn(SAFEWORD_SCHEMA.ownedFiles, commandPath)
  ) {
    return { ...claude, host: 'cursor', path: commandPath };
  }

  const matches = Object.entries(SAFEWORD_SCHEMA.ownedFiles).filter(([path, definition]) => {
    const template = definition.template;
    return (
      path.startsWith('.cursor/') &&
      template !== undefined &&
      templateContent(template).includes(claude.path)
    );
  });
  if (matches.length !== 1) {
    throw new Error(`expected one Cursor production catalogue row for ${claude.stage}`);
  }
  return { ...claude, host: 'cursor', path: required(matches[0], 'missing Cursor row')[0] };
});

export const GENERATED_CODEX_PLUGIN_ASSETS = generateCodexPluginAssets(
  nodePath.join(TEMPLATES, 'skills'),
);

const CODEX_REVIEW_ENTRYPOINTS: ReviewEntrypoint[] = GENERATED_CODEX_PLUGIN_ASSETS.filter(asset =>
  asset.content.includes(REVIEW_KNOWLEDGE_RESOLVER),
).map(asset => {
  const canonicalSuffix = asset.relativePath.replace('/references/', '/');
  const canonical = required(
    CLAUDE_REVIEW_ENTRYPOINTS.find(row => row.stage === canonicalSuffix),
    `missing canonical source for ${asset.relativePath}`,
  );
  return { ...canonical, host: 'codex', path: asset.relativePath };
});

export const REVIEW_ENTRYPOINTS: readonly ReviewEntrypoint[] = [
  ...CLAUDE_REVIEW_ENTRYPOINTS,
  ...CURSOR_REVIEW_ENTRYPOINTS,
  ...CODEX_REVIEW_ENTRYPOINTS,
];

export function reviewEntrypoint(host: ReviewHost, review: ReviewStage): ReviewEntrypoint {
  return required(
    REVIEW_ENTRYPOINTS.find(row => row.host === host && row.review === review),
    `missing ${host} ${review} review entrypoint`,
  );
}
