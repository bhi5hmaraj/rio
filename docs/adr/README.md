# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Rio project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

**Format:**
- **Title:** Numbered sequentially (ADR-001, ADR-002, etc.)
- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Date:** When the decision was made
- **Context:** What is the issue we're trying to address?
- **Decision:** What is the change we're proposing/making?
- **Consequences:** What becomes easier or more difficult?
- **References:** Links to related docs

## Why ADRs?

- **Preserve context:** Future developers understand *why* decisions were made
- **Document trade-offs:** Explicit about what we gained and lost
- **Enable revisiting:** Easy to find and reconsider past decisions
- **Onboarding:** New team members get architectural context quickly

## Index

### Active ADRs

- [ADR-001: MVP Architecture and Implementation Strategy](001-mvp-architecture.md) - *Accepted 2025-11-22*
  - Build tooling, monorepo structure, LiteLLM integration
  - Service Worker + Side Panel architecture
  - Bottom-up implementation approach
  - Testing strategy (Jest + Playwright)

### Proposed ADRs

*(None yet)*

### Deprecated ADRs

*(None yet)*

---

## Creating a New ADR

1. Copy `000-template.md` (if it exists) or use the format from ADR-001
2. Number it sequentially (next available number)
3. Fill in all sections
4. Submit for review
5. Update this README index

**Template structure:**

```markdown
# ADR-XXX: [Title]

**Status:** Proposed
**Date:** YYYY-MM-DD
**Deciders:** [Who decided]
**Context:** [What are we deciding]

## Context
[Problem statement]

## Decision
[What we're doing]

## Consequences
### Positive
[What improves]

### Negative
[What becomes harder]

### Mitigations
[How we address negatives]

## References
[Links to related docs]
```

---

## When to Write an ADR

Write an ADR when making decisions that:

✅ **Affect multiple components** (e.g., API design, data model)
✅ **Are hard to change later** (e.g., storage format, extension architecture)
✅ **Have significant trade-offs** (e.g., performance vs simplicity)
✅ **Are non-obvious** (e.g., "why did we choose X over Y?")

**Don't write ADRs for:**
❌ Trivial decisions (e.g., variable naming)
❌ Implementation details (e.g., specific CSS values)
❌ Decisions easily reversed (e.g., UI copy changes)

---

## Related Documentation

- **Design Docs** (`docs/design/`): How the system works
- **PRDs** (`prd/`): What we're building and why
- **ADRs** (`docs/adr/`): Key architectural decisions (← You are here)

ADRs complement design docs by focusing on *why* we chose specific approaches.
