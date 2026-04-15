---
id: '013'
title: Restructure skills for LLM optimization
type: epic
status: done
priority: medium
created: 2026-01-08
children: ['013a', '013b', '013c', '013d', '013e']
---

# Restructure Skills for LLM Optimization

This epic covers restructuring skills for better LLM performance.

## Children

- **013a**: [BDD skill compression and phase-based splitting](./013a-bdd-skill-compression.md)
- **013b**: [Quality review skill - phase-aware with web research](./013b-quality-review-restructure.md)
- **013c**: [Testing guide consolidation](./013c-testing-guide-consolidation.md)
- **013d**: [BDD flow enforcement improvements](../013d-bdd-flow-enforcement/ticket.md)
- **013e**: [Schema file validation command](../013e-schema-file-validation/ticket.md)

## Shared Research

### LLM Context Optimization

- Models perform best at 10-64k tokens, not their advertised 200k
- "Lost in the middle" phenomenon: <40% recall for middle content vs >80% for start/end
- Stay at 70-80% of context window capacity
- Cursor recommends rules under 100 lines each

### Reliable Rule/Skill Loading

| Pattern                 | Activation Rate |
| ----------------------- | --------------- |
| Generic descriptions    | ~20%            |
| USE WHEN prefix         | High            |
| WHEN + WHEN NOT in body | 80-84%          |
| Trigger-rich language   | High            |

**Key insight:** Description is the gatekeeper. Include explicit "USE WHEN [condition]" and trigger phrases.

### Anthropic Best Practices

- Just-in-time loading, few-shot examples > extensive rules
- Performance cliff at 70-80% context
- Simple masking halves cost while matching summarization performance

## Minor Guide Cleanups (During Implementation)

Small fixes to apply when touching related files:

| Guide                  | Change                                                                                                                       | Rationale                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| design-doc-guide.md    | Remove escalation check (lines 3-11) entirely                                                                                | Decision belongs in BDD Phase 5 flow, not in operational guide; by the time LLM loads this guide, it has already decided to create a design doc |
| context-files-guide.md | Remove Quality Checklist (lines 420-431), reference llm-writing-guide                                                        | Duplicates llm-writing-guide; that guide is canonical for LLM writing quality principles                                                        |
| architecture-guide.md  | Remove Design Document section (lines 74-93), Design Doc anti-patterns (lines 238-245), Design Doc checklist (lines 414-419) | BDD Phase 5 handles routing; design-doc-guide owns design doc content; arch guide should focus on ARCHITECTURE.md only                          |
| code-philosophy.md     | Delete entirely; remove trigger from SAFEWORD.md                                                                             | ~70% duplicates SAFEWORD.md (Code Philosophy, Anti-Patterns, Response Format, Library verification); remaining content too thin for guide       |

These are too small for separate tickets but should be done when implementing 013a-c.
