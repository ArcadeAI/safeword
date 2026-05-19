#!/usr/bin/env node
// Pre-publish guards: bun-only + HEAD must carry the matching annotated tag.
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RED = '[31m';
const YELLOW = '[33m';
const RESET = '[0m';

const agent = process.env.npm_config_user_agent || '';
if (!agent.includes('bun')) {
  console.error(`${RED}Error: Use "bun publish", not "npm publish"${RESET}`);
  console.error('npm publish does not strip workspace: protocols from package.json');
  process.exit(1);
}

const pkgPath = path.resolve(import.meta.dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const expected = `v${pkg.version}`;

let tagsOnHead;
try {
  tagsOnHead = execFileSync('git', ['tag', '--points-at', 'HEAD'], { encoding: 'utf8' });
} catch (error) {
  throw new Error('Failed to read git tags on HEAD', { cause: error });
}

const hasTag = tagsOnHead
  .split('\n')
  .map(t => t.trim())
  .includes(expected);

if (!hasTag) {
  console.error(`${RED}Error: HEAD is not tagged ${expected}${RESET}`);
  console.error(`${YELLOW}Annotated tags are required for every published release.${RESET}`);
  console.error('');
  console.error('Run from repo root, then retry `bun publish`:');
  console.error(`  git tag -a ${expected} -m "Release ${expected}"`);
  console.error(`  git push origin ${expected}`);
  process.exit(1);
}
