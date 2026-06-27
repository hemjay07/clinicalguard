# ADR-024: Public Methodology Documentation Page

**Date:** 2026-06-15
**Status:** Accepted

## Context
Substantive methodology decisions — query construction, the reasoning archetypes,
the required/expected/situational tiers, the 75/25 scoring formula, the measured
variance, and the honest limitations — existed only in the repository
(`docs/methodology.md`) and in design discussions. There was no public,
reader-friendly artifact for an external reviewer, a potential contributor, or the
forthcoming methodology paper to point to.

## Decision
Add a public `/methodology` page (linked from the top nav and the landing footer
and resources) written in the landing page's typographic style. It covers, in
eight sections: overview, query construction, ground-truth authoring, scoring
methodology, variance and reliability, acknowledged limitations, what ClinicalGuard
does and does not claim, and references. All figures are taken verbatim from
`docs/methodology.md` (real σ values, the 75/25 formula, correlation figures) — no
numbers are fabricated — and the page links back to the repo doc for full technical
detail.

## Consequences
The framework's honesty is now legible to a public reader: it is explicit about
single-author/small-corpus limitations, the un-tuned weighting, the communication
gap, and that one author is recently graduated and not in current practice. This
candour is the credibility strategy for the methodology paper. The page is content
only — no application logic — so it carries no architectural risk, and it must be
kept in sync with `docs/methodology.md` as the methodology evolves.
