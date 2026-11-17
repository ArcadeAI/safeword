---
id: HEA4VR
slug: stamp-skips-generated-files
type: task
phase: done
status: done
created: 2026-11-15T18:07:29.778Z
last_modified: 2026-11-15T18:07:29.778Z
issue: '#5870'
scope:
  - The implement-phase stamp's required coverage set leaves out changed files that the merge base's `.gitattributes` marks `linguist-generated` or `linguist-vendored`
  - Attributes are read from the merge-base commit with system, global and repo-local attribute files ignored, so a branch cannot exempt its own files by editing `.gitattributes` or `info/attributes`
  - The coverage rejection names the changed files the review did not cover, not only what it did cover
  - The coverage set includes a staged edit whose working-tree copy was restored (found in cross-agent review)
  - The coverage set keeps both sides of a rename, so moving an authored file into a generated folder still requires review (found in cross-agent review)
out_of_scope:
  - Splitting one review across several packets
  - Raising the 64-file review packet limit
  - Ignoring `node_modules` in installed projects (closed by #6764)
done_when:
  - A review of only the hand-written files earns the implement stamp on a branch that also regenerates base-marked mirrors
  - A file marked generated only on the branch still has to be reviewed
  - The rejection lists the uncovered files
  - Targeted hook and integration tests pass, and CI is green
---

# Let approved reviews earn the implement stamp when changes regenerate mirrors

**Goal:** The implement-phase stamp requires review coverage only of hand-written files, not files the base branch marks linguist-generated or linguist-vendored

**Why:** Generated mirrors push the change set past the 64-file review packet, so an approved review can never earn the stamp and agents must log a skip (#5870)

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-15T18:07:29.778Z Started: Created ticket HEA4VR
- 2026-11-15T18:08:34.454Z Phase: intake → implement
- 2026-11-17T04:44:06.089Z Phase: implement → verify
- 2026-11-17T05:26:30.892Z Phase: verify → done
