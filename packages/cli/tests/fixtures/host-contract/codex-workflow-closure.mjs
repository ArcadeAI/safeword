import assert from 'node:assert/strict';
import console from 'node:console';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = realpathSync(process.argv[2]);
const source = realpathSync(process.argv[3]);
const index = JSON.parse(readFileSync(path.join(root, 'resources/workflow-index.json'), 'utf8'));
assert.equal(index.version, 1);
const compare = (left, right) => left.localeCompare(right);
const canonical = readdirSync(path.join(source, 'skills')).toSorted(compare);
assert.deepEqual(index.workflows.map(entry => entry.name).toSorted(compare), canonical);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const record = relative => {
  const absolute = realpathSync(path.join(root, relative));
  const inside = path.relative(root, absolute);
  assert.ok(inside && !inside.startsWith('..') && !path.isAbsolute(inside));
  const bytes = readFileSync(absolute);
  return { relative, sha256: createHash('sha256').update(bytes).digest('hex') };
};
const resources = index.workflows
  .flatMap(entry => entry.resources)
  .map(relative => record(relative));
const indexed = new Set(resources.map(resource => resource.relative));
function linkedResources(resource) {
  if (!resource.relative.endsWith('.md')) return [];
  const text = readFileSync(path.join(root, resource.relative), 'utf8');
  return text
    .matchAll(/\]\(([^\s)]+)\)|`([^`\s]+)`/gu)
    .flatMap(match => {
      const destination = (match[1] ?? match[2]).split(/[?#]/u, 1)[0];
      // Backticked directory/layout examples are not file-resource references.
      if (match[2] && !/\.(?:md|js|json|yaml)$/u.test(destination)) return [];
      const directory = path.dirname(resource.relative);
      const expectedSibling = indexed.has(path.posix.join(directory, destination));
      const bareWorkflow = index.workflows.some(entry => destination === `${entry.name}/SKILL.md`);
      if (
        !/^(?:\.\.\/)*(?:internal|skills|templates|runtime|references)\//u.test(destination) &&
        !expectedSibling &&
        !bareWorkflow
      )
        return [];
      const absolute = path.resolve(root, directory, destination);
      try {
        return [record(path.relative(root, absolute))];
      } catch (error) {
        throw new Error(`Contracted link ${resource.relative} -> ${destination} did not resolve`, {
          cause: error,
        });
      }
    })
    .toArray();
}
const links = [];
const visited = new Set();
function visit(resource) {
  if (visited.has(resource.relative)) return;
  visited.add(resource.relative);
  for (const linked of linkedResources(resource)) {
    links.push({ from: resource.relative, ...linked });
    visit(linked);
  }
}
for (const resource of resources) visit(resource);
const templates = readdirSync(source, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => {
    const relative = path.relative(source, path.join(entry.parentPath, entry.name));
    const installed = record(`templates/${relative}`);
    assert.equal(installed.sha256, hash(path.join(source, relative)));
    return installed;
  });
assert.ok(
  resources.length > 0 &&
    templates.length > 0 &&
    links.some(entry => entry.relative === 'runtime/cli.js'),
);
console.log(
  JSON.stringify({ cwd: process.cwd(), installed: root, canonical, resources, links, templates }),
);
