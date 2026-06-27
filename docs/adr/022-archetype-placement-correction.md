# ADR-022: Reasoning-Archetype Placement Correction

**Date:** 2026-06-15
**Status:** Accepted

> Numbering: v1.2 shipped as ADR-021. This (v1.2.1) is ADR-022.

## Context
v1.2 introduced the reasoning-pattern archetype selector (ADR-021). It rendered
after "Query scope", near the end of the case-framing fields. Even the originally
specified position (between "What this case evaluates" and "Expected diagnoses")
shares the same flaw: by the time the MD reaches it, they have already written the
query and decided what the case is about. The archetype becomes retrospective
labeling rather than the prospective nudge it was designed to be.

## Decision
Move the archetype selector to the **top of the form**, immediately after
"Authored by" and **before "Clinical query"**. The MD chooses the reasoning
pattern first, then authors a query in service of it. This makes the archetype an
actual prompt to think about which failure mode the case should exercise — the
intended nudge mechanism — rather than a label applied after the fact. Archetype
selection remains optional and never gates submission.

## Consequences
The nudge now operates at the moment of greatest leverage (before query
construction), which should improve corpus diversity. No schema or data change —
only field order within the form. Authors who prefer to write the query first can
still scroll past the selector and return to it; the order is a default flow, not
a constraint.
