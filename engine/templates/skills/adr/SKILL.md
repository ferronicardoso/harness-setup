---
name: adr
description: "Always use this skill when creating or maintaining Architecture Decision Records (ADRs). Applies to: documenting architectural choices, technology decisions, design trade-offs, and any significant decision that future developers need to understand. Trigger on: \"create ADR\", \"document architectural decision\", \"ADR for...\", \"record design decision\", \"why did we choose...\", \"document this trade-off\", or any similar request."
---
<!-- managed-by: harness-setup -->

## When to Trigger

- "Create an ADR for..."
- "Document this architectural decision"
- "Why did we choose X over Y — write it down"
- "Record the decision about..."
- "ADR for the authentication strategy"
- "Document this trade-off"
- "We decided to use X, create the record"

## Overview

Architecture Decision Records (ADRs) capture significant architectural choices alongside their context and consequences. They are stored in `docs/decisions/` and numbered sequentially so the history of decisions is traceable.

An ADR is warranted whenever a decision:
- Has long-term impact on the codebase or team
- Involves meaningful trade-offs between alternatives
- Would otherwise be lost in a commit message or verbal discussion

## Workflow

### 1 — Determine the next ADR number

List existing files in `docs/decisions/` and find the highest `ADR-NNN` number. The new ADR uses the next sequential number.

```
docs/decisions/
├── ADR-001-database-choice.md
├── ADR-002-authentication-strategy.md
└── ADR-003-multi-tenancy-approach.md   ← next would be ADR-004
```

If `docs/decisions/` does not exist, create it.

### 2 — Write the ADR

Use this exact format:

```markdown
# ADR-NNN — Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Date:** YYYY-MM-DD

## Context

What is the situation, constraint, or problem that forced this decision?
Include relevant background: team size, scale, existing technology, time pressure.

## Decision

What was decided? State it clearly and directly.
If alternatives were considered, list them and briefly explain why they were rejected.

## Consequences

### Positive
- What becomes easier or better as a result of this decision?

### Negative
- What becomes harder, more complex, or constrained?

### Risks
- What could go wrong? What would trigger revisiting this decision?
```

### 3 — Naming convention

File name: `ADR-NNN-short-title-with-hyphens.md`

- Always zero-pad to 3 digits: `ADR-001`, `ADR-042`
- Title: lowercase, words separated by hyphens, no special characters
- Keep it short: 3–5 words is ideal

### 4 — Status lifecycle

| Status | Meaning |
|---|---|
| `Proposed` | Under discussion — not yet committed |
| `Accepted` | Decision is in effect |
| `Deprecated` | No longer applies but kept for historical context |
| `Superseded by ADR-NNN` | A newer ADR replaces this one |

When superseding an ADR, update the old one's status to `Superseded by ADR-NNN` and reference the old ADR in the new one's Context section.

### 5 — Link from other docs

After creating an ADR, reference it wherever the decision is relevant: in architecture docs under the affected section, in code comments for non-obvious implementation choices, and in a changelog when the decision results in a breaking change.

## Expected Output

A single `docs/decisions/ADR-NNN-title.md` file containing: correct sequential number, status set to `Accepted` (unless still under discussion), today's date, a Context section explaining the situation that forced the decision, a Decision section stating clearly what was chosen and why alternatives were rejected, and a Consequences section covering positives, negatives, and risks.
