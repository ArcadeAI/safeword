# Compare live main before diagnosing merge conflicts

Covers: GitHub PR metadata, main synchronization, generated plugin integrity, CI

During the Electron retrospective closeout, the PR response still showed an older
base SHA after main advanced. Comparing only that SHA produced a clean merge-tree
and an incorrect diagnosis of GitHub's conflict flag. The actual incoming changes
conflicted in generated plugin integrity files.

Fetch the real branch tip with `git fetch origin main`, and compare `origin/main`
(`refs/remotes/origin/main`) or `FETCH_HEAD`, not an unchanged local main branch.
For a remote API check, query GitHub's live `git/ref/heads/main` endpoint. Use
`git merge-tree` against the fetched tip. Regenerate plugin outputs with the supported
checker, then test the changed integration paths before starting final-head CI.
