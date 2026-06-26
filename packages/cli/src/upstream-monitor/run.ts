import process from 'node:process';

import { createGitHubIssueClient, fetchText, readText, runUpstreamMonitor } from './index.js';

const repoFullName = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repoFullName) {
  console.error('GITHUB_REPOSITORY is required.');
  process.exit(1);
}

if (!token) {
  console.error('GITHUB_TOKEN is required.');
  process.exit(1);
}

const [owner, repo] = repoFullName.split('/');
if (!owner || !repo) {
  console.error(`GITHUB_REPOSITORY must be owner/repo, got ${repoFullName}`);
  process.exit(1);
}

const reported = await runUpstreamMonitor({
  fetchText,
  issueClient: createGitHubIssueClient({ fetch, owner, repo, token }),
  log: message => {
    console.log(message);
  },
  now: () => new Date(),
  readText,
  rootDirectory: process.cwd(),
});

console.log(`upstream changelog monitor complete; reported=${reported}`);
