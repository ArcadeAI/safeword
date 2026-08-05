import process from 'node:process';

import {
  createGitHubIssueClient,
  fetchText,
  parseGitHubRepo,
  readText,
  runUpstreamMonitor,
} from './index.js';

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

const parsedRepo = parseGitHubRepo(repoFullName);
if (!parsedRepo) {
  console.error(`GITHUB_REPOSITORY must be owner/repo, got ${repoFullName}`);
  process.exit(1);
}
const { owner, repo } = parsedRepo;

// The monitor and the issue client both report operational detail; in a
// scheduled run the workflow log is the only place anyone will read it.
const log = (message: string): void => {
  console.log(message);
};

const { reported, failed } = await runUpstreamMonitor({
  fetchText: url => fetchText(url, token),
  issueClient: createGitHubIssueClient({ fetch, owner, repo, token, log }),
  log,
  readText,
  rootDirectory: process.cwd(),
});

console.log(`upstream changelog monitor complete; reported=${reported} failed=${failed}`);

// A source that could not be checked is missing evidence, not a pass. Exit
// non-zero so a broken watch surfaces as a red scheduled run rather than a
// line in a log nobody reads — the same reason the tripwires exist at all.
if (failed > 0) {
  console.error(`${failed} upstream source(s) could not be checked; see the log above.`);
  process.exit(1);
}
