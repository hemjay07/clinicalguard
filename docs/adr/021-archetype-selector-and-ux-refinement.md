# ADR-021: Reasoning-Pattern Archetypes and Authoring UX Refinement

**Date:** 2026-06-15
**Status:** Accepted

> Numbering note: the v1.2 PRD referred to this as ADR-020, but 020 was already
> taken by the v1.1 UI ADR. This is ADR-021.

## Context
v1.1 is live and MD authoring is about to begin. Review of the deployed authoring
flow surfaced a few targeted gaps before the first cases are written. This ADR
records the decisions behind the v1.2 changes; it deliberately does not expand
scope beyond them.

## Decision

**Reasoning-pattern archetypes (descriptive, not prescriptive).** The authoring
form gains an optional multi-select of seven canonical reasoning archetypes
(plus a free-form "Other"), stored in the case JSON as `reasoning_archetypes`
(snake_case enums) and `other_archetypes` (strings). Archetypes describe the
*reasoning pattern* a case exercises — missing-context recognition, severity
stratification, contraindication navigation, and so on — not its clinical
content. They are nudges toward diverse corpus coverage, inspired by HealthBench's
situation-type approach. Crucially they are **not enforced per case**: an MD may
submit with none selected. Coverage is a corpus-level concern, not a per-case
gate, so the selector never constrains what an MD writes. Each checkbox carries a
one-line inline subtitle so an MD understands a pattern without opening the modal.
No database migration — the fields live in the existing `expected_response` JSON blob.

**Explicit "Save as draft" alongside auto-save.** Auto-save to localStorage
already worked but the indicator was ambiguous. We keep auto-save and add an
explicit "Save as draft" button plus an unambiguous save-state indicator that
reads one of "Auto-saved at HH:MM", "Draft saved at HH:MM", or "Submitted at
HH:MM". A banner on load announces a recovered draft and offers to discard it.
The two mechanisms coexist: auto-save is the safety net; the explicit button is
the reassurance. The desktop source-panel visibility now persists across
navigations via `sessionStorage`. The "Authored by" name persists globally
(`localStorage`, separate from the per-case drafts) and pre-populates on each new
authoring page, so an MD authoring a batch types their name once.

**Guidance length reduction.** Quddus flagged that MDs skim or skip long guidance.
The four guidance modals (clinical query, tier categories, situational triggers,
what-this-evaluates) were cut to roughly half length, keeping the reasoning behind
each rule (so the guidance still teaches) while dropping redundancy and adopting
bullet structure. A new "Reasoning patterns" modal documents the archetypes.

**Form cleanups.** The redundant "Monitoring principle" free-text field is removed
(`required_principle` dropped from the schema; "Monitoring — required elements"
already captures the intent). "Other considerations" is relabelled to match the
"…the AI should address" pattern, and "Critical differentials" loses its
parenthetical in favour of a subtitle. The conditions list endpoint is cached
in-process: the root cause of the slow load is seven sequential round-trips to
Supabase (≈3 s cold, no N+1), and since the ingested data is static for a
deployment, caching the assembled result drops every subsequent load to ≈7 ms
(well under the 200 ms target). The one-time cold cost is a non-issue behind the
free-tier spin-up.

## Consequences
The corpus gains a coverage-diversity signal without the framework dictating case
content — consistent with the MD-authored, non-model-shaped stance of ADR-019.
Storing archetypes in the JSON blob keeps the schema stable but, like the rest of
the case body, leaves them non-queryable in SQL until a later phase needs it.
Tighter guidance should raise the read rate; the risk is that a skimming MD misses
a nuance, mitigated by keeping the "why" in each modal.

**Deferred (out of scope for v1.2).** The full deferred list lives in the Notion
handoff; in brief, the following were explicitly *not* built: a communication /
fifth scoring dimension (needs scorer recalibration); free-text / off-guideline
condition input and a "suggest a condition" flow (would break guideline-grounding
integrity); MD-proposed safety rules; "suggest improvement to source"; on-demand
LLM help during authoring; LLM-assisted ingestion of unstructured sources;
eval-purpose-aware methodology; case editing after submission; review-queue /
assignment workflow; eval-suite execution UI; cross-guideline selector; auth/user
management; structured query templates; and a query-inspiration panel. These are
deferred to later phases (mostly Phase D+), not rejected.
