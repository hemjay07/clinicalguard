# ADR-028: Tier only where there is tierable signal

**Status:** Accepted (2026-07-03)

*(PRD v1.3.1 numbered this ADR-027; 027 was already taken by the
candidate-safety-rules collection ADR.)*

## Context

The required/expected/situational structure is the framework's core scoring
primitive. It was applied uniformly to investigations, treatments, monitoring,
and escalation — mechanical consistency inherited by default, never justified
per field. Authoring three cases end-to-end (DKA, hypertension, TB) exposed
where the structure carries clinical meaning and where it produces incoherent
placements: during TB authoring, "visual symptoms on ethambutol — refer for
ophthalmic assessment" landed in *expected*-escalation purely because the
underlying monitoring was expected, even though that finding warrants action
regardless of tier.

## Decision

The tier structure belongs on a field only when that field carries genuine
tierable clinical signal:

- **Investigations, treatments, monitoring: tiered.** Real required-vs-thorough
  distinction. Mandatory liver-function monitoring on three hepatotoxic drugs
  is a different category from optional neuropathy monitoring when pyridoxine
  is already preventing the problem.
- **Complications: flat** (always was). An "expected but not required
  complication to be aware of" is not a meaningful category.
- **Escalation: flat** (changed in v1.3.1). An escalation trigger is a red flag
  that warrants action. A finding either warrants escalation or it does not;
  "expected escalation" is close to incoherent.

Escalation format stays `[finding] — [escalation action]`, one per line.
Existing cases' tiered escalation arrays were merged (required then expected)
by Alembic migration `e7a94c31f8b2` — no data loss. The blob key changed from
`required_escalation_triggers` to `escalation_triggers`; the LLM scorer reads
the blob whole, so legacy `nstg_derived` reference cases keep the old shape
harmlessly.

## The rule for future fields

Add the tier structure only if you can point to a real clinical difference
between required and expected *for that field*. Default is flat.
