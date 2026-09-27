# ADR-035: Expected tier in the core authoring flow

**Status:** Accepted
**Date:** 2026-09-27

## Context

v1.6 sorted every non-core item into a single optional "Add more detail" step at
the end of Phase 2, labelled "Optional. Skip this if you're short on time; you or
another physician can add it later." Expected investigations and Expected
treatments lived there. That undercut the methodology:

- **Scorer.** A dimension scores `0.75 × critical_coverage + 0.25 × thoroughness`
  (`eval_scorer.py`, `docs/methodology.md`), and thoroughness is measured against
  the Expected items. A case with no Expected items has nothing to score
  thoroughness against.
- **Kappa.** Tier agreement needs spread (required > expected > situational). If
  authors only fill Required, there is nothing to measure.
- **Tier inflation.** If the core screens only offer Required, authors put
  Expected-level items into Required, and the scorer then fails reasonable AI
  answers.
- **Required monitoring** (e.g. hourly potassium in DKA) sat behind a collapsed
  row on a screen authors were told to skip.
- "add it later" is not true: there is no enrich-later lifecycle, and editing is
  limited to a case's own author.

## Decision

- **Pair Required and Expected on the core screens.** The Investigations (2.4)
  and Treatments (2.7) screens now show two lists: "Must do" (the existing
  `required` field) and "Should do" (the existing `expected` field), both visible,
  not collapsed. The standalone Expected screens (2.5, 2.8) and the "Expected
  items" optional group are removed; their fields and rule-bearing help move onto
  the core screens **unchanged**. Old draft/deep-link ids 2.5/2.8 resolve to
  2.4/2.7.
- **"Nothing to add" for Should-do.** A boolean per list, stored distinct from an
  empty field, mirroring `safety_none_declared` (a dedicated column plus a key in
  the `expected_response` blob), via an Alembic migration — not `create_all`.
  Unlike safety it is optional: no XOR gate at submission.
- **Required monitoring on Treatments.** A "Does anything here need monitoring?"
  line on the Treatments screen writes to the existing `mon_required` field
  (stored as `required_monitoring.required_elements`). No treatment↔monitoring
  dependency logic. The "Complications and monitoring" optional section still
  edits Expected monitoring and complications, and now shows required monitoring
  read-only so nothing looks lost.
- **"Add more detail" copy** replaced with "Optional, but these make the case much
  stronger. Situational items, complications and escalation are where AI answers
  most often fall short." All "add it later" wording is removed.
- **"About this case" returns to Phase 1** as a collapsed optional group. Screens
  1.3 (evaluates) and 1.4 (scope) move to `phase: 1`; the enrichment step is now
  per-phase, so Phase 1 shows "About this case" and Phase 2 shows the rest.
- **Per-section fill log.** An owner-only `GET /api/v1/eval-cases/section-fill-stats`
  reports, over the last N MD-authored cases, the percentage that filled each
  thoroughness/optional section (and, from the new columns, how often "Nothing to
  add" was chosen).

### Cross-phase moves on record
- 1.5 provenance moved Phase 1 → Phase 2 (ADR-033).
- 1.3 / 1.4 moved Phase 1 → Phase 2 (v1.6), and are moved back to Phase 1 here.
No other screen changed phase.

### Rule-bearing text
The existing Required and Expected help strings are reused verbatim (the Required
help carries the query-preemption rule). "Must do" / "Should do" are labels only.
The PRD's shorter one-line descriptions were **not** adopted as help, because the
"Must do" phrasing would drop the query-preemption clause from the Required help —
a rule-bearing change we declined to make.

## Consequences

- Every new case now has a natural place for thoroughness signal, so the scorer's
  0.25 sub-score and the kappa study have data, and Required stops absorbing
  Expected-level items.
- Two new non-null boolean columns on `eval_cases` (migration
  `c3f7a1e08b52`, applied to the shared Supabase DB as prior migrations were).
- Existing cases load and edit correctly: their stored Expected items appear in
  "Should do", and required monitoring is visible.
- Not built (still OQ3): enrich-later lifecycle, case states, mode toggle.

**Rejected:** keeping Expected in the optional menu with stronger copy — it leaves
the scorer/kappa gap and the tier-inflation incentive in place. Adding a single
combined "Nothing to add" flag — the two lists are independent, so per-list flags
are needed to tell a declared-none from a skip on each.
