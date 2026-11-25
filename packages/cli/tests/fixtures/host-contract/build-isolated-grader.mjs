import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { buildPluginCliBundle } from '../../../scripts/lib/build-plugin-cli-bundle.ts';
import { planningAuthorCopies } from '../../../scripts/lib/planning-author-copies.ts';

const [repo, installed, encoded] = process.argv.slice(2);
const root = path.join(repo, 'packages/cli');
const source = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const scope = JSON.parse(encoded);
const bundle = await buildPluginCliBundle(
  root,
  source.packageManager,
  'Owned test grader',
  pkg.version,
  { planningCopies: planningAuthorCopies(installed, 'codex'), isolatedGrader: scope ?? undefined },
);
writeFileSync(path.join(installed, 'runtime/cli.js'), bundle);
