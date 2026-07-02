# ADR-025: Guided authoring flow as the default authoring experience

**Status:** Accepted (2026-07-02)

## Context

The v1.2.1 authoring page presents the case as a form with three collapsible
sections. This works for a second or third case, but first-time MD authors face
a wall of unfamiliar fields. Since MD adoption hinges on the authoring UX, the
first-case experience is the product's most important surface.

## Decision

Reframe authoring as a guided journey through the three phases (Frame the case,
Author the expected response, Safety layer), one clinical question per screen
(21 screens), as the **default** view:

- A clickable phase bar with a per-phase position line and numbered breadcrumb
  dots (fill state per screen). Navigation is free: phases, dots, back/forward
  arrows, and `?screen=` URL params (shareable positions).
- Each screen asks one question with its house-rule guidance inline (e.g.
  "not investigations already provided in the query" — the query-preemption
  rule). The guidance strings are lessons the tool teaches through the
  interface, not decoration.
- An optional "How this fits into the case" JSON preview per screen.
- A final review screen with per-question summaries, jump-to-fix validation,
  and submit.
- The v1.2.1 three-section form is retained as the "Full form" view (header
  toggle, persisted preference) and as the "See full case" modal. Both views
  edit the same `FormState`, so they can never diverge.
- The right sidebar toggles between NSTG source material and a live case
  preview whose rows jump to the corresponding screen.
- A one-time intro overlay appears on the first-ever guided session.

The condition-picker screen from the PRD's sequence was dropped: conditions are
selected before `/author/compose`, and re-asking would duplicate state.

## Consequences

- First-time authors are walked through the case shape without losing the
  free navigation experienced authors want.
- Shared state (`caseForm.ts`) + screen definitions (`flow.ts`) mean guidance
  and validation live in one place for both views.
- The DKA reference case (2026-07-02) is reproducible end-to-end through the
  flow — verified in-browser at implementation time.
