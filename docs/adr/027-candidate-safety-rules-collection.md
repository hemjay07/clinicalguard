# ADR-027: Background collection of candidate safety rules

**Status:** Accepted (2026-07-02)

## Context

MDs author free-text safety flags when the verified rule library doesn't cover
a concern (e.g. "confirm potassium above 3.3 mmol/L before initiating
insulin"). These flags were stored only inside the owning case's JSON blob, so
the future Phase D rule-verification workflow would have to trawl every case to
find candidates.

## Decision

On case creation, free-text safety flags are additionally written to a new
`candidate_safety_rules` table (Alembic revision `c4e1a2b9d3f7`):

- `rule_text`, `eval_case_id` (FK), `condition_ids` (JSON array — condition
  context), `proposed_by`, `created_at`.
- Collection runs **after** the case commit and never blocks authoring: an
  insert failure is logged and swallowed (the flags still live in the case
  blob, so nothing is lost).
- No UI reads this table yet. It preloads Phase D's verification queue with
  real MD-proposed candidates.

The safety layer UI now also explains the pipeline to authors (explanation
card + "Learn more about safety rules" modal): flags become candidates, and
verified candidates join the rule library.

## Consequences

- Phase D starts with a populated candidate queue instead of a cold start.
- Duplicate content exists (blob + table) by design; the table is the queryable
  index, the blob remains the case's source of truth.

## Addendum (2026-07-14): manual promotion stopgap

`get_relevant_rules()` (safety/engine.py) only ever reads `condition_safety_rules`
— it has never read `candidate_safety_rules`. Since Phase D's review UI (the
intended candidate → verified promotion path) is still deferred, every
MD-authored free-text flag was unreachable by the safety engine from the
moment it was authored, for every case, not just newly authored ones.

As a stopgap, the 9 candidate rows for the first 3 authored cases (DKA/103,
TB/119, heart failure/139) were promoted directly into `condition_safety_rules`
by a one-off script, mapped to each case's own `condition_id` and verified
against `get_relevant_rules()` returning them per case. `rule_type`, `severity`,
and `action` were dropped from the schema in the same pass (Alembic
`0920942cf2ee`) — they carried no methodological signal (unused by any logic,
or in severity's case, a CRITICAL-only scoring distinction that has been
replaced with a uniform per-fired-rule deduction).

This is not the Phase D workflow — it was a manual, one-time promotion for 3
specific cases, not a general candidate → verified pipeline. Future authored
cases still need either a real Phase D review UI or a repeat of this manual
step until that UI exists.
