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
