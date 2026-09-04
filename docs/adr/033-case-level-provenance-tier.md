# ADR-033: Case-level provenance tier

**Status:** Accepted
**Date:** 2026-09-04
**Supersedes:** nothing. Extends ADR-026 (provenance notes).

## Context

ADR-026 added `provenance_notes`: two free-text sentences saying what traces to
NSTG and what was authored from clinical judgment or another standard. It does
its job for a reviewer reading one case. It does nothing for the corpus.

Decision Log D31 and Roadmap §7 both want the same thing from the corpus: to
report results stratified by how much of the answer the Nigerian guideline
actually covers. A model that follows NSTG well on conditions NSTG specifies in
full, and drifts on conditions where the guideline is thin, is a different
finding from a model that drifts everywhere — and we cannot tell those apart
today. Free text cannot be grouped. Reading 200 notes and hand-coding them into
tiers after the fact is both expensive and unblinded.

The information is only available at authoring time, from the one person who
knows: the author, at the moment they finish writing the answer.

## Decision

Add a nullable `guideline_provenance` column on `eval_cases`, one of
`nstg_only | nstg_plus_other | judgment_primary`, asked as a required radio on
its own screen at the end of Phase 2.

- `nstg_only` submits with empty notes — there is nothing to attribute.
- `nstg_plus_other` and `judgment_primary` require `provenance_notes` to be
  non-empty, because both assert that something came from outside NSTG, and a
  reviewer cannot check that claim without being told which parts and from
  where. This is the first time the notes field has ever been required, and it
  is required only where it carries information.

Stored as a string with a CHECK constraint rather than a native Postgres enum,
so the vocabulary can be widened later without a type migration. Nullable, so
every case authored before v1.6 stays valid and readable; those rows are simply
excluded from any stratified cut. The field is written into the case JSON
alongside `provenance_notes`, and both are descriptive metadata — the scorer
reads neither. A test pins that: the same case scores identically with and
without the tier set.

Validation runs on submit and on save-of-edit, and the control appears in the
guided flow, the full form and the edit path, so an existing null-valued case
becomes complete the next time its author saves it.

## Consequences

The cost is one required tap on the path to submitting a case, in a release
whose whole purpose is removing friction. We are accepting it, once, for this
field specifically: it is the one piece of information that cannot be recovered
later by anyone other than the original author, and the stratified analysis is
a headline result rather than a nice-to-have. A tap is cheaper than a required
paragraph, which is what the honest alternative would have been.

Two lesser consequences. The three tiers are the author's own judgment of
guideline coverage, not a measured quantity — they are a reported author
characteristic, and the paper should describe them that way. And a case whose
tier says NSTG covers everything is now making a checkable claim, which gives a
second reviewer something concrete to disagree with; that is the point, but it
does mean disagreement will surface where it previously stayed implicit.

Rejected: deriving the tier automatically by matching authored items against
the NSTG extract. It measures string overlap, not clinical grounding, and would
mislabel exactly the cases the stratification exists to isolate.
