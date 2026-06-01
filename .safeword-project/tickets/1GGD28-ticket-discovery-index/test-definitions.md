# Test Definitions — sync-tickets index

Scenarios for the `ticket-sync` pure module + `safeword sync-tickets` command.
Lineage: `ticket-discovery-index.DEV1.AC<n>.<scenario>`. Mirrors the
`learning-sync` test shape (parse → read → build → sync), extended for
epic-grouping and the active/completed scope split.

## Rule: Ticket entries carry id, title, status, epic, goal, and path (AC1)

### Scenario: ticket-discovery-index.DEV1.AC1.full_frontmatter_renders_all_fields

Given a ticket folder whose ticket.md has id, title, status, epic frontmatter and a `**Goal:**` line
When the index is built
Then its entry shows the id, title, status, epic, the goal one-liner, and the folder path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC1.title_falls_back_to_h1_then_slug

Given a ticket.md with no `title:` frontmatter but a `# Heading`, and another with neither
When entries are parsed
Then the first entry's title is the H1 text and the second falls back to the folder slug

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC1.goal_one_liner_extracted_when_present_omitted_when_absent

Given one ticket.md with a `**Goal:**` line and one without
When entries are parsed
Then the first entry carries the goal text (label stripped, single line) and the second carries no goal

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC1.crockford_numeric_and_quoted_ids_all_parse

Given ticket.md files with id `1GGD28`, id `001`, and id `'001'` (quoted)
When entries are parsed
Then all three ids are read verbatim with quotes and leading zeros preserved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC1.ticket_without_id_is_skipped_with_reason

Given a ticket.md whose frontmatter has no `id:`
When the tickets are read
Then that folder is reported as skipped (not indexed) with a reason naming the missing id

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Entries are grouped by epic (AC2)

### Scenario: ticket-discovery-index.DEV1.AC2.tickets_sharing_an_epic_group_under_one_heading

Given two tickets that both declare `epic: workflow-gate-hygiene`
When the index is built
Then both appear under a single `workflow-gate-hygiene` epic heading

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC2.ticket_without_epic_groups_under_no_epic

Given a ticket with no `epic:` frontmatter
When the index is built
Then it appears under a "(no epic)" group and its entry renders the epic as `—`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC2.groups_and_entries_are_deterministically_ordered

Given the same set of tickets parsed twice
When the index content is built each time
Then the two outputs are byte-identical (groups and entries in a stable order)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Regeneration is idempotent and drift-free (AC3)

### Scenario: ticket-discovery-index.DEV1.AC3.first_run_writes_then_unchanged_run_is_no_op

Given a tickets corpus with no INDEX.md yet
When sync runs twice with no ticket change in between
Then the first run writes the index and the second reports "already current" without writing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC3.changed_ticket_rewrites_the_index

Given an index already generated from a ticket with `status: backlog`
When that ticket changes to `status: in_progress` and sync re-runs
Then the index is rewritten and the entry shows the new status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC3.removed_ticket_drops_its_entry

Given an index generated from two tickets
When one ticket folder is deleted and sync re-runs
Then the surviving ticket remains and the deleted ticket's entry is gone

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC3.index_is_stamped_do_not_edit_and_excluded_from_its_own_scan

Given a tickets corpus
When the index is generated
Then it carries an auto-generated / do-not-edit header and the INDEX\*.md files are never parsed as tickets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Completed tickets live in a separate archive index (AC4)

### Scenario: ticket-discovery-index.DEV1.AC4.active_and_completed_split_into_two_files

Given active tickets at the tickets root and tickets under `completed/`
When sync runs
Then active tickets land in INDEX.md and completed tickets land in INDEX-completed.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC4.completed_only_corpus_writes_archive_and_empty_active

Given a corpus with only completed tickets and no active ones
When sync runs
Then INDEX-completed.md lists them and INDEX.md renders the empty-active state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket-discovery-index.DEV1.AC4.missing_tickets_dir_is_a_no_op

Given no `.safeword-project/tickets/` directory
When sync runs
Then nothing is written and no index file is created

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
