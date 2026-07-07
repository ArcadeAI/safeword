# Test Definitions: Retro process-level surfaces and egress-drop reporting

Feature source: `packages/cli/features/retro-process-surface.feature`

test-definitions.md is the R/G/R ledger.

Quality-review notes for implement (2026-07-07): run the hex/secret-shape
rejection on slugs of ANY length (no ≥20-char floor) and on hyphen-split
segments; assert the rendered summary line with counts flowing from
prepareEncounters through the command reporter, never a hand-injected counts
object.

## Rule: retro-process-surface.SM1.R1 — A process-area finding survives egress and files like any file-surfaced finding

### Scenario: A finding surfaced as a valid process area becomes a filable encounter

- [x] RED 91548ee
- [x] GREEN 9e1cc9a
- [x] REFACTOR skip: minimal additive branch, extraction helper already in place for the strictness loops

### Scenario: A process-surfaced finding files end to end through the retro run

- [x] RED skip: composed of already-RED-driven pieces (wall 30fdf25, label 9ddd303); this is the wiring proof through runRetro with only extraction + transport mocked
- [x] GREEN c31331b
- [x] REFACTOR skip: test-only addition

### Scenario: A process-surfaced draft carries the process label

- [x] RED 9ddd303
- [x] GREEN 4e7a6dc
- [x] REFACTOR skip: two-line additive change

### Scenario: A file-surfaced draft is unchanged by the process namespace

- [x] RED skip: regression guard — file-surface filing is pre-existing tested behavior; the no-process-label half is the new claim
- [x] GREEN 9ddd303
- [x] REFACTOR skip: test-only (the no-label assertion rode the label RED commit)

### Scenario: A non-safeword file path is still dropped

- [x] RED skip: pre-existing wall behavior; the new claim is the surface-wall count, shipped in 9951350
- [x] GREEN b9fd1f7
- [x] REFACTOR skip: test-only addition

## Rule: retro-process-surface.SM1.R2 — The process namespace stays fail-closed against non-slug and secret-shaped values

### Scenario: A process surface outside the strict slug shape is dropped

- [x] RED 30fdf25
- [x] GREEN 9951350
- [x] REFACTOR skip: wall helpers named and documented at authoring; no duplication introduced

### Scenario: An ordinary word slug at the length boundary survives

- [x] RED skip: passing side of the bound shipped with the wall GREEN (9951350); boundary proof
- [x] GREEN 7b47db3
- [x] REFACTOR skip: test-only addition

### Scenario: A slug with a hex-alphabet dictionary word among non-hex segments survives

- [x] RED skip: calibration shipped with the wall GREEN (9951350); this pins it against over-aggressive hex rejection
- [x] GREEN 949ccb0
- [x] REFACTOR skip: test-only addition

## Rule: retro-process-surface.SM1.R3 — Extraction guidance offers the process surface instead of fabricated file paths

### Scenario: The shared extraction prompt offers the process namespace

- [x] RED a5e7b3d
- [x] GREEN 246f9bd
- [x] REFACTOR skip: string-contract change only

### Scenario: The Codex schema's surface description names the same process form

- [x] RED 4b8dc3d
- [x] GREEN 9b22313
- [x] REFACTOR skip: string-contract change only

### Scenario: A surface is still required of every finding

- [x] RED skip: normalizeFinding has always required the field; the new claim is schema-wall attribution (9951350)
- [x] GREEN d06ac21
- [x] REFACTOR skip: test-only addition

## Rule: retro-process-surface.SM2.R1 — The run summary reports drops per egress wall and stays quiet when clean

### Scenario: Unresolvable-surface drops are counted in the summary

- [x] RED bbb5ad1
- [x] GREEN 4b6dc46
- [x] REFACTOR skip: renderDropReport extraction folded into GREEN under the complexity lint gate

### Scenario: Off-schema drops are counted in the summary

- [x] RED skip: rendering shipped with the surface-wall GREEN (4b6dc46); partition proof
- [x] GREEN acd127f
- [x] REFACTOR skip: test-only addition

### Scenario: Drops at both walls in one run are reported separately

- [x] RED skip: rendering shipped with the surface-wall GREEN (4b6dc46); discrimination proof
- [x] GREEN 809c421
- [x] REFACTOR skip: test-only addition

### Scenario: A clean run's summary carries no drop line

- [x] RED skip: non-zero-only rendering shipped with the surface-wall GREEN (4b6dc46); rejection proof
- [x] GREEN f1c6c52
- [x] REFACTOR skip: test-only addition

## Feature-level cross-scenario refactor

- [ ] cross-scenario
